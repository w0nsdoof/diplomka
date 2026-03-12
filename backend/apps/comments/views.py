from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLogEntry
from apps.audit.services import create_audit_entry
from apps.comments.models import Comment
from apps.comments.serializers import CommentCreateSerializer, CommentSerializer
from apps.comments.services import parse_mentions
from apps.notifications.services import create_notification
from apps.tasks.models import Task


@extend_schema_view(
    list=extend_schema(
        tags=["Comments"],
        summary="List comments for a task",
        description="Client-role users see only is_public=True comments. Includes author and mentions.",
    ),
    create=extend_schema(
        tags=["Comments"],
        summary="Add a comment to a task",
        description=(
            "Use @FirstName LastName to mention users (they will be notified). "
            "Clients cannot create comments (403)."
        ),
        request=CommentCreateSerializer,
        responses={
            201: CommentSerializer,
            403: OpenApiResponse(description="Clients cannot create comments"),
        },
    ),
)
class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "head", "options"]
    queryset = Comment.objects.none()

    def _get_scoped_task(self):
        """Get task scoped to the requesting user's organization."""
        task_id = self.kwargs.get("task_pk")
        return get_object_or_404(
            Task.objects.filter(organization=self.request.user.organization),
            pk=task_id,
        )

    def get_queryset(self):
        task = self._get_scoped_task()
        qs = Comment.objects.filter(task=task).select_related("author").prefetch_related("mentions")
        user = self.request.user
        if user.role == "client":
            qs = qs.filter(is_public=True)
        return qs

    def create(self, request, task_pk=None):
        if request.user.role == "client":
            return Response(
                {"detail": "Clients cannot create comments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        task = self._get_scoped_task()
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = Comment.objects.create(
            task=task,
            author=request.user,
            content=serializer.validated_data["content"],
            is_public=serializer.validated_data["is_public"],
        )

        mentioned_users = parse_mentions(comment.content, organization=request.user.organization)
        if mentioned_users:
            comment.mentions.set(mentioned_users)
            for user in mentioned_users:
                create_notification(
                    recipient=user,
                    event_type="mention",
                    task=task,
                    message=f"{request.user.first_name} {request.user.last_name} mentioned you in a comment on task '{task.title}'",
                )

        create_audit_entry(
            task=task,
            actor=request.user,
            action=AuditLogEntry.Action.COMMENT_ADDED,
            field_name="comment",
            new_value=comment.content[:200],
        )

        for assignee in task.assignees.exclude(pk=request.user.pk):
            if assignee not in mentioned_users:
                create_notification(
                    recipient=assignee,
                    event_type="comment_added",
                    task=task,
                    message=f"New comment on task '{task.title}' by {request.user.first_name} {request.user.last_name}",
                )

        return Response(
            CommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )
