from django.db import transaction
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import NutritionGoal, WaterIntake
from .serializers import GoalSerializer, WaterSerializer
from analytics.services import parse_date, bounds, daily_summary, current_day
from notifications.services import broadcast, award

class GoalView(APIView):
    def get(self, request):
        goal, _ = NutritionGoal.objects.get_or_create(user=request.user)
        return Response(GoalSerializer(goal).data)
    def put(self, request):
        goal, _ = NutritionGoal.objects.get_or_create(user=request.user)
        serializer = GoalSerializer(goal, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        broadcast(request.user.pk)
        return Response(serializer.data)
    patch = put

class WaterViewSet(viewsets.ModelViewSet):
    serializer_class = WaterSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    def get_queryset(self):
        queryset = WaterIntake.objects.filter(user=self.request.user)
        if self.request.query_params.get("date"):
            start,end = bounds(self.request.user, parse_date(self.request.query_params["date"]))
            queryset = queryset.filter(recorded_at__gte=start, recorded_at__lt=end)
        return queryset
    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        summary = daily_summary(self.request.user, current_day(self.request.user), include_meals=False)
        if summary["water_ml"] >= summary["goals"]["water_ml"]:
            award(self.request.user, "water_goal", "Daily hydration goal reached")
        broadcast(self.request.user.pk)
    def perform_destroy(self, instance):
        instance.delete()
        broadcast(self.request.user.pk)
