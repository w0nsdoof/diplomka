# Research: Telegram Notifications

**Feature**: 006-telegram-notifications | **Date**: 2026-03-12

## Decision 1: Telegram Bot Library

**Decision**: Use `httpx` for direct Telegram Bot API calls instead of `python-telegram-bot`.

**Rationale**: The project only needs two Bot API operations: (1) receive webhook POSTs for `/start` commands during account linking, and (2) send `sendMessage` requests for notifications. `python-telegram-bot` v22.x is fully async and introduces integration friction with Django's sync views and Celery tasks (`async_to_sync` wrappers, event loop conflicts). Direct HTTP calls via `httpx` (already async-capable, lightweight) are simpler and sufficient. The webhook handler is just a standard Django view that parses JSON.

**Alternatives considered**:
- `python-telegram-bot` v22.6 — Full-featured but overkill; async-only architecture conflicts with Django sync views and Celery workers. Third-party Django wrappers are outdated.
- `aiogram` — Same async-only problem, even more framework-like.
- `requests` — Sync-only; `httpx` supports both sync (for Celery tasks) and async, plus is already commonly used.

## Decision 2: Webhook vs Long Polling

**Decision**: Webhook mode.

**Rationale**: The project already has HTTPS via Caddy on `taskmanager.w0nsdoof.com` (port 443), which satisfies Telegram's webhook requirements. Webhooks integrate naturally as a Django URL endpoint — no extra container/process needed. Long polling would require a persistent process (another service in compose), waste resources, and conflict with Django's request-response model.

**Alternatives considered**:
- Long polling — Requires dedicated container, wastes resources with constant requests, `python-telegram-bot` polling mode runs its own asyncio loop that clashes with Django.

## Decision 3: Account Linking Flow

**Decision**: Telegram Deep Linking with time-limited verification codes stored in PostgreSQL.

**Rationale**: Standard Telegram deep linking flow: user clicks `https://t.me/BotName?start=<code>`, which sends `/start <code>` to the bot. The bot webhook handler looks up the code, links the user's `chat_id`, and confirms. Codes stored in PostgreSQL (not Redis) for auditability and consistency with the rest of the data model. 10-minute TTL per spec requirement FR-011.

**Flow**:
1. User clicks "Link Telegram" in settings → backend generates code (`secrets.token_urlsafe(32)`)
2. Frontend displays deep link: `https://t.me/{BOT_USERNAME}?start={code}`
3. User clicks link → Telegram opens → sends `/start {code}` to bot
4. Webhook receives message → looks up code → links `chat_id` to user → confirms via Telegram message
5. Frontend polls or refreshes to see linked status

**Alternatives considered**:
- Redis-stored codes — Simpler TTL but loses auditability; PostgreSQL with a Celery cleanup task is consistent with existing patterns (see `check_approaching_deadlines`).
- QR code — Adds complexity without clear benefit; deep link is simpler and mobile-friendly.

## Decision 4: Message Formatting

**Decision**: HTML parse mode for Telegram messages.

**Rationale**: HTML is easier to construct programmatically than MarkdownV2 (which requires escaping `.`, `!`, `-`, `(`, `)`, etc.). Supported tags include `<b>`, `<i>`, `<a href>`, `<code>`, which cover all notification formatting needs. Max message length is 4096 characters (more than sufficient for task notifications).

**Alternatives considered**:
- MarkdownV2 — Requires extensive character escaping; error-prone for dynamic content like task titles.
- Plain text — Loses formatting benefits (bold task titles, clickable links).

## Decision 5: Webhook Security

**Decision**: Telegram's `secret_token` header verification + `@csrf_exempt`.

**Rationale**: When registering the webhook via `setWebhook`, a `secret_token` parameter is provided. Telegram includes it as `X-Telegram-Bot-Api-Secret-Token` header on every webhook request. The Django view checks this with `hmac.compare_digest()` (constant-time comparison). The webhook endpoint must be `@csrf_exempt` since Telegram can't provide Django CSRF tokens. The secret is stored in `.env` as `TELEGRAM_WEBHOOK_SECRET`.

**Alternatives considered**:
- IP allowlisting (Telegram ranges 149.154.160.0/20, 91.108.4.0/22) — Fragile if Telegram changes IPs; `secret_token` is simpler and officially supported.
- Non-guessable URL path — Good defense-in-depth but `secret_token` is sufficient on its own.

## Decision 6: Notification Dispatch Architecture

**Decision**: Hook into `create_notification()` in `apps/notifications/services.py` to dispatch a Celery task for Telegram delivery.

**Rationale**: All in-app notifications flow through `create_notification()`. Adding a Celery task dispatch there ensures every notification type automatically gets Telegram delivery (if the user has it enabled). The Celery task checks the user's Telegram link status and preference before sending. This avoids scattering Telegram logic across multiple apps (tasks, comments, etc.).

**Alternatives considered**:
- Django signals on Notification model — Adds indirection; direct function call in `create_notification()` is clearer.
- Separate notification dispatcher service — Over-engineering for the current scale.

## Decision 7: Verification Code Storage

**Decision**: PostgreSQL model `TelegramVerificationCode` with Celery Beat cleanup task.

**Rationale**: Consistent with existing patterns (e.g., `check_approaching_deadlines` hourly task). Codes have a 10-minute TTL (FR-011). A periodic Celery task cleans up expired/used codes. PostgreSQL provides transactional guarantees for the one-time-use constraint.

**Alternatives considered**:
- Redis with TTL — Simpler expiry but no audit trail; Redis keys can be lost on restart if not persisted.
- In-memory cache — Not persistent; lost on restart.

## Decision 8: Bot Blocked Detection (FR-012)

**Decision**: Catch `403 Forbidden` response from `sendMessage` API call and mark TelegramLink as inactive.

**Rationale**: When a user blocks a bot, Telegram returns HTTP 403 with `"description": "Forbidden: bot was blocked by the user"`. The Celery send task catches this specific error and sets `TelegramLink.is_active = False`. The user sees a warning in their settings page. Re-linking requires unlinking first, then re-linking.

**Alternatives considered**:
- Periodic health check pings — Wasteful; detecting on send failure is sufficient and immediate.

## Decision 9: Bulk Notification Batching (Edge Case)

**Decision**: Defer batching to a future iteration. Each task event sends its own Telegram message.

**Rationale**: Bulk updates are rare in the current workflow. Telegram's per-chat rate limit (1 msg/sec) is sufficient for typical usage. Adding batching logic (aggregating multiple notifications into one message) adds significant complexity. If needed later, it can be added as a Celery task that accumulates notifications for a short window (e.g., 5 seconds) before sending a combined message.

**Alternatives considered**:
- Immediate batching — Complex; requires a windowed aggregation system. Not justified by current scale.

## Decision 10: Frontend Settings Page

**Decision**: Create a new `/settings` route with a dedicated `SettingsComponent` for user preferences including Telegram.

**Rationale**: No user settings page exists currently. The settings page will house Telegram linking (deep link display, status, unlink button) and the notification toggle. This is extensible for future user preferences. Accessible from the user avatar menu in the layout header.

**Alternatives considered**:
- Modal dialog — Too cramped for linking flow + toggle + status display.
- Inline in notification dropdown — Poor UX; settings should be in a dedicated page.
