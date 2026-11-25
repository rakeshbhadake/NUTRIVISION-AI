from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from goals.models import NutritionGoal
from .models import UserProfile, WeightHistory

User = get_user_model()

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        exclude = ["id", "user", "updated_at"]

    def validate_timezone(self, value):
        try: ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError): raise serializers.ValidationError("Choose a valid IANA timezone.")
        return value

    def validate_list(self, value):
        if not isinstance(value, list) or len(value) > 30 or any(not isinstance(v, str) or len(v) > 80 for v in value):
            raise serializers.ValidationError("Use a list of up to 30 short names.")
        return [v.strip() for v in value if v.strip()]

    def validate_dietary_preferences(self, value): return self.validate_list(value)
    def validate_allergies(self, value): return self.validate_list(value)

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "is_staff", "email_verified", "date_joined", "profile"]
        read_only_fields = ["id", "email", "is_staff", "email_verified", "date_joined"]

    @transaction.atomic
    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        instance = super().update(instance, validated_data)
        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            old_weight = profile.weight_kg
            for key, value in profile_data.items(): setattr(profile, key, value)
            profile.save()
            if profile.weight_kg is not None and profile.weight_kg != old_weight:
                WeightHistory.objects.create(user=instance, weight_kg=profile.weight_kg)
        return instance

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=160)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        try: validate_password(attrs["password"], User(email=attrs["email"], full_name=attrs["full_name"]))
        except DjangoValidationError as exc: raise serializers.ValidationError({"password": exc.messages})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)
        NutritionGoal.objects.create(user=user)
        from subscriptions.models import Subscription
        Subscription.objects.create(user=user)
        return user
