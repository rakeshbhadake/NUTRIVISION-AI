from io import BytesIO
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.db import transaction
from rest_framework import serializers
from nutrition.models import NUTRIENTS
from .models import Meal, MealItem, FoodRecognitionResult

def validate_image(value):
    if value.size > settings.MAX_IMAGE_BYTES: raise serializers.ValidationError("Image must be 8 MB or smaller.")
    try:
        image = Image.open(value)
        if image.format not in {"JPEG", "PNG", "WEBP"}: raise serializers.ValidationError("Use a JPEG, PNG or WebP image.")
        if image.width * image.height > 20_000_000: raise serializers.ValidationError("Image resolution is too large (20 megapixel maximum).")
        image.verify()
        value.seek(0)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise serializers.ValidationError("The uploaded file is not a valid image.")
    return value

class MealItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=200, required=False)
    portion_g = serializers.FloatField(min_value=0.1, max_value=10000, required=False)
    unknown_nutrients = serializers.ListField(child=serializers.ChoiceField(choices=NUTRIENTS), required=False)
    class Meta:
        model = MealItem
        exclude = ["meal"]

    def to_internal_value(self, data):
        data = dict(data)
        if "portion_grams" in data: data["portion_g"] = data.pop("portion_grams")
        nutrition = data.pop("nutrition", None)
        if isinstance(nutrition, dict): data.update(nutrition)
        if "carbs" in data: data["carbohydrates"] = data.pop("carbs")
        return super().to_internal_value(data)

class MealSerializer(serializers.ModelSerializer):
    items = MealItemSerializer(many=True)
    totals = serializers.SerializerMethodField()
    recognition_id = serializers.IntegerField(required=False, write_only=True)
    image = serializers.ImageField(required=False, write_only=True)
    image_available = serializers.SerializerMethodField()
    unknown_nutrients = serializers.SerializerMethodField()
    class Meta:
        model = Meal
        fields = ["id", "name", "meal_type", "eaten_at", "notes", "image", "image_available", "items", "totals", "unknown_nutrients", "recognition_id", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_totals(self, obj):
        items = list(obj.items.all())
        return {n: round(sum(getattr(i, n) or 0 for i in items), 2) for n in NUTRIENTS}
    def get_unknown_nutrients(self, obj):
        items = list(obj.items.all())
        return [n for n in NUTRIENTS if any(getattr(i, n) is None or n in i.unknown_nutrients for i in items)]
    def get_image_available(self, obj): return bool(obj.image)
    def validate_image(self, value): return validate_image(value)
    def validate_items(self, value):
        if not 1 <= len(value) <= 50: raise serializers.ValidationError("A meal must have between 1 and 50 items.")
        ids = [v["id"] for v in value if "id" in v]
        if len(ids) != len(set(ids)): raise serializers.ValidationError("Duplicate item IDs are not allowed.")
        return value
    def validate_recognition_id(self, value):
        if not FoodRecognitionResult.objects.filter(pk=value, user=self.context["request"].user).exists():
            raise serializers.ValidationError("Recognition result not found.")
        return value

    def _persist_items(self, meal, items):
        existing = {i.pk: i for i in meal.items.all()}
        kept = []
        for data in items:
            item_id = data.pop("id", None)
            if item_id is not None:
                if item_id not in existing: raise serializers.ValidationError({"items": "Item does not belong to this meal."})
                item = existing[item_id]
                factor = data.get("portion_g", item.portion_g) / item.portion_g
                for nutrient in NUTRIENTS:
                    previous = getattr(item, nutrient)
                    data.setdefault(nutrient, round(previous * factor, 4) if previous is not None else None)
                data["unknown_nutrients"] = [n for n in NUTRIENTS if data.get(n) is None]
                for key, value in data.items(): setattr(item, key, value)
                item.save()
            else:
                if not data.get("name") or not data.get("portion_g"):
                    raise serializers.ValidationError({"items": "New items require a name and portion_g."})
                food = data.get("food")
                if food and hasattr(food, "nutrition"):
                    for nutrient in NUTRIENTS:
                        value = getattr(food.nutrition, nutrient)
                        data.setdefault(nutrient, value * data["portion_g"] / food.nutrition.basis_grams if value is not None else None)
                data["unknown_nutrients"] = [n for n in ("fiber", "sugar", "sodium") if data.get(n) is None]
                item = MealItem.objects.create(meal=meal, **data)
            kept.append(item.pk)
        meal.items.exclude(pk__in=kept).delete()

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        recognition_id = validated_data.pop("recognition_id", None)
        meal = Meal.objects.create(user=self.context["request"].user, **validated_data)
        self._persist_items(meal, items)
        if recognition_id:
            FoodRecognitionResult.objects.filter(pk=recognition_id, user=meal.user).update(meal=meal)
        return meal

    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        validated_data.pop("recognition_id", None)
        instance = super().update(instance, validated_data)
        if items is not None: self._persist_items(instance, items)
        if hasattr(instance, "_prefetched_objects_cache"): instance._prefetched_objects_cache = {}
        return instance
