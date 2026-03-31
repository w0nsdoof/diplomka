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
    destroy=extend_schema(tags=["Tags"], summary="Delete a tag", description="Manager-only.", responses={204: None}),
)
class TagViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    search_fields = ["name"]
    ordering = ["name"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
