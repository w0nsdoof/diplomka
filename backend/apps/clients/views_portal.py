from django.db.models import Count, Q
from rest_framework import generics, serializers
from rest_framework.response import Response

from apps.accounts.permissions import IsClient
from apps.comments.models import Comment
from apps.tasks.models import Task


class PortalTicketListSerializer(serializers.ModelSerializer):
    public_comments_count = serializers.IntegerField(read_only=True, default=0)
    attachments_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority", "deadline",
            "created_at", "updated_at", "public_comments_count",
            "attachments_count",
        ]


class PortalTicketDetailSerializer(serializers.ModelSerializer):
    comments = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "status", "priority",
            "deadline", "created_at", "updated_at", "comments",
            "attachments",
        ]

    def get_comments(self, obj):
        comments = obj.comments.filter(is_public=True).select_related("author")
        return [
            {
                "id": c.id,
                "author": {
                    "id": c.author.id,
                    "first_name": c.author.first_name,
                    "last_name": c.author.last_name,
                },
                "content": c.content,
                "created_at": c.created_at,
            }
            for c in comments
        ]

    def get_attachments(self, obj):
        attachments = obj.attachments.all()
        return [
            {
                "id": a.id,
                "filename": a.original_filename,
                "file_size": a.file_size,
                "content_type": a.content_type,
                "uploaded_at": a.uploaded_at,
                "download_url": f"/api/tasks/{obj.id}/attachments/{a.id}/",
            }
            for a in attachments
        ]


class PortalTicketListView(generics.ListAPIView):
    serializer_class = PortalTicketListSerializer
    permission_classes = [IsClient]
    filterset_fields = ["status"]
    search_fields = ["title"]
    ordering_fields = ["created_at", "deadline"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        if not user.client_id:
            return Task.objects.none()
        return (
            Task.objects.filter(client_id=user.client_id)
            .exclude(status="archived")
            .annotate(
                public_comments_count=Count("comments", filter=Q(comments__is_public=True)),
                attachments_count=Count("attachments"),
            )
        )


class PortalTicketDetailView(generics.RetrieveAPIView):
    serializer_class = PortalTicketDetailSerializer
    permission_classes = [IsClient]

    def get_queryset(self):
        user = self.request.user
        if not user.client_id:
            return Task.objects.none()
        return Task.objects.filter(client_id=user.client_id).prefetch_related(
            "comments__author", "attachments"
        )
