import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path
from notifications.consumers import NutritionConsumer, JWTWebsocketMiddleware
application = ProtocolTypeRouter({"http": django_asgi_app, "websocket": JWTWebsocketMiddleware(URLRouter([path("ws/nutrition/", NutritionConsumer.as_asgi())]))})
