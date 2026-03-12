from django.conf import settings
from django.db import models


class TelegramLink(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="telegramlink"
    )
    chat_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=150, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    telegram_notifications_enabled = models.BooleanField(default=True)
    linked_at = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="telegram_links",
    )

    class Meta:
        indexes = [
            models.Index(fields=["organization"], name="ix_tglink_org"),
        ]

    def __str__(self):
        return f"TelegramLink({self.user} -> {self.chat_id})"


class TelegramVerificationCode(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="telegram_verification_codes",
    )
    code = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    is_used = models.BooleanField(default=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="telegram_verification_codes",
    )

    class Meta:
        indexes = [
            models.Index(fields=["expires_at"], name="ix_tgcode_expires"),
        ]

    def __str__(self):
        return f"TelegramVerificationCode({self.user}, used={self.is_used})"
