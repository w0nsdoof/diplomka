from apps.notifications.models import Notification


def create_notification(recipient, event_type, task, message, related_object_id=None, actor=None):
    notification = Notification.objects.create(
        recipient=recipient,
        event_type=event_type,
        task=task,
        message=message,
        related_object_id=related_object_id,
    )

    # Dispatch Telegram notification (skip if recipient is the actor — FR-008)
    if actor is None or recipient.pk != actor.pk:
        from apps.telegram.tasks import send_telegram_notification

        task_title = task.title if task else None
        send_telegram_notification.delay(recipient.pk, message, task_title)

    return notification
