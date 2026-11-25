import uuid
from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from nutrition.models import NutrientFields

def private_image_path(instance, filename):
    suffix = filename.rsplit(".", 1)[-1].lower()
    return f"meals/{instance.user_id}/{uuid.uuid4().hex}.{suffix}"

class Meal(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="meals")
    name = models.CharField(max_length=200)
    meal_type = models.CharField(max_length=20, choices=[(v, v.title()) for v in ["breakfast", "lunch", "dinner", "snack"]])
    eaten_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, max_length=2000)
    image = models.ImageField(upload_to=private_image_path, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["-eaten_at", "-id"]
        indexes = [models.Index(fields=["user", "eaten_at"]), models.Index(fields=["user", "meal_type"])]

class MealItem(NutrientFields):
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name="items")
    food = models.ForeignKey("nutrition.Food", on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=200)
    portion_g = models.FloatField(validators=[MinValueValidator(0.1), MaxValueValidator(10000)])
    confidence = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(1)])
    is_estimate = models.BooleanField(default=True)
    source = models.CharField(max_length=200, blank=True)
    source_id = models.CharField(max_length=100, blank=True)
    source_url = models.URLField(blank=True)
    unknown_nutrients = models.JSONField(default=list, blank=True)
    class Meta(NutrientFields.Meta):
        abstract = False
        constraints = NutrientFields.Meta.constraints + [models.CheckConstraint(condition=models.Q(portion_g__gt=0), name="meal_item_portion_positive")]

class FoodRecognitionResult(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    meal = models.OneToOneField(Meal, on_delete=models.SET_NULL, null=True, blank=True)
    result = models.JSONField(default=dict)
    model = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class AIAnalysisLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    operation = models.CharField(max_length=80)
    model = models.CharField(max_length=100, blank=True)
    success = models.BooleanField(default=False)
    latency_ms = models.PositiveIntegerField(default=0)
    error_code = models.CharField(max_length=30, blank=True)
    item_count = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
