import logging
import secrets
from datetime import timedelta

import httpx
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def get_bot_username():
    return settings.TELEGRAM_BOT_USERNAME


def send_telegram_message(chat_id, text):
    """Send a message to a Telegram chat using the Bot API."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN not configured, skipping message send")
        return None

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }

    try:
        response = httpx.post(url, json=payload, timeout=10)
        if response.status_code == 403:
            logger.warning("Bot blocked by user chat_id=%s", chat_id)
            return {"blocked": True}
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError:
        logger.exception("Telegram API error for chat_id=%s", chat_id)
        raise
    except httpx.RequestError:
        logger.exception("Network error sending Telegram message to chat_id=%s", chat_id)
        raise


def generate_verification_code(user):
    """Generate a verification code for Telegram linking.

    Invalidates any previous unused codes for the user.
    Returns (code, deep_link, expires_at).
    """
    from apps.telegram.models import TelegramVerificationCode

    # Invalidate previous unused codes
    TelegramVerificationCode.objects.filter(
        user=user, is_used=False
    ).update(is_used=True)

    code = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(minutes=10)
    bot_username = get_bot_username()

    TelegramVerificationCode.objects.create(
        user=user,
        code=code,
        expires_at=expires_at,
        organization=user.organization,
    )

    deep_link = f"https://t.me/{bot_username}?start={code}"
    return code, deep_link, expires_at


def verify_code_and_link(code, chat_id, telegram_username):
    """Verify a code and link the Telegram account.

    Returns (success: bool, error_message: str | None).
    """
    from apps.accounts.models import User
    from apps.telegram.models import TelegramLink, TelegramVerificationCode

    now = timezone.now()

    try:
        verification = TelegramVerificationCode.objects.select_related("user").get(
            code=code, is_used=False, expires_at__gt=now
        )
    except TelegramVerificationCode.DoesNotExist:
        return False, "Invalid or expired verification code."

    user = verification.user

    # Check role (FR-013): only manager/engineer allowed
    if user.role not in (User.Role.MANAGER, User.Role.ENGINEER):
        return False, "Only managers and engineers can link Telegram."

    # Check chat_id not already linked to another user (FR-014)
    if TelegramLink.objects.filter(chat_id=chat_id).exists():
        return False, "This Telegram account is already linked to another user."

    # Check user doesn't already have a link
    if TelegramLink.objects.filter(user=user).exists():
        return False, "User already has a linked Telegram account."

    # Create the link
    TelegramLink.objects.create(
        user=user,
        chat_id=chat_id,
        username=telegram_username or "",
        is_active=True,
        telegram_notifications_enabled=True,
        organization=user.organization,
    )

    # Mark code as used
    verification.is_used = True
    verification.save(update_fields=["is_used"])

    return True, None


def unlink_telegram(user):
    """Delete the user's TelegramLink record (FR-004).

    Returns True if a link was deleted, False if none existed.
    """
    from apps.telegram.models import TelegramLink

    deleted, _ = TelegramLink.objects.filter(user=user).delete()
    return deleted > 0


def format_telegram_notification(notification, task):
    """Format an HTML message for Telegram notification."""
    lines = []

    if task:
        task_title = task.title
        lines.append(f"<b>{task_title}</b>")

    lines.append(notification.message)

    if task:
        base_url = settings.ALLOWED_HOSTS[0] if settings.ALLOWED_HOSTS else "localhost"
        scheme = "http" if base_url == "localhost" else "https"
        task_url = f"{scheme}://{base_url}/tasks/{task.id}"
        lines.append(f'\n<a href="{task_url}">View task</a>')

    return "\n".join(lines)
