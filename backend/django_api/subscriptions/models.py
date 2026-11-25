from django.conf import settings
from django.db import models

class Subscription(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription")
    plan = models.CharField(max_length=30, default="free")
    status = models.CharField(max_length=30, default="active", choices=[(v, v) for v in ["active", "trialing", "past_due", "canceled"]])
    provider_customer_id = models.CharField(max_length=200, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
