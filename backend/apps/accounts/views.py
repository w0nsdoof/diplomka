import logging

from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.accounts.permissions import IsManager
from apps.accounts.serializers import (
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)

logger = logging.getLogger(__name__)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsManager]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["email", "date_joined"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        qs = User.objects.all()
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
        user.is_active = False
        user.save(update_fields=["is_active"])
        logger.info("User deactivated user=%s by=%s", user.pk, request.user.pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info("User created user=%s email=%s role=%s by=%s", user.pk, user.email, user.role, self.request.user.pk)
