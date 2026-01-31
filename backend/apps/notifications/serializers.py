from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="event_type")
    task_id = serializers.IntegerField(source="task.id", read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "type", "message", "is_read", "task_id", "created_at"]
