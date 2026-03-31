from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsManager, IsManagerOrEngineer, IsManagerOrReadOnly
from apps.audit.models import AuditLogEntry
from apps.audit.services import create_audit_entry
from apps.notifications.services import create_notification
from apps.organizations.mixins import OrganizationQuerySetMixin
from apps.tasks.models import Task
from apps.tasks.serializers import (
    AssigneeSerializer,
    TaskAssignSerializer,
    TaskCreateEngineerSerializer,
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskStatusChangeSerializer,
    TaskUpdateEngineerSerializer,
    TaskUpdateSerializer,
)
from apps.tasks.services import (
    MANAGER_ONLY_TRANSITIONS,
    _broadcast_task_event,
    apply_status_change,
)


@extend_schema_view(
    list=extend_schema(
        tags=["Tasks"],
        summary="List tasks",
        description=(
            "Paginated task list. By default excludes archived and done+expired tasks, "
            "and shows only top-level tasks (no subtasks). "
            "Use ?status=archived to view archived tasks. "
            "Use ?include_subtasks=true to include subtasks in results. "
            "Use ?parent_task=<id> to list subtasks of a specific task. "
            "Use ?epic=<id> to filter by epic. "
            "Use ?entity_type=task|subtask to filter by type."
        ),
        parameters=[
            OpenApiParameter("assignee", type=int, description="Filter by assignee user ID"),
            OpenApiParameter("tags", type=str, description="Comma-separated tag IDs"),
            OpenApiParameter("deadline_from", type=str, description="Filter tasks with deadline >= this date (YYYY-MM-DD)"),
            OpenApiParameter("deadline_to", type=str, description="Filter tasks with deadline <= this date (YYYY-MM-DD)"),
            OpenApiParameter(
                "status", type=str,
                enum=["created", "in_progress", "waiting", "done", "archived"],
                description="Filter by status. 'archived' also includes done+expired tasks.",
            ),
            OpenApiParameter("parent_task", type=int, description="Filter to subtasks of a specific parent task ID"),
            OpenApiParameter("epic", type=int, description="Filter by epic ID"),
            OpenApiParameter(
                "entity_type", type=str, enum=["task", "subtask"],
                description="Filter by entity type (task or subtask)",
            ),
            OpenApiParameter(
                "include_subtasks", type=bool,
                description="If true, include subtasks in results (default: false, only top-level tasks)",
            ),
        ],
    ),
    create=extend_schema(
        tags=["Tasks"],
        summary="Create a task",
        description="Manager: full fields (assignee_ids, client_id). Engineer: limited fields.",
        responses={201: TaskDetailSerializer},
    ),
    retrieve=extend_schema(tags=["Tasks"], summary="Get task details"),
    partial_update=extend_schema(
        tags=["Tasks"],
        summary="Update a task",
        description=(
            "Uses optimistic locking via version field — returns 409 on concurrent edit conflict. "
            "Engineers can only edit tasks they are assigned to."
        ),
        responses={200: TaskDetailSerializer, 409: OpenApiResponse(description="Optimistic lock conflict")},
    ),
    destroy=extend_schema(
        tags=["Tasks"],
        summary="Delete a task",
        description="Manager-only. Permanently deletes a task and cascades to attachments, comments, audit log, and notifications.",
        responses={204: None, 403: OpenApiResponse(description="Only managers can delete tasks")},
    ),
)
class TaskViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = Task.objects.all()
    filterset_fields = ["priority", "client"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "deadline", "priority"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("assign", "destroy"):
            return [IsManager()]
        if self.action in ("create", "partial_update", "update", "change_status"):
            return [IsManagerOrEngineer()]
        return [IsManagerOrReadOnly()]

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related(
            "client", "created_by", "epic", "epic__project", "parent_task",
        ).prefetch_related("assignees", "tags")

        if self.action == "list":
            qs = qs.annotate(
                comments_count=Count("comments", distinct=True),
                attachments_count=Count("attachments", distinct=True),
                subtasks_count=Count("subtasks", distinct=True),
            )
        elif self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch(
                    "subtasks",
                    queryset=Task.objects.prefetch_related("assignees"),
                ),
            )

        user = self.request.user
        if user.role == "client" and user.client_id:
            qs = qs.filter(client_id=user.client_id)

        assignee = self.request.query_params.get("assignee")
        if assignee:
            qs = qs.filter(assignees__id=assignee)

        tags = self.request.query_params.get("tags")
        if tags:
            tag_ids = [int(t.strip()) for t in tags.split(",") if t.strip().isdigit()]
            qs = qs.filter(tags__id__in=tag_ids).distinct()

        deadline_from = self.request.query_params.get("deadline_from")
        if deadline_from:
            qs = qs.filter(deadline__gte=deadline_from)

        deadline_to = self.request.query_params.get("deadline_to")
        if deadline_to:
            qs = qs.filter(deadline__lte=deadline_to)

        # Hierarchy filtering (list action only)
        if self.action == "list":
            parent_task_param = self.request.query_params.get("parent_task")
            epic_param = self.request.query_params.get("epic")
            entity_type_param = self.request.query_params.get("entity_type")
            include_subtasks = self.request.query_params.get("include_subtasks", "").lower() == "true"

            if parent_task_param:
                qs = qs.filter(parent_task_id=parent_task_param)
            elif entity_type_param == "subtask":
                qs = qs.filter(parent_task__isnull=False)
            elif entity_type_param == "task":
                qs = qs.filter(parent_task__isnull=True)
            elif not include_subtasks:
                # Default: show only top-level tasks
                qs = qs.filter(parent_task__isnull=True)

            if epic_param:
                qs = qs.filter(epic_id=epic_param)

        # Status filtering with archive logic:
        # - ?status=archived: show archived AND done+expired tasks
        # - ?status=<other>: standard filter
        # - No status filter: hide archived and done+expired tasks
        explicit_status = self.request.query_params.get("status")
        if self.action == "list":
            now = timezone.now()
            if explicit_status == "archived":
                qs = qs.filter(
                    Q(status=Task.Status.ARCHIVED)
                    | Q(status=Task.Status.DONE, deadline__lt=now)
                )
            elif explicit_status:
                qs = qs.filter(status=explicit_status)
            else:
                qs = qs.exclude(status=Task.Status.ARCHIVED).exclude(
                    Q(status=Task.Status.DONE) & Q(deadline__lt=now)
                )
        elif explicit_status:
            qs = qs.filter(status=explicit_status)

        return qs

    def get_serializer_class(self):
        if getattr(self, "swagger_fake_view", False):
            return TaskDetailSerializer
        if self.action == "list":
            return TaskListSerializer
        if self.action == "create":
            if self.request.user.role == "engineer":
                return TaskCreateEngineerSerializer
            return TaskCreateSerializer
        if self.action in ("update", "partial_update"):
            if self.request.user.role == "engineer":
                return TaskUpdateEngineerSerializer
            return TaskUpdateSerializer
        return TaskDetailSerializer

    def perform_update(self, serializer):
        if self.request.user.role == "engineer":
            task = self.get_object()
            if self.request.user not in task.assignees.all():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Engineers can only edit tasks they are assigned to.")
        serializer.save()

    def perform_destroy(self, instance):
        _broadcast_task_event("task_deleted", instance)
        instance.delete()

    @extend_schema(
        tags=["Tasks"],
        summary="Change task status",
        description=(
            "Valid transitions: created->in_progress, in_progress->waiting|done, "
            "waiting->in_progress, done->in_progress|archived. "
            "done->archived is manager-only. Engineers can only change status on their assigned tasks."
        ),
        request=TaskStatusChangeSerializer,
        responses={
            200: inline_serializer("StatusChangeResponse", fields={
                "id": drf_serializers.IntegerField(),
                "status": drf_serializers.CharField(),
                "previous_status": drf_serializers.CharField(allow_null=True),
                "changed_by": AssigneeSerializer(),
                "changed_at": drf_serializers.DateTimeField(),
            }),
            400: OpenApiResponse(description="Invalid status transition"),
            403: OpenApiResponse(description="Not assigned or manager-only transition"),
            409: OpenApiResponse(description="Optimistic lock conflict"),
        },
    )
    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        task = self.get_object()
        serializer = TaskStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        user = request.user

        if user.role == "engineer":
            if user not in task.assignees.all():
                return Response(
                    {"detail": "Engineers can only change status on assigned tasks."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if (task.status, new_status) in MANAGER_ONLY_TRANSITIONS and user.role != "manager":
            return Response(
                {"detail": "Only managers can perform this transition."},
                status=status.HTTP_403_FORBIDDEN,
            )

        success, error, updated_task = apply_status_change(
            task, new_status, user, serializer.validated_data.get("comment")
        )
        if not success:
            if "Conflict" in (error or ""):
                return Response(
                    {"detail": error, "code": "conflict"},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {"detail": error, "code": "invalid_status_transition"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "id": updated_task.id,
            "status": updated_task.status,
            "previous_status": task.status if task.status != updated_task.status else None,
            "changed_by": {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "changed_at": updated_task.updated_at,
        })

    @extend_schema(
        tags=["Tasks"],
        summary="Assign/reassign task",
        description="Manager-only. Replaces the full assignee list. All IDs must be active engineers.",
        request=TaskAssignSerializer,
        responses={
            200: inline_serializer("AssignResponse", fields={
                "id": drf_serializers.IntegerField(),
                "assignees": AssigneeSerializer(many=True),
            }),
            403: OpenApiResponse(description="Only managers can assign tasks"),
        },
    )
    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        task = self.get_object()
        if request.user.role != "manager":
            return Response(
                {"detail": "Only managers can assign tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TaskAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_ids = set(serializer.validated_data["assignee_ids"])
        old_ids = set(task.assignees.values_list("id", flat=True))

        added = new_ids - old_ids
        removed = old_ids - new_ids

        from django.contrib.auth import get_user_model
        user_model = get_user_model()
        users_by_id = {
            u.id: u
            for u in user_model.objects.filter(pk__in=added | removed)
        }

        with transaction.atomic():
            task.assignees.set(new_ids)

            from apps.telegram.templates import build_telegram_context

            for uid in added:
                user = users_by_id[uid]
                ctx = build_telegram_context(
                    event_type="task_assigned", task=task, actor=request.user,
                )
                create_notification(
                    recipient=user,
                    event_type="task_assigned",
                    task=task,
                    message=f"You have been assigned to task '{task.title}'",
                    actor=request.user,
                    telegram_context=ctx,
                )
                create_audit_entry(
                    task=task,
                    actor=request.user,
                    action=AuditLogEntry.Action.ASSIGNMENT_CHANGE,
                    field_name="assignees",
                    new_value=f"{user.first_name} {user.last_name} (ID: {user.id})",
                )

            for uid in removed:
                user = users_by_id[uid]
                ctx = build_telegram_context(
                    event_type="task_unassigned", task=task, actor=request.user,
                )
                create_notification(
                    recipient=user,
                    event_type="task_unassigned",
                    task=task,
                    message=f"You have been removed from task '{task.title}'",
                    actor=request.user,
                    telegram_context=ctx,
                )
                create_audit_entry(
                    task=task,
                    actor=request.user,
                    action=AuditLogEntry.Action.ASSIGNMENT_CHANGE,
                    field_name="assignees",
                    old_value=f"{user.first_name} {user.last_name} (ID: {user.id})",
                )

        assignees = task.assignees.all()
        return Response({
            "id": task.id,
            "assignees": AssigneeSerializer(assignees, many=True).data,
        })

    @extend_schema(
        tags=["Tasks"],
        summary="Get task audit history",
        description="Paginated list of all changes to this task. Manager and engineer only.",
        responses={
            200: inline_serializer("AuditHistoryEntry", fields={
                "id": drf_serializers.IntegerField(),
                "action": drf_serializers.CharField(help_text="Type of change"),
                "field": drf_serializers.CharField(help_text="Which field was changed"),
                "old_value": drf_serializers.CharField(allow_null=True),
                "new_value": drf_serializers.CharField(allow_null=True),
                "changed_by": AssigneeSerializer(allow_null=True),
                "changed_at": drf_serializers.DateTimeField(),
            }, many=True),
            403: OpenApiResponse(description="Clients cannot view audit history"),
        },
    )
    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        task = self.get_object()
        if request.user.role not in ("manager", "engineer"):
            return Response(
                {"detail": "Only managers and engineers can view audit history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entries = AuditLogEntry.objects.filter(task=task).select_related("actor")
        page = self.paginate_queryset(entries)
        data = [
            {
                "id": e.id,
                "action": e.action,
                "field": e.field_name,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "changed_by": {
                    "id": e.actor.id,
                    "first_name": e.actor.first_name,
                    "last_name": e.actor.last_name,
                } if e.actor else None,
                "changed_at": e.timestamp,
            }
            for e in page
        ]
        return self.get_paginated_response(data)

    @extend_schema(
        tags=["Tasks"],
        summary="List subtasks of a task",
        description="Returns paginated list of subtasks for the given parent task.",
        responses={200: TaskListSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="subtasks")
    def subtasks(self, request, pk=None):
        task = self.get_object()
        qs = Task.objects.filter(
            parent_task=task,
            organization=request.user.organization,
        ).select_related("client", "created_by").prefetch_related("assignees", "tags").annotate(
            comments_count=Count("comments", distinct=True),
            attachments_count=Count("attachments", distinct=True),
        ).order_by("-created_at")
        page = self.paginate_queryset(qs)
        serializer = TaskListSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
