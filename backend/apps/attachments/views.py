from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsManager
from apps.attachments.models import Attachment
from apps.attachments.serializers import AttachmentSerializer, AttachmentUploadSerializer
from apps.audit.models import AuditLogEntry
from apps.audit.services import create_audit_entry
from apps.tasks.models import Task


class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsManager()]
        return [IsAuthenticated()]

    def get_queryset(self):
        task_id = self.kwargs.get("task_pk")
        return Attachment.objects.filter(task_id=task_id).select_related("uploaded_by")

    def create(self, request, task_pk=None):
        task = Task.objects.get(pk=task_pk)
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        attachment = Attachment.objects.create(
            task=task,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            content_type=uploaded_file.content_type,
            uploaded_by=request.user,
        )

        create_audit_entry(
            task=task,
            actor=request.user,
            action=AuditLogEntry.Action.FILE_ATTACHED,
            field_name="attachment",
            new_value=uploaded_file.name,
        )

        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, *args, **kwargs):
        attachment = self.get_object()
        return FileResponse(
            attachment.file.open("rb"),
            content_type=attachment.content_type,
            as_attachment=True,
            filename=attachment.original_filename,
        )
