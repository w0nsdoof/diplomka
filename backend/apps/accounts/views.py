import logging

from django.contrib.auth import get_user_model
from django.db.models import Count
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsManager
from apps.accounts.serializers import (
    MeSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)
from apps.organizations.mixins import OrganizationQuerySetMixin

logger = logging.getLogger(__name__)

User = get_user_model()


@extend_schema(tags=["Profile"], summary="Get or update your own profile")
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@extend_schema_view(
    list=extend_schema(
        tags=["Users"],
        summary="List users",
        description="Paginated list of users in your organization. Filter by role/is_active, search by email/name.",
    ),
    create=extend_schema(
        tags=["Users"],
        summary="Create a user",
        description="Manager-only. Client-role users require client_id.",
        responses={201: UserDetailSerializer, 400: OpenApiResponse(description="Validation error")},
    ),
    retrieve=extend_schema(
        tags=["Users"],
        summary="Get user details",
        description="Includes assigned_tasks_count.",
    ),
    partial_update=extend_schema(
        tags=["Users"],
        summary="Update a user",
        description="Manager-only. Can update name, role, is_active, password, client_id.",
    ),
    destroy=extend_schema(
        tags=["Users"],
        summary="Deactivate user (soft delete)",
        description="Sets is_active=False. Cannot deactivate the last active manager in the organization.",
        responses={204: None, 400: OpenApiResponse(description="Cannot deactivate last active manager")},
    ),
)
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
