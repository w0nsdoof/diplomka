from django.urls import path

from apps.tasks.consumers import KanbanConsumer

websocket_urlpatterns = [
    path("ws/kanban/", KanbanConsumer.as_asgi()),
]
