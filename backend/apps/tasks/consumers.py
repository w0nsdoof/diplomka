import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


class KanbanConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        token = self.scope["query_string"].decode().split("token=")[-1] if b"token=" in self.scope["query_string"] else None
        if not token:
            await self.close(code=4401)
            return

        user = await self.authenticate(token)
        if not user:
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = "kanban_board"
        self.client_filter = None

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            "type": "connection_established",
            "user_id": user.id,
            "role": user.role,
        })

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get("type")
        if msg_type == "subscribe_filter":
            self.client_filter = content.get("payload", {}).get("client_id")
            await self.send_json({
                "type": "filter_applied",
                "payload": {"client_id": self.client_filter},
            })
        elif msg_type == "remove_filter":
            self.client_filter = None
            await self.send_json({"type": "filter_removed"})
        elif msg_type == "pong":
            pass

    async def task_event(self, event):
        payload = event.get("payload", {})
        if self.client_filter:
            task_client = payload.get("client_id")
            if task_client and task_client != self.client_filter:
                return
        if hasattr(self, "user") and self.user.role == "client":
            task_client = payload.get("client_id")
            if self.user.client_id and task_client != self.user.client_id:
                return
        await self.send_json({
            "type": event.get("event_type", "task_updated"),
            "payload": payload,
        })

    @database_sync_to_async
    def authenticate(self, token_str):
        try:
            access_token = AccessToken(token_str)
            user = User.objects.get(pk=access_token["user_id"])
            if user.is_active:
                return user
        except Exception:
            return None
        return None
