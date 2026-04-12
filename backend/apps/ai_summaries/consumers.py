import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)

User = get_user_model()


class GenerationConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time AI generation pipeline updates.

    Connect with: ws://.../ws/generation/?token=<JWT>
    Then send a subscribe message:
        {"type": "subscribe", "generation_type": "epic_tasks", "generation_id": 2}
        {"type": "subscribe", "generation_type": "summary", "generation_id": 34}

    Server pushes stage_update messages as they happen.
    """

    async def connect(self):
        token = self._extract_token()
        if not token:
            await self.close(code=4401)
            return

        user = await self._authenticate(token)
        if not user:
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = None
        await self.accept()

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get("type")

        if msg_type == "subscribe":
            gen_type = content.get("generation_type")  # "epic_tasks" or "summary"
            gen_id = content.get("generation_id")

            if gen_type not in ("epic_tasks", "summary") or not gen_id:
                await self.send_json({"type": "error", "message": "Invalid subscription"})
                return

            # Leave previous group if any
            if self.group_name:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)

            self.group_name = f"generation_{gen_type}_{gen_id}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.send_json({"type": "subscribed", "group": self.group_name})

        elif msg_type == "pong":
            pass

    async def generation_stage(self, event):
        """Handler for generation stage updates broadcast via channel layer."""
        await self.send_json({
            "type": "stage_update",
            "stage": event["stage"],
            "stage_meta": event.get("stage_meta", {}),
        })

    def _extract_token(self):
        qs = self.scope.get("query_string", b"").decode()
        if "token=" in qs:
            return qs.split("token=")[-1].split("&")[0]
        return None

    @database_sync_to_async
    def _authenticate(self, token_str):
        try:
            access_token = AccessToken(token_str)
            user = User.objects.get(pk=access_token["user_id"])
            if user.is_active:
                return user
        except (InvalidToken, TokenError, User.DoesNotExist):
            pass
        return None
