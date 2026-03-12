from django.contrib import admin

from apps.telegram.models import TelegramLink, TelegramVerificationCode


@admin.register(TelegramLink)
class TelegramLinkAdmin(admin.ModelAdmin):
    list_display = ("user", "chat_id", "username", "is_active", "telegram_notifications_enabled", "linked_at")
    list_filter = ("is_active", "telegram_notifications_enabled", "organization")
    search_fields = ("user__email", "username", "chat_id")
    raw_id_fields = ("user", "organization")


@admin.register(TelegramVerificationCode)
class TelegramVerificationCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "code", "is_used", "created_at", "expires_at")
    list_filter = ("is_used", "organization")
    search_fields = ("user__email", "code")
    raw_id_fields = ("user", "organization")
