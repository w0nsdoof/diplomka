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


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    ordering = ["created_at"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        task_id = self.kwargs.get("task_pk")
        qs = Comment.objects.filter(task_id=task_id).select_related("author").prefetch_related("mentions")
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

        task = Task.objects.get(pk=task_pk)
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = Comment.objects.create(
            task=task,
            author=request.user,
            content=serializer.validated_data["content"],
            is_public=serializer.validated_data["is_public"],
        )

        mentioned_users = parse_mentions(comment.content)
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
