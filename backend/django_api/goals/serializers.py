from rest_framework import serializers
from .models import NutritionGoal, WaterIntake

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionGoal
        exclude = ["id", "user", "updated_at"]

class WaterSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterIntake
        fields = ["id", "amount_ml", "recorded_at"]
        read_only_fields = ["id"]
