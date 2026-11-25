from django.db import transaction
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from .models import Meal
from .serializers import MealSerializer
from analytics.services import parse_date, bounds
from notifications.services import broadcast, award

class MealViewSet(viewsets.ModelViewSet):
    serializer_class = MealSerializer
    search_fields = ["name", "items__name", "notes"]
    ordering_fields = ["eaten_at", "created_at", "name"]
    filterset_fields = ["meal_type"]

    def get_queryset(self):
        queryset = Meal.objects.filter(user=self.request.user).prefetch_related("items", "items__food")
        if self.action in {"update", "partial_update", "destroy"}:
            queryset = queryset.select_for_update()
        params = self.request.query_params
        if params.get("date"):
            start, end = bounds(self.request.user, parse_date(params["date"]))
            queryset = queryset.filter(eaten_at__gte=start, eaten_at__lt=end)
        if params.get("start"):
            start, _ = bounds(self.request.user, parse_date(params["start"]))
            queryset = queryset.filter(eaten_at__gte=start)
        if params.get("end"):
            _, end = bounds(self.request.user, parse_date(params["end"]))
            queryset = queryset.filter(eaten_at__lt=end)
        return queryset

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        meal = serializer.save()
        award(self.request.user, "first_meal", "First meal logged")
        if Meal.objects.filter(user=self.request.user).count() >= 5:
            award(self.request.user, "five_meals", "Five meals, one healthy habit")
        broadcast(self.request.user.pk)

    @transaction.atomic
    def perform_update(self, serializer):
        serializer.save()
        broadcast(self.request.user.pk)

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.image: instance.image.delete(save=False)
        instance.delete()
        broadcast(self.request.user.pk)
