from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsManager
from apps.organizations.mixins import OrganizationQuerySetMixin
from apps.tags.models import Tag
from apps.tags.serializers import TagSerializer


@extend_schema_view(
    list=extend_schema(tags=["Tags"], summary="List tags", description="Search by name with ?search=."),
    create=extend_schema(
        tags=["Tags"],
        summary="Create a tag",
        description="Name must be unique within organization.",
    ),
    retrieve=extend_schema(tags=["Tags"], summary="Get tag details"),
    update=extend_schema(tags=["Tags"], summary="Update a tag", description="Manager-only. Replace all fields."),
    partial_update=extend_schema(tags=["Tags"], summary="Partially update a tag", description="Manager-only."),
    destroy=extend_schema(tags=["Tags"], summary="Delete a tag", description="Manager-only.", responses={204: None}),
)
class TagViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    search_fields = ["name"]
    ordering = ["name"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
