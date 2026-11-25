import asyncio
import io
from unittest.mock import patch
import pytest
from PIL import Image
from channels.testing import WebsocketCommunicator
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import signing, mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from accounts.models import UserProfile
from meals.models import Meal, MealItem
from config.asgi import application

PASSWORD = "Cobalt!garden91"

@pytest.fixture(autouse=True)
def reset_throttles():
    cache.clear()
    yield
    cache.clear()

def create_session():
    user = get_user_model().objects.create_user(email="security@example.com", password=PASSWORD)
    UserProfile.objects.create(user=user)
    client = APIClient()
    response = client.post("/api/auth/login/", {"email": user.email, "password": PASSWORD}, format="json")
    token = response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return user, client, token


@pytest.mark.django_db
def test_sensitive_api_success_and_auth_errors_are_never_cached():
    anonymous = APIClient().get("/api/users/profile/")
    assert anonymous.status_code == 401
    user, authenticated, token = create_session()
    profile = authenticated.get("/api/users/profile/")
    assert profile.status_code == 200
    assert profile.data["email"] == user.email
    for response in [anonymous, profile]:
        directives = {value.strip() for value in response["Cache-Control"].split(",")}
        assert {"private", "no-store", "max-age=0"}.issubset(directives)
        varying = {value.strip().lower() for value in response["Vary"].split(",")}
        assert {"authorization", "cookie"}.issubset(varying)
        assert response["Pragma"] == "no-cache"


@pytest.mark.django_db
@pytest.mark.parametrize("action,expected", [("register", 201), ("login", 200)])
def test_cookie_issuing_auth_rejects_login_csrf(action, expected):
    if action == "login":
        get_user_model().objects.create_user(email="csrf@example.com", password=PASSWORD)
    payload = {"email": "csrf@example.com", "password": PASSWORD, "full_name": "CSRF QA"}
    client = APIClient(enforce_csrf_checks=True)
    url = f"/api/auth/{action}/"
    assert client.post(url, payload, format="json").status_code == 403
    csrf = client.get("/api/auth/csrf/").data["csrfToken"]
    bad_origin = client.post(url, payload, format="json", HTTP_X_CSRFTOKEN=csrf, HTTP_ORIGIN="https://attacker.invalid")
    assert bad_origin.status_code == 403
    response = client.post(url, payload, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert response.status_code == expected
    assert response.cookies["nutrivision_refresh"]["httponly"]


@pytest.mark.django_db
@pytest.mark.parametrize("provider", ["google", "apple"])
def test_oauth_cookie_issuance_also_requires_csrf(provider):
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(f"/api/auth/{provider}/", {"id_token": "untrusted"}, format="json")
    assert response.status_code == 403

@pytest.mark.django_db
def test_password_reset_revokes_existing_sessions_and_email_is_generic(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    user, client, token = create_session()
    response = APIClient().post("/api/auth/forgot-password/", {"email": user.email}, format="json")
    assert response.status_code == 200
    assert len(mail.outbox) == 1 and "reset-password" in mail.outbox[0].body
    absent = APIClient().post("/api/auth/forgot-password/", {"email": "absent@example.com"}, format="json")
    assert response.data == absent.data
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_token = default_token_generator.make_token(user)
    response = APIClient().post("/api/auth/reset-password/", {"uid": uid, "token": reset_token, "password": "Another!garden91"}, format="json")
    assert response.status_code == 200
    assert client.get("/api/users/profile/").status_code == 401
    replay = APIClient().post("/api/auth/reset-password/", {"uid": uid, "token": reset_token, "password": PASSWORD}, format="json")
    assert replay.status_code == 400

@pytest.mark.django_db
def test_signed_email_verification_is_bound_to_current_email():
    user, _, _ = create_session()
    token = signing.dumps({"user_id": user.pk, "email": user.email}, salt="email-verification")
    assert APIClient().post("/api/auth/verify-email/", {"token": token}, format="json").status_code == 200
    user.refresh_from_db()
    assert user.email_verified
    assert APIClient().post("/api/auth/verify-email/", {"token": token+"tamper"}, format="json").status_code == 400

@pytest.mark.django_db
def test_recognition_proxy_retains_source_and_null_nutrients(settings):
    settings.INTERNAL_SERVICE_TOKEN = "test-service-token"
    user, client, _ = create_session()
    image = io.BytesIO()
    Image.new("RGB", (16,16), "green").save(image, format="PNG")
    result = {"items": [{"name": "Lentils", "portion_grams": 150, "nutrition": {"calories": 180, "protein": 11, "carbs": 28, "fat": 1, "fiber": None, "sugar": None, "sodium": None}, "source": "USDA FoodData Central", "source_id": "123", "source_url": "https://fdc.nal.usda.gov/", "is_estimate": True, "confidence": None}], "model": "provider-model", "warnings": ["Portion estimated from image"], "estimated": True}
    with patch("nutrition.views.service_request", return_value=result):
        response = client.post("/api/ai/recognize/", {"image": SimpleUploadedFile("food.png", image.getvalue(), content_type="image/png")}, format="multipart")
    assert response.status_code == 200
    assert response.data["items"][0]["nutrition"]["fiber"] is None
    assert user.foodrecognitionresult_set.filter(pk=response.data["recognition_id"]).exists()
    meal = client.post("/api/meals/", {"name": "Lentil bowl", "meal_type": "lunch", "items": response.data["items"], "recognition_id": response.data["recognition_id"]}, format="json")
    assert meal.status_code == 201
    assert meal.data["items"][0]["fiber"] is None
    assert meal.data["unknown_nutrients"] == ["fiber", "sugar", "sodium"]
    assert meal.data["items"][0]["source"] == "USDA FoodData Central"

@pytest.mark.django_db
def test_database_rejects_nonpositive_portions():
    user, _, _ = create_session()
    meal = Meal.objects.create(user=user, name="Meal", meal_type="lunch")
    with pytest.raises(IntegrityError), transaction.atomic():
        MealItem.objects.create(meal=meal, name="Invalid", portion_g=0)

@pytest.mark.django_db(transaction=True)
def test_websocket_requires_token_and_delivers_only_owner_updates():
    user, client, token = create_session()
    async def scenario():
        socket = WebsocketCommunicator(application, "/ws/nutrition/", headers=[(b"origin", b"http://localhost:5173")])
        connected, _ = await socket.connect()
        assert connected
        await socket.send_json_to({"type": "authenticate", "token": token})
        assert await socket.receive_json_from() == {"type": "authenticated"}
        layer = get_channel_layer()
        await layer.group_send(f"nutrition_{user.pk+1}", {"type": "nutrition_updated", "event": "nutrition.updated"})
        assert await socket.receive_nothing(timeout=.05)
        await layer.group_send(f"nutrition_{user.pk}", {"type": "nutrition_updated", "event": "nutrition.updated"})
        assert await socket.receive_json_from() == {"type": "nutrition.updated"}
        await socket.disconnect()
        bad = WebsocketCommunicator(application, "/ws/nutrition/")
        await bad.connect()
        await bad.send_json_to({"type": "authenticate", "token": "invalid"})
        assert (await bad.receive_output())["code"] == 4401
        await bad.disconnect()
    asyncio.run(scenario())
