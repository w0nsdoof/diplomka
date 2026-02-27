import logging

from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.permissions import IsManager
from apps.accounts.serializers import (
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)
from apps.organizations.mixins import OrganizationQuerySetMixin

logger = logging.getLogger(__name__)

User = get_user_model()


class UserViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [IsManager]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["email", "date_joined"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        if self.request.user.is_superadmin:
            raise PermissionDenied("Superadmins must use the platform API for user management.")
        qs = super().get_queryset()
        qs = qs.exclude(role="superadmin")
        if self.action == "retrieve":
            qs = qs.annotate(assigned_tasks_count=Count("assigned_tasks"))
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action == "retrieve":
            return UserDetailSerializer
        if self.action == "create":
            return UserCreateSerializer
        return UserUpdateSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.role == "manager":
            active_managers = User.objects.filter(
                organization=user.organization,
                role="manager",
                is_active=True,
            ).count()
            if active_managers <= 1:
                return Response(
                    {"detail": "Cannot deactivate the last active manager in this organization."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        user.is_active = False
        user.save(update_fields=["is_active"])
        logger.info("User deactivated user=%s by=%s", user.pk, request.user.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        user = serializer.save(organization=self.request.user.organization)
        logger.info("User created user=%s email=%s role=%s by=%s", user.pk, user.email, user.role, self.request.user.pk)
