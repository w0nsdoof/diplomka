from django.urls import path

from apps.telegram.views import (
    telegram_link,
    telegram_notifications_toggle,
    telegram_status,
    telegram_unlink,
    telegram_webhook,
)

urlpatterns = [
    path("status/", telegram_status, name="telegram-status"),
    path("link/", telegram_link, name="telegram-link"),
    path("unlink/", telegram_unlink, name="telegram-unlink"),
    path("notifications/", telegram_notifications_toggle, name="telegram-notifications"),
    path("webhook/", telegram_webhook, name="telegram-webhook"),
]
