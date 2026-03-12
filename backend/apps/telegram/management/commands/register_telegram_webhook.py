import os

import httpx
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Register the Telegram bot webhook with Telegram API"

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        secret = settings.TELEGRAM_WEBHOOK_SECRET

        if not token:
            self.stderr.write(self.style.ERROR("TELEGRAM_BOT_TOKEN not set"))
            return

        # Allow override for tunneling in development
        webhook_url = os.getenv(
            "TELEGRAM_WEBHOOK_URL",
            f"https://{settings.ALLOWED_HOSTS[0]}/api/telegram/webhook/",
        )

        url = f"https://api.telegram.org/bot{token}/setWebhook"
        payload = {"url": webhook_url}
        if secret:
            payload["secret_token"] = secret

        response = httpx.post(url, json=payload, timeout=10)
        data = response.json()

        if data.get("ok"):
            self.stdout.write(self.style.SUCCESS(f"Webhook registered: {webhook_url}"))
        else:
            self.stderr.write(self.style.ERROR(f"Failed: {data.get('description')}"))
