# Quickstart: Telegram Notifications

**Feature**: 006-telegram-notifications | **Date**: 2026-03-12

## Prerequisites

1. **Telegram Bot** — Create via [BotFather](https://t.me/BotFather):
   - `/newbot` → name: "TaskManager Bot" → username: e.g. `taskmanager_w0nsdoof_bot`
   - Copy the bot token

2. **Environment variables** — Add to `.env` (local and remote):
   ```env
   TELEGRAM_BOT_TOKEN=<bot-token-from-botfather>
   TELEGRAM_BOT_USERNAME=<bot-username-without-@>
   TELEGRAM_WEBHOOK_SECRET=<random-64-char-string>
   ```

3. **Existing services running** — Backend (Django/Daphne), Celery worker, Redis, PostgreSQL

## Setup Steps

### 1. Install dependency

```bash
cd backend
pip install httpx
# Add to requirements.txt: httpx>=0.27
```

### 2. Run migrations

```bash
cd backend
python manage.py migrate telegram
```

### 3. Register webhook (one-time, or after bot token change)

```bash
# Run from backend container or locally with env vars loaded
python manage.py register_telegram_webhook
```

This management command calls Telegram's `setWebhook` API:
```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
{
  "url": "https://taskmanager.w0nsdoof.com/api/telegram/webhook/",
  "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
}
```

### 4. Verify setup

```bash
# Check webhook info
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Should show:
# {"url": "https://taskmanager.w0nsdoof.com/api/telegram/webhook/", "has_custom_certificate": false, ...}
```

## Development (Local)

For local development without a public HTTPS URL, use long polling or a tunnel:

**Option A: Skip webhook (send-only testing)**
- Telegram sending works locally (outbound HTTPS to api.telegram.org)
- Account linking requires a tunnel for the webhook

**Option B: Use ngrok/cloudflared tunnel**
```bash
# In a separate terminal
ngrok http 8000
# or
cloudflared tunnel --url http://localhost:8000

# Register webhook with tunnel URL
TELEGRAM_WEBHOOK_URL=https://<tunnel-url>/api/telegram/webhook/ python manage.py register_telegram_webhook
```

## User Flow (Manual Testing)

1. Log in as a manager or engineer
2. Navigate to `/settings`
3. Click "Link Telegram"
4. Click the deep link or scan QR → opens Telegram
5. Send `/start <code>` to the bot (deep link does this automatically)
6. Bot responds "Account linked!"
7. Refresh settings page → shows "Connected" with username
8. Create/update a task involving this user → Telegram message arrives

## Key Files

| File | Purpose |
|------|---------|
| `backend/apps/telegram/models.py` | TelegramLink, TelegramVerificationCode |
| `backend/apps/telegram/services.py` | Send messages, verify codes, manage links |
| `backend/apps/telegram/views.py` | API endpoints + webhook handler |
| `backend/apps/telegram/tasks.py` | Celery tasks (send notification, cleanup codes) |
| `backend/apps/telegram/bot.py` | Webhook message processing logic |
| `backend/apps/notifications/services.py` | Modified — dispatches Telegram after creating notification |
| `frontend/src/app/features/settings/` | User settings page with Telegram UI |
| `frontend/src/app/core/services/telegram.service.ts` | Frontend API service |

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot API token from BotFather |
| `TELEGRAM_BOT_USERNAME` | Yes | Bot username (without @) |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Random string for webhook verification |
