from django.db.models import Count, Q
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import viewsets

from apps.accounts.permissions import IsManagerOrReadOnly
from apps.clients.models import Client
from apps.clients.serializers import (
    ClientCreateUpdateSerializer,
    ClientDetailSerializer,
    ClientListSerializer,
)
from apps.organizations.mixins import OrganizationQuerySetMixin
from apps.tasks.models import Task


@extend_schema_view(
    list=extend_schema(
        tags=["Clients"],
        summary="List clients",
        description="Paginated list with tasks_count. Client-role users see only their linked client.",
    ),
    create=extend_schema(
        tags=["Clients"],
        summary="Create a client",
        description="Manager-only. Name must be unique within organization.",
        responses={201: ClientDetailSerializer, 400: OpenApiResponse(description="Duplicate name or validation error")},
    ),
    retrieve=extend_schema(
        tags=["Clients"],
        summary="Get client details",
        description="Includes task_summary breakdown by status.",
    ),
    partial_update=extend_schema(tags=["Clients"], summary="Update a client", description="Manager-only."),
)
class ClientViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = Client.objects.all()
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "client" and user.client_id:
            qs = qs.filter(pk=user.client_id)
        if self.action == "list":
            qs = qs.annotate(tasks_count=Count("tasks"))
        elif self.action == "retrieve":
            qs = qs.annotate(**{
                f"tasks_{s}": Count("tasks", filter=Q(tasks__status=s))
                for s in Task.Status.values
            })
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ClientListSerializer
        if self.action == "retrieve":
            return ClientDetailSerializer
        return ClientCreateUpdateSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
