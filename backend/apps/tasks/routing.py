from django.urls import path

from apps.ai_summaries.consumers import GenerationConsumer
from apps.tasks.consumers import KanbanConsumer

websocket_urlpatterns = [
    path("ws/kanban/", KanbanConsumer.as_asgi()),
    path("ws/generation/", GenerationConsumer.as_asgi()),
]
