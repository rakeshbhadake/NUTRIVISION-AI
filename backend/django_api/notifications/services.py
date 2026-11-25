from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from .models import UserAchievement, Notification
import logging

logger = logging.getLogger(__name__)

def broadcast(user_id, event="nutrition.updated"):
    def send():
        try:
            layer = get_channel_layer()
            if layer: async_to_sync(layer.group_send)(f"nutrition_{user_id}", {"type": "nutrition_updated", "event": event})
        except Exception:
            # Database mutations have committed; a realtime outage must not invite duplicate retries.
            logger.exception("Realtime nutrition update could not be delivered")
    transaction.on_commit(send)

def award(user, code, title):
    achievement, created = UserAchievement.objects.get_or_create(user=user, code=code, defaults={"title": title})
    if created:
        Notification.objects.create(user=user, title=title, message="A new healthy habit milestone has been added to your profile.")
    return achievement
