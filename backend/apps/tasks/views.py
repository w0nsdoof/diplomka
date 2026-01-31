from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsManager, IsManagerOrReadOnly
from apps.audit.models import AuditLogEntry
from apps.audit.services import create_audit_entry
from apps.notifications.services import create_notification
from apps.tasks.models import Task
from apps.tasks.serializers import (
    TaskAssignSerializer,
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskStatusChangeSerializer,
    TaskUpdateSerializer,
)
from apps.tasks.services import MANAGER_ONLY_TRANSITIONS, apply_status_change


class TaskViewSet(viewsets.ModelViewSet):
    filterset_fields = ["status", "priority", "client"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "deadline", "priority"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ("create",):
            return [IsManager()]
        return [IsManagerOrReadOnly()]

    def get_queryset(self):
        qs = Task.objects.select_related("client", "created_by").prefetch_related(
            "assignees", "tags"
        )
        if self.action == "list":
            qs = qs.annotate(
                comments_count=Count("comments", distinct=True),
                attachments_count=Count("attachments", distinct=True),
            )

        user = self.request.user
        if user.role == "client" and user.client_id:
            qs = qs.filter(client_id=user.client_id)

        assignee = self.request.query_params.get("assignee")
        if assignee:
            qs = qs.filter(assignees__id=assignee)

        tags = self.request.query_params.get("tags")
        if tags:
            tag_slugs = [t.strip() for t in tags.split(",")]
            qs = qs.filter(tags__slug__in=tag_slugs).distinct()

        deadline_from = self.request.query_params.get("deadline_from")
        if deadline_from:
            qs = qs.filter(deadline__gte=deadline_from)

        deadline_to = self.request.query_params.get("deadline_to")
        if deadline_to:
            qs = qs.filter(deadline__lte=deadline_to)

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return TaskListSerializer
        if self.action == "create":
            return TaskCreateSerializer
        if self.action in ("update", "partial_update"):
            return TaskUpdateSerializer
        return TaskDetailSerializer

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

        task.assignees.set(new_ids)

        added = new_ids - old_ids
        removed = old_ids - new_ids

        from django.contrib.auth import get_user_model
        User = get_user_model()

        for uid in added:
            user = User.objects.get(pk=uid)
            create_notification(
                recipient=user,
                event_type="task_assigned",
                task=task,
                message=f"You have been assigned to task '{task.title}'",
            )
            create_audit_entry(
                task=task,
                actor=request.user,
                action=AuditLogEntry.Action.ASSIGNMENT_CHANGE,
                field_name="assignees",
                new_value=f"{user.first_name} {user.last_name} (ID: {user.id})",
            )

        for uid in removed:
            user = User.objects.get(pk=uid)
            create_notification(
                recipient=user,
                event_type="task_unassigned",
                task=task,
                message=f"You have been removed from task '{task.title}'",
            )
            create_audit_entry(
                task=task,
                actor=request.user,
                action=AuditLogEntry.Action.ASSIGNMENT_CHANGE,
                field_name="assignees",
                old_value=f"{user.first_name} {user.last_name} (ID: {user.id})",
            )

        from apps.tasks.serializers import AssigneeSerializer
        assignees = task.assignees.all()
        return Response({
            "id": task.id,
            "assignees": AssigneeSerializer(assignees, many=True).data,
        })

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        task = self.get_object()
        if request.user.role != "manager":
            return Response(
                {"detail": "Only managers can view audit history."},
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
