import hashlib
import hmac
import json
import time

import httpx
import pytest

from app import create_app
from app.integrations.barcode import valid_barcode


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "INTERNAL_SERVICE_TOKEN": "test-token", "WEBHOOK_SIGNING_SECRET": "webhook-test-secret", "WEBHOOK_DATABASE_PATH": str(tmp_path / "events.sqlite3")})
    return app.test_client()


HEADERS = {"Authorization": "Bearer test-token"}


def test_health_and_service_auth(client):
    assert client.get("/integrations/health").status_code == 200
    assert client.post("/integrations/barcode/", json={"barcode": "3017620422003"}).status_code == 401


@pytest.mark.parametrize("barcode", ["123", "abcdefghijklm", "3017620422004", 3017620422003])
def test_invalid_barcodes_rejected(client, barcode):
    assert client.post("/integrations/barcode/", headers=HEADERS, json={"barcode": barcode}).status_code == 400


def test_valid_checksum():
    assert valid_barcode("3017620422003")
    assert valid_barcode("034000470693")


def test_real_provider_response_mapping_and_sodium_units(client, monkeypatch):
    import app.integrations.barcode as barcode

    def request(url, **kwargs):
        assert url == "https://world.openfoodfacts.org/api/v3/product/3017620422003"
        assert "User-Agent" in kwargs["headers"]
        return httpx.Response(200, request=httpx.Request("GET", url), json={"product": {"product_name": "Test label", "nutriments": {"energy-kcal_100g": 200, "proteins_100g": 5, "carbohydrates_100g": 25, "fat_100g": 9, "sodium_100g": 0.4}}})

    monkeypatch.setattr(barcode.httpx, "get", request)
    response = client.post("/integrations/barcode/", headers=HEADERS, json={"barcode": "3017620422003", "portion_grams": 50})
    assert response.status_code == 200
    item = response.json["item"]
    assert item["nutrition"]["calories"] == 100
    assert item["nutrition"]["sodium"] == 200
    assert item["nutrition"]["fiber"] is None
    assert item["is_estimate"] is False


def test_incomplete_labels_do_not_silently_zero_macros(client, monkeypatch):
    import app.integrations.barcode as barcode
    monkeypatch.setattr(barcode.httpx, "get", lambda *args, **kwargs: httpx.Response(200, request=httpx.Request("GET", args[0]), json={"product": {"product_name": "Missing label", "nutriments": {"energy-kcal_100g": 50}}}))
    response = client.post("/integrations/barcode/", headers=HEADERS, json={"barcode": "3017620422003"})
    assert response.status_code == 422
    assert "protein" in response.json["missing_nutrients"]


def signed_request(body, timestamp=None):
    timestamp = str(timestamp if timestamp is not None else int(time.time()))
    raw = json.dumps(body).encode()
    signature = hmac.new(b"webhook-test-secret", timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return {"data": raw, "content_type": "application/json", "headers": {"X-NutriVision-Timestamp": timestamp, "X-NutriVision-Signature": "sha256=" + signature}}


def test_signed_webhooks_are_recorded_durably_and_replays_rejected(client):
    body = {"provider": "test-adapter", "event_id": "event-1", "event_type": "wearable.sync", "data": {"steps": 1200}}
    response = client.post("/integrations/webhooks/", **signed_request(body))
    assert response.status_code == 202
    assert response.json["processed"] is False
    assert client.post("/integrations/webhooks/", **signed_request(body)).status_code == 409
    assert client.get("/integrations/events/", headers=HEADERS).json["events"][0]["event_id"] == "event-1"


def test_unsigned_and_expired_webhooks_rejected(client):
    body = {"provider": "x", "event_id": "2", "event_type": "event", "data": {}}
    assert client.post("/integrations/webhooks/", json=body).status_code == 401
    assert client.post("/integrations/webhooks/", **signed_request(body, int(time.time()) - 1000)).status_code == 401


def test_bad_signature_rejected(client):
    request = signed_request({"provider": "x", "event_id": "2", "event_type": "event", "data": {}})
    request["headers"]["X-NutriVision-Signature"] = "invalid"
    assert client.post("/integrations/external-callback/", **request).status_code == 401
