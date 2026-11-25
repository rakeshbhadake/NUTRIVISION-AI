from rest_framework import serializers
from django.db import transaction
from .models import Food, FoodCategory, NutritionInformation

class NutritionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionInformation
        exclude = ["id", "food"]

class FoodSerializer(serializers.ModelSerializer):
    nutrition = NutritionSerializer(required=False)
    source_id = serializers.CharField(required=False, allow_blank=True, default="", max_length=100)
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    class Meta:
        model = Food
        fields = ["id", "name", "category", "category_name", "source", "source_id", "source_url", "nutrition"]

    @transaction.atomic
    def create(self, validated_data):
        nutrition = validated_data.pop("nutrition", {})
        food = Food.objects.create(**validated_data)
        NutritionInformation.objects.create(food=food, **nutrition)
        return food

    @transaction.atomic
    def update(self, instance, validated_data):
        nutrition_data = validated_data.pop("nutrition", None)
        instance = super().update(instance, validated_data)
        if nutrition_data is not None:
            info, _ = NutritionInformation.objects.get_or_create(food=instance)
            for key, value in nutrition_data.items(): setattr(info, key, value)
            info.save()
        return instance
