import io
from unittest.mock import patch
import pytest
from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from meals.models import Meal, MealItem, FoodRecognitionResult
from accounts.models import UserProfile
from goals.models import NutritionGoal, WaterIntake

pytestmark = pytest.mark.django_db
PASSWORD = "M0onriver!42pine"

@pytest.fixture
def user():
    user = get_user_model().objects.create_user(email="sam@example.com", password=PASSWORD, full_name="Sam Lee")
    UserProfile.objects.create(user=user, timezone="Asia/Kolkata")
    NutritionGoal.objects.create(user=user)
    return user

@pytest.fixture
def client(user):
    client = APIClient()
    response = client.post("/api/auth/login/", {"email": user.email, "password": PASSWORD}, format="json")
    assert response.status_code == 200
    client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
    return client

def meal_payload():
    return {"name": "Home lunch", "meal_type": "lunch", "eaten_at": timezone.now().isoformat(), "items": [{"name": "Rice", "portion_g": 100, "calories": 130, "protein": 2.7, "carbohydrates": 28, "fat": .3, "fiber": .4, "source": "User corrected"}]}

def test_registration_hashes_password_and_profile():
    client = APIClient()
    response = client.post("/api/auth/register/", {"email": "NEW@EXAMPLE.COM", "password": PASSWORD, "full_name": "New User"}, format="json")
    assert response.status_code == 201
    user = get_user_model().objects.get(email="new@example.com")
    assert user.check_password(PASSWORD) and user.password != PASSWORD
    assert user.profile and user.nutrition_goal
    assert "refresh" not in response.data
    assert response.cookies["nutrivision_refresh"]["httponly"]
    assert response.data["user"]["is_staff"] is False

def test_weak_password_rejected():
    response = APIClient().post("/api/auth/register/", {"email": "bad@example.com", "password": "123", "full_name": "Bad"}, format="json")
    assert response.status_code == 400
    assert "password" in response.data

def test_authentication_required_and_login_failure():
    assert APIClient().get("/api/meals/").status_code == 401
    assert APIClient().post("/api/auth/login/", {"email": "nobody@example.com", "password": "wrong"}, format="json").status_code == 401

def test_profile_validation_weight_history_and_privilege_boundary(client, user):
    response = client.patch("/api/users/profile/", {"full_name": "Updated", "is_staff": True, "profile": {"weight_kg": 72, "allergies": ["peanuts"]}}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.full_name == "Updated" and not user.is_staff
    assert user.profile.weight_kg == 72
    assert user.weight_history.count() == 1
    bad = client.patch("/api/users/profile/", {"profile": {"timezone": "MadeUp/Zone", "height_cm": -1}}, format="json")
    assert bad.status_code == 400

def test_meal_totals_portion_rescaling_and_daily(client):
    response = client.post("/api/meals/", meal_payload(), format="json")
    assert response.status_code == 201
    meal_id = response.data["id"]
    item_id = response.data["items"][0]["id"]
    assert response.data["totals"]["calories"] == 130
    response = client.patch(f"/api/meals/{meal_id}/", {"items": [{"id": item_id, "portion_g": 200}]}, format="json")
    assert response.status_code == 200
    assert response.data["totals"]["calories"] == 260
    assert response.data["totals"]["protein"] == 5.4
    daily = client.get("/api/nutrition/daily/")
    assert daily.status_code == 200
    assert daily.data["totals"]["calories"] == 260
    assert len(daily.data["meals"]) == 1

def test_meal_aliases_accept_ai_shape(client):
    payload = meal_payload()
    payload["items"] = [{"name": "Dal", "portion_grams": 150, "nutrition": {"calories": 180, "protein": 9, "carbs": 25, "fat": 3}, "is_estimate": True}]
    response = client.post("/api/meals/", payload, format="json")
    assert response.status_code == 201
    assert response.data["items"][0]["portion_g"] == 150
    assert response.data["totals"]["carbohydrates"] == 25

def test_private_meals_and_foreign_item_protected(client, user):
    other = get_user_model().objects.create_user(email="other@example.com", password=PASSWORD)
    foreign = Meal.objects.create(user=other, name="Private", meal_type="dinner")
    item = MealItem.objects.create(meal=foreign, name="Private food", portion_g=100, calories=500)
    assert client.get(f"/api/meals/{foreign.pk}/").status_code == 404
    assert client.patch(f"/api/meals/{foreign.pk}/", {"name": "hacked"}, format="json").status_code == 404
    assert client.delete(f"/api/meals/{foreign.pk}/").status_code == 404
    payload = meal_payload()
    payload["items"] = [{"id": item.pk, "portion_g": 200}]
    assert client.post("/api/meals/", payload, format="json").status_code == 400
    assert Meal.objects.filter(user=user).count() == 0
    assert client.get("/api/nutrition/daily/").data["totals"]["calories"] == 0

def test_empty_meals_negative_nutrients_and_invalid_goal(client):
    payload = meal_payload()
    payload["items"] = []
    assert client.post("/api/meals/", payload, format="json").status_code == 400
    payload = meal_payload()
    payload["items"][0]["calories"] = -5
    assert client.post("/api/meals/", payload, format="json").status_code == 400
    assert client.put("/api/goals/", {"calories": 0}, format="json").status_code == 400

def test_water_and_daily_goals_are_user_scoped(client, user):
    assert client.post("/api/water/", {"amount_ml": 250}, format="json").status_code == 201
    other = get_user_model().objects.create_user(email="water@example.com", password=PASSWORD)
    foreign = WaterIntake.objects.create(user=other, amount_ml=1500)
    assert client.delete(f"/api/water/{foreign.pk}/").status_code == 404
    assert client.get("/api/nutrition/daily/").data["water_ml"] == 250
    assert client.put("/api/goals/", {"calories": 2250, "water_ml": 3000}, format="json").status_code == 200
    assert client.get("/api/nutrition/daily/").data["goals"]["calories"] == 2250

def test_analytics_reports_and_meal_filtering(client):
    client.post("/api/meals/", meal_payload(), format="json")
    result = client.get("/api/analytics/?period=week")
    assert result.status_code == 200 and len(result.data["days"]) == 7
    assert result.data["totals"]["calories"] == 130
    assert result.data["logged_days"] == 1
    assert client.get("/api/analytics/?period=invalid").status_code == 400
    assert client.get("/api/meals/?date=bad").status_code == 400
    csv_response = client.get("/api/reports/export/?format=csv")
    assert csv_response.status_code == 200 and b"Rice" in csv_response.content
    pdf_response = client.get("/api/reports/export/?format=pdf")
    assert pdf_response.status_code == 200
    assert b"".join(pdf_response.streaming_content).startswith(b"%PDF")

def test_admin_permissions_and_staff_summary(client, user):
    assert client.get("/api/admin/summary/").status_code == 403
    assert client.get("/api/admin/users/").status_code == 403
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    response = client.get("/api/admin/summary/")
    assert response.status_code == 200 and response.data["users"] == 1
    assert client.patch(f"/api/admin/users/{user.pk}/", {"is_active": False}, format="json").status_code == 400
    assert client.post("/api/admin/foods/", {"name": "Imported food", "source": "USDA", "nutrition": {"calories": 50, "basis_grams": 100}}, format="json").status_code == 201
    assert client.get("/api/foods/search/?q=Imported").data["count"] == 1

def test_invalid_uploads_rejected_before_upstream(client):
    upload = SimpleUploadedFile("fake.jpg", b"not image", content_type="image/jpeg")
    assert client.post("/api/ai/recognize/", {"image": upload}, format="multipart").status_code == 400
    assert client.post("/api/ai/recognize/", {}, format="multipart").status_code == 400

def test_ai_unconfigured_returns_explicit_service_error(client, settings):
    settings.INTERNAL_SERVICE_TOKEN = ""
    image = io.BytesIO()
    Image.new("RGB", (12,12), "red").save(image, format="PNG")
    upload = SimpleUploadedFile("food.png", image.getvalue(), content_type="image/png")
    response = client.post("/api/ai/recognize/", {"image": upload}, format="multipart")
    assert response.status_code == 503
    assert "configured" in response.data["detail"]

def test_recognition_result_cannot_link_other_user(client, user):
    other = get_user_model().objects.create_user(email="recognition@example.com", password=PASSWORD)
    recognition = FoodRecognitionResult.objects.create(user=other, result={})
    payload = meal_payload()
    payload["recognition_id"] = recognition.pk
    assert client.post("/api/meals/", payload, format="json").status_code == 400

def test_refresh_csrf_rotation_and_logout_revoke_access(user):
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/auth/csrf/").data["csrfToken"]
    login = client.post("/api/auth/login/", {"email": user.email, "password": PASSWORD}, format="json", HTTP_X_CSRFTOKEN=csrf)
    access = login.data["access"]
    old_refresh = client.cookies["nutrivision_refresh"].value
    assert client.post("/api/auth/refresh/", {}, format="json").status_code == 403
    csrf = client.get("/api/auth/csrf/").data["csrfToken"]
    response = client.post("/api/auth/refresh/", {}, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert response.status_code == 200
    assert client.cookies["nutrivision_refresh"].value != old_refresh
    client.credentials(HTTP_AUTHORIZATION="Bearer "+access)
    assert client.post("/api/auth/logout/", {}, format="json").status_code == 200
    assert client.get("/api/users/profile/").status_code == 401
