from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

class NutritionGoal(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="nutrition_goal")
    goal_type = models.CharField(max_length=30, choices=[(x, x) for x in ["weight_loss", "weight_gain", "muscle_gain", "maintenance", "healthy_eating"]], default="healthy_eating")
    calories = models.FloatField(default=2000, validators=[MinValueValidator(500), MaxValueValidator(15000)])
    protein = models.FloatField(default=100, validators=[MinValueValidator(0), MaxValueValidator(1000)])
    carbohydrates = models.FloatField(default=250, validators=[MinValueValidator(0), MaxValueValidator(2000)])
    fat = models.FloatField(default=65, validators=[MinValueValidator(0), MaxValueValidator(1000)])
    water_ml = models.PositiveIntegerField(default=2500, validators=[MinValueValidator(250), MaxValueValidator(15000)])
    target_weight_kg = models.FloatField(null=True, blank=True, validators=[MinValueValidator(15), MaxValueValidator(650)])
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(calories__gt=0, water_ml__gt=0, protein__gte=0, carbohydrates__gte=0, fat__gte=0), name="positive_nutrition_goal")]

class WaterIntake(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="water_intakes")
    amount_ml = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5000)])
    recorded_at = models.DateTimeField(default=timezone.now)
    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["user", "recorded_at"])]
        constraints = [models.CheckConstraint(condition=models.Q(amount_ml__gt=0), name="positive_water_intake")]
