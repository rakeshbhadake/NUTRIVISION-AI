from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("email_verified", True)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("Superuser requires staff and superuser permissions")
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=160, blank=True)
    email_verified = models.BooleanField(default=False)
    token_version = models.PositiveIntegerField(default=0)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return self.email

class DietPreference(models.Model):
    name = models.CharField(max_length=80, unique=True)
    def __str__(self): return self.name

class Allergy(models.Model):
    name = models.CharField(max_length=80, unique=True)
    def __str__(self): return self.name

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    avatar_url = models.URLField(blank=True)
    age = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(13), MaxValueValidator(120)])
    height_cm = models.FloatField(null=True, blank=True, validators=[MinValueValidator(50), MaxValueValidator(260)])
    weight_kg = models.FloatField(null=True, blank=True, validators=[MinValueValidator(15), MaxValueValidator(650)])
    activity_level = models.CharField(max_length=20, choices=[(x, x) for x in ["sedentary", "light", "moderate", "active", "very_active"]], default="moderate")
    dietary_preferences = models.JSONField(default=list, blank=True)
    allergies = models.JSONField(default=list, blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    locale = models.CharField(max_length=12, default="en")
    reminder_enabled = models.BooleanField(default=False)
    reminder_time = models.TimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

class WeightHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="weight_history")
    weight_kg = models.FloatField(validators=[MinValueValidator(15), MaxValueValidator(650)])
    recorded_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["recorded_at"]
        indexes = [models.Index(fields=["user", "recorded_at"])]

class OAuthIdentity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="oauth_identities")
    provider = models.CharField(max_length=12)
    subject = models.CharField(max_length=255)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "subject"], name="unique_oauth_identity")]
