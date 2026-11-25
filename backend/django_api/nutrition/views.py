import logging
import time
import httpx
from PIL import Image
from django.conf import settings
from django.http import FileResponse
from django.db.models import Avg, Count, Q
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .models import Food
from .serializers import FoodSerializer
from meals.models import Meal, FoodRecognitionResult, AIAnalysisLog
from meals.serializers import validate_image
from accounts.models import WeightHistory, UserProfile
from subscriptions.models import Subscription
from notifications.models import Notification, UserAchievement
from notifications.services import broadcast

logger = logging.getLogger(__name__)

class FoodViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FoodSerializer
    queryset = Food.objects.select_related("nutrition", "category").all()
    search_fields = ["name", "category__name"]
    @action(detail=False, methods=["get"])
    def search(self, request):
        queryset = self.get_queryset()
        query = request.query_params.get("q", request.query_params.get("search", "")).strip()
        if query: queryset = queryset.filter(name__icontains=query)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

class UpstreamError(Exception):
    def __init__(self, detail, code): self.detail, self.code = detail, code

def service_request(base, path, payload=None, image=None):
    if not settings.INTERNAL_SERVICE_TOKEN:
        raise UpstreamError("Internal service authentication is not configured. Set INTERNAL_SERVICE_TOKEN on all services.", 503)
    kwargs = {"headers": {"Authorization": f"Bearer {settings.INTERNAL_SERVICE_TOKEN}"}}
    if image:
        validate_image(image)
        image.seek(0)
        mime = Image.open(image).get_format_mimetype()
        image.seek(0)
        kwargs["files"] = {"image": ("food-image", image, mime)}
        kwargs["data"] = payload or {}
    else: kwargs["json"] = payload or {}
    try:
        with httpx.Client(timeout=httpx.Timeout(100, connect=10)) as client:
            response = client.post(f"{base}{path}", **kwargs)
        try: data = response.json()
        except ValueError: raise UpstreamError("The upstream service returned an unreadable response.", 502)
        if response.is_error:
            detail = data.get("detail", "The service could not complete this request.")
            if isinstance(detail, list): detail = "The service rejected the request. Check the submitted food or message."
            if response.status_code == 401:
                detail = "Internal service authentication failed. Check matching service tokens."
            raise UpstreamError(detail, response.status_code if response.status_code in {400,404,413,422,429,503} else 502)
        if not isinstance(data, dict): raise UpstreamError("The service returned an invalid response.", 502)
        return data
    except httpx.TimeoutException: raise UpstreamError("The analysis service timed out. Please retry.", 504)
    except httpx.RequestError: raise UpstreamError("The service is unavailable. Check that the AI and integration services are running.", 503)

class AIProxyView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"
    operations = {"recognize": "/ai/recognize-food", "analyze": "/ai/analyze-meal", "estimate": "/ai/estimate-nutrition", "assistant": "/ai/nutrition-assistant", "recipes": "/ai/recommend-recipe", "recommendations": "/ai/recommend-food"}
    def post(self, request, operation):
        if operation not in self.operations: return Response({"detail": "Unknown AI operation."}, status=404)
        start = time.monotonic()
        image = request.FILES.get("image") if operation in {"recognize", "analyze"} else None
        if operation in {"recognize", "analyze"} and image is None: raise ValidationError({"image": "Upload a food image."})
        if image is not None: validate_image(image)
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        payload = {"context": str(request.data.get("context", ""))[:1500]} if image else dict(request.data)
        if not image:
            payload.setdefault("preferences", profile.dietary_preferences)
            payload.setdefault("allergies", profile.allergies)
        try:
            data = service_request(settings.AI_SERVICE_URL, self.operations[operation], payload, image)
        except UpstreamError as exc:
            AIAnalysisLog.objects.create(user=request.user, operation=operation, latency_ms=int((time.monotonic()-start)*1000), error_code=str(exc.code))
            return Response({"detail": exc.detail}, status=exc.code)
        log = AIAnalysisLog.objects.create(user=request.user, operation=operation, model=str(data.get("model", ""))[:100], success=True, latency_ms=int((time.monotonic()-start)*1000), item_count=len(data.get("items", [])))
        if operation in {"recognize", "analyze", "estimate"}:
            result = FoodRecognitionResult.objects.create(user=request.user, result=data, model=log.model)
            data["recognition_id"] = result.pk
        return Response(data)

class BarcodeView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai"
    def post(self, request):
        barcode = str(request.data.get("barcode", ""))
        if not barcode.isdigit() or len(barcode) not in {8,12,13,14}: raise ValidationError({"barcode": "Use an 8, 12, 13 or 14 digit barcode."})
        try: data = service_request(settings.INTEGRATIONS_SERVICE_URL, "/integrations/barcode/", {"barcode": barcode, "portion_grams": request.data.get("portion_grams", 100)})
        except UpstreamError as exc: return Response({"detail": exc.detail}, status=exc.code)
        return Response(data)

class PrivateMealImageView(APIView):
    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        meal = get_object_or_404(Meal, pk=pk, user=request.user)
        if not meal.image: return Response({"detail": "This meal has no image."}, status=404)
        file = meal.image.open("rb")
        mime = Image.open(file).get_format_mimetype()
        file.seek(0)
        response = FileResponse(file, content_type=mime)
        response["Cache-Control"] = "private, max-age=300"
        response["X-Content-Type-Options"] = "nosniff"
        return response

class WeightSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightHistory
        fields = ["id", "weight_kg", "recorded_at"]
        read_only_fields = ["id", "recorded_at"]

class WeightViewSet(viewsets.ModelViewSet):
    serializer_class = WeightSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    def get_queryset(self): return WeightHistory.objects.filter(user=self.request.user)
    def perform_create(self, serializer):
        entry = serializer.save(user=self.request.user)
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        profile.weight_kg = entry.weight_kg
        profile.save(update_fields=["weight_kg"])
        broadcast(self.request.user.pk)

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "read", "created_at"]
        read_only_fields = ["id", "title", "message", "created_at"]

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    http_method_names = ["get", "patch", "head", "options"]
    def get_queryset(self): return Notification.objects.filter(user=self.request.user)

class AchievementsView(APIView):
    def get(self, request):
        return Response({"results": list(UserAchievement.objects.filter(user=request.user).values("code", "title", "awarded_at"))})

class AdminSummaryView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        return Response({"users": get_user_model().objects.count(), "meals": Meal.objects.count(), "foods": Food.objects.count(), "analyses": AIAnalysisLog.objects.count(), "active_subscriptions": Subscription.objects.filter(status="active").count()})

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "email", "full_name", "is_active", "is_staff", "email_verified", "date_joined"]
        read_only_fields = ["id", "email", "full_name", "is_staff", "email_verified", "date_joined"]

class AdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminUserSerializer
    queryset = get_user_model().objects.all().order_by("-date_joined")
    search_fields = ["email", "full_name"]
    http_method_names = ["get", "patch", "head", "options"]
    def perform_update(self, serializer):
        if serializer.instance.pk == self.request.user.pk and serializer.validated_data.get("is_active") is False:
            raise ValidationError("You cannot deactivate your own account.")
        serializer.save()

class AdminFoodViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = FoodSerializer
    queryset = Food.objects.select_related("nutrition", "category").all()
    search_fields = ["name", "source"]

class AIAnalysisLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAnalysisLog
        exclude = ["user"]

class AdminPerformanceView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        total = AIAnalysisLog.objects.count()
        successful = AIAnalysisLog.objects.filter(success=True).count()
        return Response({"total": total, "successful": successful, "success_rate": round(successful / total * 100, 1) if total else 0,
            "average_latency_ms": round(AIAnalysisLog.objects.aggregate(v=Avg("latency_ms"))["v"] or 0),
            "models": list(AIAnalysisLog.objects.values("model").annotate(count=Count("id")).order_by("-count")),
            "recent": AIAnalysisLogSerializer(AIAnalysisLog.objects.order_by("-created_at")[:50], many=True).data})

class AdminSubscriptionSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    plan = serializers.ChoiceField(choices=["free", "plus", "pro", "family"])
    class Meta:
        model = Subscription
        fields = ["id", "user", "email", "plan", "status", "current_period_end", "updated_at"]
        read_only_fields = ["id", "user", "updated_at"]

class AdminSubscriptionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = AdminSubscriptionSerializer
    queryset = Subscription.objects.select_related("user").order_by("-updated_at")
    http_method_names = ["get", "patch", "head", "options"]
    search_fields = ["user__email", "plan", "status"]
