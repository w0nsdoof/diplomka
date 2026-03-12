# Data Model: Telegram Notifications

**Feature**: 006-telegram-notifications | **Date**: 2026-03-12

## Entity: TelegramLink

Represents the connection between a platform user and a Telegram chat. One-to-one relationship with User (FR-014).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField (PK) | | Primary key |
| user | OneToOneField → User | unique, on_delete=CASCADE | Platform user |
| chat_id | BigIntegerField | unique | Telegram chat ID (stable, immutable identifier) |
| username | CharField(150) | blank=True | Telegram username (display only, may change) |
| is_active | BooleanField | default=True, db_index=True | False when bot is blocked by user (FR-012) |
| telegram_notifications_enabled | BooleanField | default=True | Toggle for notifications (FR-005). Defaults to enabled on linking. |
| linked_at | DateTimeField | auto_now_add=True | When the link was established |
| organization | ForeignKey → Organization | on_delete=CASCADE, db_index=True | Multi-tenancy discriminator |

**Indexes**: `user` (unique), `chat_id` (unique), `organization` (FK index), `is_active`

**Validation rules**:
- User must have role `manager` or `engineer` (FR-013)
- `chat_id` must be unique across all users globally (FR-014) — one Telegram account per platform user

**State transitions**:
- Created: `is_active=True, telegram_notifications_enabled=True` (on successful linking)
- Deactivated: `is_active=False` (when bot detects user blocked it, FR-012)
- Reactivated: requires unlink + re-link
- Deleted: on explicit unlink (FR-004)

## Entity: TelegramVerificationCode

Temporary token for the account linking flow. Short-lived (10 minutes, FR-011).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField (PK) | | Primary key |
| user | ForeignKey → User | on_delete=CASCADE | User who requested the code |
| code | CharField(64) | unique, db_index=True | Verification token (`secrets.token_urlsafe(32)`) |
| created_at | DateTimeField | auto_now_add=True | Code generation timestamp |
| expires_at | DateTimeField | db_index=True | `created_at + 10 minutes` |
| is_used | BooleanField | default=False | True after successful verification |
| organization | ForeignKey → Organization | on_delete=CASCADE | Multi-tenancy discriminator |

**Indexes**: `code` (unique), `expires_at` (for cleanup queries), `user` (FK index)

**Validation rules**:
- Only one active (unused, unexpired) code per user at a time — generating a new code invalidates previous ones
- Code must not be expired (`expires_at > now()`) and not used (`is_used=False`) at verification time

**Lifecycle**:
1. Created when user requests linking → `is_used=False, expires_at=now()+10min`
2. Used when bot receives matching `/start` code → `is_used=True`
3. Expired codes cleaned up by periodic Celery task (hourly)

## Relationships Diagram

```
┌─────────────┐       ┌──────────────────┐
│    User      │──1:1──│  TelegramLink    │
│ (accounts)   │       │  (telegram)      │
│              │       │                  │
│ email        │       │ chat_id (unique) │
│ role         │       │ username         │
│ organization │       │ is_active        │
│              │       │ tg_notif_enabled │
└──────┬───────┘       └──────────────────┘
       │
       │ 1:N (active: max 1)
       │
┌──────┴───────────────────────┐
│  TelegramVerificationCode    │
│  (telegram)                  │
│                              │
│  code (unique)               │
│  expires_at                  │
│  is_used                     │
└──────────────────────────────┘
```

## Existing Models — Modifications

### Notification (apps/notifications/models.py)

**No schema changes required.** The existing `Notification` model already has all fields needed. The Telegram dispatch logic reads from `Notification` + `TelegramLink` and operates as a side effect of `create_notification()`.

### User (apps/accounts/models.py)

**No schema changes required.** Telegram preferences are stored on `TelegramLink` (not on User), keeping the User model clean. The `TelegramLink.user` OneToOneField provides `user.telegramlink` reverse access.

## Migration Notes

- New app `telegram` with initial migration creating both tables
- No changes to existing tables
- Backward compatible — no existing data is modified
