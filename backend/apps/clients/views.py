from django.db.models import Count
from rest_framework import viewsets

from apps.accounts.permissions import IsManagerOrReadOnly
from apps.clients.models import Client
from apps.clients.serializers import (
    ClientCreateUpdateSerializer,
    ClientDetailSerializer,
    ClientListSerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Client.objects.all()
        user = self.request.user
        if user.role == "client" and user.client_id:
            qs = qs.filter(pk=user.client_id)
        if self.action == "list":
            qs = qs.annotate(tasks_count=Count("tasks"))
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ClientListSerializer
        if self.action == "retrieve":
            return ClientDetailSerializer
        return ClientCreateUpdateSerializer
