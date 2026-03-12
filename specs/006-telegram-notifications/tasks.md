# Tasks: Telegram Notifications

**Input**: Design documents from `/specs/006-telegram-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/telegram-api.yaml, quickstart.md

**Tests**: Not explicitly requested in the spec — test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `telegram` Django app, install dependencies, configure settings and routing.

- [x] T001 Add `httpx>=0.27` to `backend/requirements/base.txt`
- [x] T002 Create `telegram` Django app skeleton: `backend/apps/telegram/__init__.py`, `apps.py`, `admin.py`, `urls.py`
- [x] T003 Add `apps.telegram` to `INSTALLED_APPS` in `backend/config/settings/base.py`
- [x] T004 Add Telegram env var reads (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`) in `backend/config/settings/base.py`
- [x] T005 Add `path("api/telegram/", include("apps.telegram.urls"))` to `backend/config/urls.py`
- [x] T006 [P] Add Telegram i18n keys to `frontend/src/i18n/en.json` (settings, link, unlink, notifications toggle, status messages)
- [x] T007 [P] Add Telegram i18n keys to `frontend/src/i18n/ru.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Models, migrations, and core services that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 Create `TelegramLink` model in `backend/apps/telegram/models.py` per data-model.md (fields: user OneToOneField, chat_id BigIntegerField unique, username CharField, is_active BooleanField, telegram_notifications_enabled BooleanField, linked_at DateTimeField, organization ForeignKey)
- [x] T009 Create `TelegramVerificationCode` model in `backend/apps/telegram/models.py` per data-model.md (fields: user ForeignKey, code CharField unique, created_at DateTimeField, expires_at DateTimeField, is_used BooleanField, organization ForeignKey)
- [x] T010 Generate and run initial migration for `telegram` app via `python manage.py makemigrations telegram`
- [x] T011 Register `TelegramLink` and `TelegramVerificationCode` in `backend/apps/telegram/admin.py`
- [x] T012 Create `backend/apps/telegram/services.py` with core helper functions: `send_telegram_message(chat_id, text)` using httpx to call Telegram Bot API `sendMessage` with HTML parse_mode, and `get_bot_username()` returning settings value
- [x] T013 Create `backend/apps/telegram/serializers.py` with `TelegramStatusSerializer` (is_linked, username, is_active, telegram_notifications_enabled, linked_at) and `TelegramNotificationToggleSerializer` (enabled BooleanField)

**Checkpoint**: Foundation ready — models exist, core send function available, user story implementation can begin.

---

## Phase 3: User Story 1 — Link Telegram Account (Priority: P1) 🎯 MVP

**Goal**: Users (manager/engineer) can generate a verification code, click a Telegram deep link, and link their Telegram account to the platform.

**Independent Test**: Log in as manager → navigate to /settings → click "Link Telegram" → click deep link → send /start to bot → settings shows "Connected" with username.

### Implementation for User Story 1

- [x] T014 [US1] Add `generate_verification_code(user)` to `backend/apps/telegram/services.py` — invalidates previous unused codes for user, creates `TelegramVerificationCode` with `secrets.token_urlsafe(32)`, expires_at=now+10min, returns code and deep_link URL
- [x] T015 [US1] Add `verify_code_and_link(code, chat_id, telegram_username)` to `backend/apps/telegram/services.py` — looks up valid unexpired unused code, creates `TelegramLink`, marks code as used, returns success/failure. Validates: role is manager/engineer (FR-013), chat_id not already linked to another user (FR-014)
- [x] T016 [US1] Add `unlink_telegram(user)` to `backend/apps/telegram/services.py` — deletes the user's TelegramLink record (FR-004)
- [x] T017 [US1] Create `backend/apps/telegram/bot.py` — `handle_webhook_update(payload)` function that parses Telegram Update JSON, extracts `/start <code>` from message text, calls `verify_code_and_link()`, sends confirmation or error message back via `send_telegram_message()`
- [x] T018 [US1] Create `TelegramLinkView` (POST, generate code) in `backend/apps/telegram/views.py` — JWT-protected, checks user role (FR-013), checks no existing link (400 if already linked), calls `generate_verification_code()`, returns code + deep_link + expires_at + bot_username per contract
- [x] T019 [US1] Create `TelegramStatusView` (GET) in `backend/apps/telegram/views.py` — JWT-protected, returns link status per contract (is_linked, username, is_active, telegram_notifications_enabled, linked_at)
- [x] T020 [US1] Create `TelegramUnlinkView` (POST) in `backend/apps/telegram/views.py` — JWT-protected, calls `unlink_telegram()`, returns 204 or 400 if no link exists
- [x] T021 [US1] Create `TelegramWebhookView` (POST) in `backend/apps/telegram/views.py` — `@csrf_exempt`, no JWT auth, verifies `X-Telegram-Bot-Api-Secret-Token` header with `hmac.compare_digest()` against settings, calls `handle_webhook_update()`, returns 200 or 403
- [x] T022 [US1] Wire all views in `backend/apps/telegram/urls.py` — `link/`, `status/`, `unlink/`, `webhook/`, `notifications/`
- [x] T023 [US1] Create `backend/apps/telegram/management/__init__.py` and `backend/apps/telegram/management/commands/__init__.py` and `backend/apps/telegram/management/commands/register_telegram_webhook.py` — management command that calls Telegram `setWebhook` API with URL and secret_token
- [x] T024 [US1] Add Celery Beat task `cleanup_expired_verification_codes` in `backend/apps/telegram/tasks.py` — runs hourly, deletes expired/used `TelegramVerificationCode` records
- [x] T025 [US1] Register `cleanup_expired_verification_codes` in Celery Beat schedule in `backend/config/settings/base.py`
- [x] T026 [P] [US1] Create `frontend/src/app/core/services/telegram.service.ts` — methods: `getStatus()`, `generateLink()`, `unlink()`, `toggleNotifications(enabled)` calling backend API endpoints
- [x] T027 [US1] Create `frontend/src/app/features/settings/settings.component.ts` — standalone component with OnPush change detection, displays Telegram link status, "Link Telegram" button (calls generateLink, shows deep link URL), "Unlink" button, linked username display, uses Angular Material (mat-card, mat-button, mat-slide-toggle, mat-icon)
- [x] T028 [US1] Create `frontend/src/app/features/settings/settings.routes.ts` — route config for settings feature
- [x] T029 [US1] Add `/settings` route to `frontend/src/app/app.routes.ts` — guarded by `managerOrEngineerGuard`, lazy-loads settings routes
- [x] T030 [US1] Add "Settings" nav item to layout component nav menu (link to `/settings`, visible for manager/engineer roles only) in `frontend/src/app/core/components/layout/layout.component.ts`

**Checkpoint**: User Story 1 complete — users can link/unlink Telegram accounts via the settings page.

---

## Phase 4: User Story 2 — Toggle Telegram Notifications (Priority: P2)

**Goal**: Users with a linked Telegram can toggle notifications on/off without unlinking.

**Independent Test**: Link Telegram → toggle off → trigger a task event → no Telegram message received → toggle on → trigger event → message received.

### Implementation for User Story 2

- [x] T031 [US2] Create `TelegramNotificationToggleView` (PATCH) in `backend/apps/telegram/views.py` — JWT-protected, updates `TelegramLink.telegram_notifications_enabled`, returns 200 with new state or 400 if no link per contract
- [x] T032 [US2] Add notification toggle UI to `frontend/src/app/features/settings/settings.component.ts` — mat-slide-toggle bound to `telegram_notifications_enabled`, calls `toggleNotifications()`, disabled when not linked, shows prompt to link first if no link

**Checkpoint**: User Story 2 complete — users can toggle Telegram notifications independently.

---

## Phase 5: User Story 3 — Receive Task Notifications via Telegram (Priority: P3)

**Goal**: Users with Telegram linked and notifications enabled receive Telegram messages when tasks involving them are created or updated.

**Independent Test**: Link Telegram + enable notifications → create a task assigned to that user → Telegram message received with task title, priority, actor. Update the task → another message received. Disable notifications → update task → no message.

### Implementation for User Story 3

- [x] T033 [US3] Create `send_telegram_notification` Celery task in `backend/apps/telegram/tasks.py` — accepts `(user_id, notification_message, task_title)`, looks up user's TelegramLink (checks `is_active=True` and `telegram_notifications_enabled=True`), calls `send_telegram_message()` with HTML-formatted message including task title, change description, and deep link to task. Catches 403 Forbidden → sets `is_active=False` (FR-012). Includes retry with backoff for transient errors (FR-010)
- [x] T034 [US3] Create `format_telegram_notification(notification, task)` helper in `backend/apps/telegram/services.py` — formats HTML message with bold task title, event description, actor name, and link to task on the platform (FR-009)
- [x] T035 [US3] Modify `create_notification()` in `backend/apps/notifications/services.py` — after creating the Notification, dispatch `send_telegram_notification.delay(recipient.id, message, task.title)` Celery task. Skip if recipient is the actor (FR-008). Import is inside the function to avoid circular imports
- [x] T036 [US3] Verify that existing notification trigger points in task creation/update services already call `create_notification()` for relevant events (assigned, status change, comment, mention) — no changes expected if they already use the centralized function

**Checkpoint**: User Story 3 complete — all task notifications are delivered via Telegram to linked users.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [x] T037 [P] Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` env var placeholders to `podman-compose.yml` environment section for backend, celery-worker, and celery-beat services
- [x] T038 [P] Add drf-spectacular schema annotations (`@extend_schema`) to all Telegram views in `backend/apps/telegram/views.py`
- [x] T039 Run `ruff check .` from `backend/` and fix any lint issues in new files
- [x] T040 Run quickstart.md validation — verify all setup steps work (install httpx, migrate, register webhook, test linking flow)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — uses TelegramLink model. Logically depends on US1 (can't toggle if not linked) but code can be written independently
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) — uses TelegramLink model and send service. Logically depends on US1 (needs linked account to test)
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each User Story

- Models before services
- Services before views
- Views before URL wiring
- Backend before frontend (frontend needs API to call)
- Core implementation before integration

### Parallel Opportunities

- T006 + T007 (i18n files) can run in parallel
- T008 + T009 are in the same file but defined sequentially
- T026 (frontend service) can run in parallel with backend views (T018–T022)
- T037 + T038 (polish tasks) can run in parallel
- Once Phase 2 completes, US2 and US3 backend work could technically proceed in parallel with US1 (though testing requires US1 flow)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is complete, launch backend service functions in sequence:
Task T014: "Generate verification code service"
Task T015: "Verify code and link service"
Task T016: "Unlink service"

# Then views can proceed (depend on services):
Task T018: "TelegramLinkView"
Task T019: "TelegramStatusView"  # [P] with T018 (different view)
Task T020: "TelegramUnlinkView"  # [P] with T018 (different view)
Task T021: "TelegramWebhookView" # [P] with T018 (different view)

# Frontend can start once API contract is known:
Task T026: "telegram.service.ts" (parallel with backend views)
Task T027: "settings.component.ts" (depends on T026)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T007)
2. Complete Phase 2: Foundational (T008–T013)
3. Complete Phase 3: User Story 1 (T014–T030)
4. **STOP and VALIDATE**: Test linking flow end-to-end
5. Deploy/demo if ready — users can link/unlink Telegram

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test linking → Deploy (MVP!)
3. Add User Story 2 → Test toggle → Deploy
4. Add User Story 3 → Test notifications → Deploy
5. Polish → Final validation → Done

### Suggested MVP Scope

User Story 1 alone provides value: users establish the Telegram communication channel. US2 (toggle) and US3 (notifications) build incrementally on this foundation.
