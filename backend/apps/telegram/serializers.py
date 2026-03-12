from rest_framework import serializers


class TelegramStatusSerializer(serializers.Serializer):
    is_linked = serializers.BooleanField()
    username = serializers.CharField(allow_null=True)
    is_active = serializers.BooleanField()
    telegram_notifications_enabled = serializers.BooleanField()
    linked_at = serializers.DateTimeField(allow_null=True)


class TelegramNotificationToggleSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
