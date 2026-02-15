from apps.notifications.models import Notification


def create_notification(recipient, event_type, task, message, related_object_id=None):
    return Notification.objects.create(
        recipient=recipient,
        event_type=event_type,
        task=task,
        message=message,
        related_object_id=related_object_id,
    )
