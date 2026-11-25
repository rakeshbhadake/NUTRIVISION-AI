import asyncio
from urllib.parse import urlparse
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from accounts.authentication import VerifiedJWTAuthentication

class JWTWebsocketMiddleware:
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode()
        if origin and origin not in settings.CORS_ALLOWED_ORIGINS:
            await send({"type": "websocket.close", "code": 4403})
            return
        return await self.app(scope, receive, send)

class NutritionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = None
        self.group_name = None
        self.expiry_task = None
        await self.accept()
        self.auth_timeout = asyncio.create_task(self.close_later(10, 4401))

    async def close_later(self, seconds, code):
        await asyncio.sleep(max(0, seconds))
        await self.close(code=code)

    @database_sync_to_async
    def authenticate_token(self, raw):
        auth = VerifiedJWTAuthentication()
        token = auth.get_validated_token(raw)
        return auth.get_user(token), token["exp"]

    async def receive_json(self, content, **kwargs):
        if self.user is not None:
            if content.get("type") == "ping": await self.send_json({"type": "pong"})
            return
        if content.get("type") != "authenticate" or not isinstance(content.get("token"), str):
            await self.close(code=4401)
            return
        try: self.user, expiry = await self.authenticate_token(content["token"])
        except Exception:
            await self.close(code=4401)
            return
        self.auth_timeout.cancel()
        self.group_name = f"nutrition_{self.user.pk}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        import time
        self.expiry_task = asyncio.create_task(self.close_later(expiry-time.time(), 4401))
        await self.send_json({"type": "authenticated"})

    async def disconnect(self, code):
        if self.group_name: await self.channel_layer.group_discard(self.group_name, self.channel_name)
        for task in [getattr(self, "auth_timeout", None), self.expiry_task]:
            if task and task is not asyncio.current_task(): task.cancel()

    async def nutrition_updated(self, event):
        if event["event"] == "session.revoked":
            await self.close(code=4401)
            return
        await self.send_json({"type": event["event"]})
