import logging

from celery import shared_task
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def cleanup_expired_verification_codes():
    """Delete expired or used verification codes."""
    from apps.telegram.models import TelegramVerificationCode

    now = timezone.now()
    deleted, _ = TelegramVerificationCode.objects.filter(
        Q(expires_at__lt=now) | Q(is_used=True)
    ).delete()
    logger.info("Cleaned up %d expired/used verification codes", deleted)
    return f"Deleted {deleted} verification codes"


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_telegram_notification(self, user_id, notification_message, task_title=None):
    """Send a Telegram notification to a user.

    Checks that the user has an active link with notifications enabled.
    On 403 (bot blocked), deactivates the link.
    """
    from apps.telegram.models import TelegramLink
    from apps.telegram.services import send_telegram_message

    try:
        link = TelegramLink.objects.get(
            user_id=user_id,
            is_active=True,
            telegram_notifications_enabled=True,
        )
    except TelegramLink.DoesNotExist:
        return "No active Telegram link for user"

    # Format message
    lines = []
    if task_title:
        lines.append(f"<b>{task_title}</b>")
    lines.append(notification_message)
    text = "\n".join(lines)

    try:
        result = send_telegram_message(link.chat_id, text)
    except Exception as exc:
        logger.warning(
            "Failed to send Telegram notification to user_id=%s, retrying",
            user_id,
        )
        raise self.retry(exc=exc)

    # Check if bot was blocked (FR-012)
    if result and result.get("blocked"):
        link.is_active = False
        link.save(update_fields=["is_active"])
        logger.info("Deactivated Telegram link for user_id=%s (bot blocked)", user_id)
        return "Bot blocked, link deactivated"

    return "Notification sent"
