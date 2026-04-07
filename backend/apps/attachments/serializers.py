from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.attachments.models import Attachment

ALLOWED_CONTENT_TYPES = [
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    # ZIP — browsers report it differently:
    #   application/zip                — RFC 6839, Linux/macOS Chrome, Firefox
    #   application/x-zip-compressed   — Windows Chrome / Edge legacy MIME
    #   application/x-zip              — older browsers
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",
    # RAR
    "application/x-rar-compressed",
    "application/vnd.rar",
    # 7-Zip (commonly used alongside ZIP/RAR)
    "application/x-7z-compressed",
]

MAX_FILE_SIZE = 25 * 1024 * 1024


class AttachmentSerializer(serializers.ModelSerializer):
    filename = serializers.CharField(source="original_filename", read_only=True, help_text="Original filename as uploaded.")
    uploaded_by = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField(help_text="Absolute URL to download this file.")

    class Meta:
        model = Attachment
        fields = [
            "id", "filename", "file_size", "content_type",
            "uploaded_by", "uploaded_at", "download_url",
        ]

    @extend_schema_field(serializers.DictField(help_text="{id, first_name, last_name}"))
    def get_uploaded_by(self, obj):
        return {
            "id": obj.uploaded_by.id,
            "first_name": obj.uploaded_by.first_name,
            "last_name": obj.uploaded_by.last_name,
        }

    @extend_schema_field(serializers.URLField())
    def get_download_url(self, obj):
        request = self.context.get("request")
        task_id = obj.task_id
        if request:
            return request.build_absolute_uri(f"/api/tasks/{task_id}/attachments/{obj.id}/")
        return f"/api/tasks/{task_id}/attachments/{obj.id}/"


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(help_text="File to upload. Max 25 MB. Allowed: PNG, JPEG, GIF, WebP, PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, ZIP, RAR.")

    def validate_file(self, value):
        if value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError("File size exceeds 25 MB limit.")
        if value.content_type not in ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(
                f"File type '{value.content_type}' is not allowed."
            )
        return value
