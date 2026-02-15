from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="event_type")
    task_id = serializers.SerializerMethodField()
    summary_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "type", "message", "is_read", "task_id", "summary_id", "created_at"]

    def get_task_id(self, obj):
        return obj.task_id if obj.task_id else None

    def get_summary_id(self, obj):
        if obj.event_type == Notification.EventType.SUMMARY_READY:
            return obj.related_object_id
        return None
