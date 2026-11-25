from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from accounts import views as auth
from meals.views import MealViewSet
from goals.views import GoalView, WaterViewSet
from analytics.views import DailyView, PeriodView, MonthlyView, AnalyticsView, ExportView
from nutrition.views import (FoodViewSet, AIProxyView, BarcodeView, PrivateMealImageView, WeightViewSet, NotificationViewSet,
    AchievementsView, AdminSummaryView, AdminUserViewSet, AdminFoodViewSet, AdminPerformanceView, AdminSubscriptionViewSet)

router = DefaultRouter()
router.register("meals", MealViewSet, basename="meals")
router.register("foods", FoodViewSet, basename="foods")
router.register("water", WaterViewSet, basename="water")
router.register("users/weight-history", WeightViewSet, basename="weight-history")
router.register("notifications", NotificationViewSet, basename="notifications")
router.register("admin/users", AdminUserViewSet, basename="admin-users")
router.register("admin/foods", AdminFoodViewSet, basename="admin-foods")
router.register("admin/subscriptions", AdminSubscriptionViewSet, basename="admin-subscriptions")

class AuthConfigView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        return Response({"google_enabled": bool(settings.GOOGLE_CLIENT_ID), "apple_enabled": bool(settings.APPLE_CLIENT_ID), "email_verification_required": settings.REQUIRE_EMAIL_VERIFICATION})

def health(request):
    try:
        connection.ensure_connection()
        return JsonResponse({"status": "ok", "service": "django-api", "database": "connected"})
    except Exception:
        return JsonResponse({"status": "unhealthy", "service": "django-api", "database": "unavailable"}, status=503)

urlpatterns = [
    path("admin/", admin.site.urls), path("health/", health),
    path("api/auth/register/", auth.RegisterView.as_view()), path("api/auth/login/", auth.LoginView.as_view()),
    path("api/auth/csrf/", auth.CsrfView.as_view()), path("api/auth/config/", AuthConfigView.as_view()),
    path("api/auth/refresh/", auth.RefreshView.as_view()), path("api/auth/logout/", auth.LogoutView.as_view()),
    path("api/auth/forgot-password/", auth.ForgotPasswordView.as_view()), path("api/auth/reset-password/", auth.ResetPasswordView.as_view()),
    path("api/auth/verify-email/", auth.VerifyEmailView.as_view()), path("api/auth/resend-verification/", auth.ResendVerificationView.as_view()),
    path("api/auth/google/", auth.OAuthView.as_view(), {"provider": "google"}), path("api/auth/apple/", auth.OAuthView.as_view(), {"provider": "apple"}),
    path("api/users/profile/", auth.ProfileView.as_view()),
    path("api/nutrition/daily/", DailyView.as_view()), path("api/nutrition/weekly/", PeriodView.as_view()), path("api/nutrition/monthly/", MonthlyView.as_view()),
    path("api/analytics/", AnalyticsView.as_view()), path("api/goals/", GoalView.as_view()), path("api/reports/export/", ExportView.as_view()),
    path("api/ai/<str:operation>/", AIProxyView.as_view()), path("api/integrations/barcode/", BarcodeView.as_view()),
    path("api/meals/<int:pk>/image/", PrivateMealImageView.as_view()), path("api/achievements/", AchievementsView.as_view()),
    path("api/admin/summary/", AdminSummaryView.as_view()), path("api/admin/performance/", AdminPerformanceView.as_view()),
    path("api/", include(router.urls)),
]
