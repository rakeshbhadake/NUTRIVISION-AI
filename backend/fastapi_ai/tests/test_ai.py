import io

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from app.config import settings
from app.main import app
from app.schemas.food import VisionResponse
from app.services.nutrition import nutrient_map, scale_nutrition


@pytest.fixture(autouse=True)
def config(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "test-internal-key")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("USDA_API_KEY", "")
    settings.cache_clear()
    yield
    settings.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def image_bytes():
    data = io.BytesIO()
    Image.new("RGB", (40, 40), "green").save(data, "JPEG")
    return data.getvalue()


HEADERS = {"Authorization": "Bearer test-internal-key"}
NUTRIENTS = {"calories": 100, "protein": 5, "carbs": 12, "fat": 3, "fiber": 2, "sugar": None, "sodium": 30}


def test_health_is_public_but_ai_requires_internal_token(client):
    assert client.get("/health").status_code == 200
    assert client.post("/ai/estimate-nutrition", json={"query": "rice"}).status_code == 401


def test_missing_provider_is_explicit_configuration_error(client):
    response = client.post("/ai/recognize-food", headers=HEADERS, files={"image": ("food.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


@pytest.mark.parametrize("data,mime,status", [(b"not an image", "image/jpeg", 400), (b"text", "text/plain", 415), (b"", "image/jpeg", 400)])
def test_invalid_images_are_rejected(client, data, mime, status):
    response = client.post("/ai/recognize-food", headers=HEADERS, files={"image": ("image.jpg", data, mime)})
    assert response.status_code == status


def test_mismatched_image_mime(client):
    response = client.post("/ai/recognize-food", headers=HEADERS, files={"image": ("image.png", image_bytes(), "image/png")})
    assert response.status_code == 415


def test_oversize_image(client, monkeypatch):
    monkeypatch.setenv("MAX_IMAGE_BYTES", "1024")
    settings.cache_clear()
    response = client.post("/ai/recognize-food", headers=HEADERS, files={"image": ("food.jpg", b"x" * 2048, "image/jpeg")})
    assert response.status_code == 413


def test_multi_food_analysis_scales_portions_and_does_not_invent_confidence(client, monkeypatch):
    import app.api.routes as routes

    async def provider(*args):
        return VisionResponse.model_validate({"items": [{"name": "Rice", "portion_grams": 200, "nutrition_per_100g": NUTRIENTS}, {"name": "Dal", "portion_grams": 100, "nutrition_per_100g": NUTRIENTS}], "warnings": ["No scale reference."]})

    monkeypatch.setattr(routes, "structured_response", provider)
    response = client.post("/ai/recognize-food", headers=HEADERS, files={"image": ("food.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 200
    result = response.json()
    assert len(result["items"]) == 2
    assert result["totals"]["calories"] == 300
    assert result["totals"]["sugar"] is None
    assert result["items"][0]["confidence"] is None
    assert result["items"][0]["is_estimate"] is True
    assert "AI estimate" in result["items"][0]["source"]


def test_unknown_food_is_empty_with_explanation(client, monkeypatch):
    import app.api.routes as routes

    async def provider(*args):
        return VisionResponse(items=[], warnings=["No food was visible."])

    monkeypatch.setattr(routes, "structured_response", provider)
    response = client.post("/ai/recognize-food", headers=HEADERS, files={"image": ("food.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert "No food was visible." in response.json()["warnings"]


def test_manual_estimate_normalizes_total_weight(client, monkeypatch):
    import app.api.routes as routes

    async def provider(*args):
        return VisionResponse.model_validate({"items": [{"name": "Dal", "portion_grams": 200, "nutrition_per_100g": NUTRIENTS}], "warnings": []})

    monkeypatch.setattr(routes, "structured_response", provider)
    response = client.post("/ai/estimate-nutrition", headers=HEADERS, json={"query": "dal", "portion_grams": 150})
    assert response.status_code == 200
    assert response.json()["items"][0]["portion_grams"] == 150
    assert response.json()["totals"]["calories"] == 150


def test_usda_map_and_nutrition_units():
    result = nutrient_map([{"nutrientId": 1008, "value": 120}, {"nutrient": {"id": 1093}, "amount": 500}, {"nutrientId": 1003, "value": "bad"}])
    assert result["calories"] == 120
    assert result["sodium"] == 500
    assert result["protein"] is None
    assert scale_nutrition(NUTRIENTS, 250)["sodium"] == 75


@pytest.mark.asyncio
async def test_usda_matching_ranks_plain_rice_ahead_of_rice_noodles(monkeypatch):
    from app.services.nutrition import usda_match
    monkeypatch.setenv("USDA_API_KEY", "test-usda-key")
    settings.cache_clear()
    nutrients = [{"nutrientId": key, "value": value} for key, value in [(1008, 130), (1003, 2.7), (1004, 0.3), (1005, 28)]]

    class USDAClient:
        async def post(self, url, **kwargs):
            assert kwargs["json"]["dataType"] == ["Foundation", "SR Legacy", "Survey (FNDDS)"]
            assert kwargs["headers"]["X-Api-Key"] == "test-usda-key"
            assert "api_key" not in url
            return httpx.Response(200, request=httpx.Request("POST", url), json={"foods": [
                {"fdcId": 1, "description": "Rice noodles, cooked", "foodNutrients": nutrients},
                {"fdcId": 2, "description": "Rice, cooked, NFS", "foodNutrients": nutrients},
            ]})

    result = await usda_match(USDAClient(), "rice cooked")
    assert result["id"] == "2"


@pytest.mark.asyncio
async def test_invalid_provider_data_is_a_gateway_error(monkeypatch):
    import app.services.provider as provider
    monkeypatch.setenv("OPENAI_API_KEY", "test-provider-key")
    settings.cache_clear()

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, *args, **kwargs):
            assert kwargs["json"]["store"] is False
            return httpx.Response(200, json={"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": '{"items":[{"name":"incomplete"}],"warnings":[]}'}]}]})

    monkeypatch.setattr(provider.httpx, "AsyncClient", FakeClient)
    with pytest.raises(HTTPException) as error:
        await provider.structured_response(VisionResponse, "Food", [])
    assert error.value.status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_error,expected", [
    ({"code": "credit_balance_exhausted", "type": "insufficient_quota"}, "OpenAI API credits are exhausted. Add credits in API billing, then retry."),
    ({"code": "insufficient_quota"}, "OpenAI API credits are exhausted. Add credits in API billing, then retry."),
    ({"type": "insufficient_quota"}, "OpenAI API credits are exhausted. Add credits in API billing, then retry."),
    ({"code": "project_spend_limit_exceeded", "type": "insufficient_quota"}, "The OpenAI project spend limit has been reached. Ask your project administrator to increase it, or wait for the monthly limit to reset."),
    ({"code": "organization_spend_limit_exceeded", "type": "insufficient_quota"}, "The OpenAI organization spend limit has been reached. Ask your organization administrator to increase it, or wait for the monthly limit to reset."),
    ({"code": "organization_usage_limit_exceeded", "type": "insufficient_quota"}, "The OpenAI organization API usage limit has been reached. Request a higher approved usage limit or contact your organization administrator."),
    ({"code": "rate_limit_exceeded", "type": "rate_limit_error"}, "OpenAI is temporarily rate limited. Wait briefly, then retry."),
    ({"code": "slow_down", "type": "rate_limit_error"}, "OpenAI request traffic increased too quickly. Wait briefly, then retry."),
    ({"code": "future_unknown_limit", "type": "insufficient_quota"}, "The AI provider is at its rate or quota limit. Please retry later."),
    ({"code": ["malformed-code"]}, "The AI provider is at its rate or quota limit. Please retry later."),
])
async def test_provider_429_reports_actionable_cause_without_leaking_upstream_text(monkeypatch, provider_error, expected):
    import app.services.provider as provider
    monkeypatch.setenv("OPENAI_API_KEY", "test-provider-secret-must-not-leak")
    settings.cache_clear()
    upstream_secret = "Upstream diagnostic containing sk-secret-and-private-project-id"

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, *args, **kwargs):
            return httpx.Response(429, json={"error": {**provider_error, "message": upstream_secret}})

    monkeypatch.setattr(provider.httpx, "AsyncClient", FakeClient)
    with pytest.raises(HTTPException) as error:
        await provider.structured_response(VisionResponse, "Food", [])
    assert error.value.status_code == 503
    assert error.value.detail == expected
    assert upstream_secret not in error.value.detail
    assert "test-provider-secret" not in error.value.detail


@pytest.mark.asyncio
@pytest.mark.parametrize("response_body", ["not JSON", "[]", '{"error":null}', '{"error":"private upstream diagnostics"}'])
async def test_malformed_provider_429_keeps_generic_unavailable_contract(monkeypatch, response_body):
    import app.services.provider as provider
    monkeypatch.setenv("OPENAI_API_KEY", "test-provider-key")
    settings.cache_clear()

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, *args, **kwargs):
            return httpx.Response(429, text=response_body)

    monkeypatch.setattr(provider.httpx, "AsyncClient", FakeClient)
    with pytest.raises(HTTPException) as error:
        await provider.structured_response(VisionResponse, "Food", [])
    assert error.value.status_code == 503
    assert error.value.detail == "The AI provider is at its rate or quota limit. Please retry later."


def test_negative_portions_rejected(client):
    response = client.post("/ai/estimate-nutrition", headers=HEADERS, json={"query": "dal", "portion_grams": -1})
    assert response.status_code == 422


@pytest.mark.parametrize("path,payload", [
    ("/ai/estimate-nutrition", {"query": "dal", "portion_grams": 100}),
    ("/ai/nutrition-assistant", {"message": "Suggest lunch", "history": []}),
    ("/ai/recommend-recipe", {"query": "vegetarian lunch"}),
    ("/ai/recommend-food", {"query": "balanced lunch"}),
])
def test_django_proxy_personalization_contract(client, path, payload):
    # A missing key must reach provider configuration validation (503), not
    # fail request parsing (422) because Django added saved preferences.
    payload.update(preferences=["Vegetarian"], allergies=["Peanuts"])
    response = client.post(path, headers=HEADERS, json=payload)
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_provider_output_schemas_meet_structured_output_requirements():
    from app.schemas.food import AssistantResponse, RecommendationResponse, RecipeResponse

    def check(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                assert node.get("additionalProperties") is False
                assert set(node.get("required", [])) == set(node.get("properties", {}))
            for value in node.values():
                check(value)
        elif isinstance(node, list):
            for value in node:
                check(value)

    for schema in (VisionResponse, AssistantResponse, RecommendationResponse, RecipeResponse):
        check(schema.model_json_schema())
