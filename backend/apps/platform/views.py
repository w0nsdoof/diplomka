from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsSuperadmin
from apps.organizations.models import Organization
from apps.platform.serializers import (
    ManagerBriefSerializer,
    ManagerCreateSerializer,
    OrganizationCreateSerializer,
    OrganizationDetailSerializer,
    OrganizationListSerializer,
    OrganizationUpdateSerializer,
)

User = get_user_model()


@extend_schema_view(
    list=extend_schema(tags=["platform"], summary="List all organizations"),
    create=extend_schema(tags=["platform"], summary="Create a new organization"),
    retrieve=extend_schema(tags=["platform"], summary="Get organization details with stats"),
    partial_update=extend_schema(tags=["platform"], summary="Update organization (name, is_active)"),
)
class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperadmin]
    search_fields = ["name"]
    ordering = ["name"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Organization.objects.all()

        # Filter by is_active query param
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        if self.action == "list":
            qs = qs.annotate(
                user_count=Count("users", distinct=True),
                task_count=Count("tasks", distinct=True),
            )
        elif self.action == "retrieve":
            qs = OrganizationDetailSerializer.annotate_queryset(qs)

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return OrganizationListSerializer
        if self.action == "create":
            return OrganizationCreateSerializer
        if self.action in ("update", "partial_update"):
            return OrganizationUpdateSerializer
        return OrganizationDetailSerializer

    @extend_schema(
        tags=["platform"],
        methods=["GET"],
        summary="List managers for an organization",
        responses={200: ManagerBriefSerializer(many=True)},
    )
    @extend_schema(
        tags=["platform"],
        methods=["POST"],
        summary="Create a manager for an organization",
        request=ManagerCreateSerializer,
        responses={201: ManagerBriefSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="managers")
    def managers(self, request, pk=None):
        organization = self.get_object()

        if request.method == "GET":
            managers = User.objects.filter(
                organization=organization, role=User.Role.MANAGER
            )
            serializer = ManagerBriefSerializer(managers, many=True)
            return Response({"count": managers.count(), "results": serializer.data})

        # POST — create manager
        serializer = ManagerCreateSerializer(
            data=request.data, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)

        if not organization.is_active:
            return Response(
                {"detail": _("Cannot create manager for inactive organization.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()
        return Response(
            ManagerBriefSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )
