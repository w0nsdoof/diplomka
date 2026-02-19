from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsManager
from apps.organizations.mixins import OrganizationQuerySetMixin
from apps.tags.models import Tag
from apps.tags.serializers import TagSerializer


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
