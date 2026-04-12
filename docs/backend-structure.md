# Backend App Structure

Reference for every Django app under `backend/apps/`.

---

## accounts

**Purpose:** Custom email-based user authentication with JWT tokens and role-based access control (superadmin, manager, engineer, client) scoped to organizations.

### Models

| Model | Description |
|-------|-------------|
| **User** | Custom `AbstractUser` with email as `USERNAME_FIELD`; fields for role, organization FK, client FK, avatar, job_title, skills, bio, language (en/ru). |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **MeView** | `GET/PATCH /api/me/` | Retrieve/update own profile (avatar, bio, password, etc.). |
| **UserViewSet** | `/api/users/` | Full CRUD for org users. Managers create/update/deactivate; engineers can list/retrieve. Soft-delete on destroy (sets `is_active=False`). |
| **CustomTokenObtainPairView** | `POST /api/auth/token/` | JWT login; injects role/org claims; sets httpOnly refresh cookie. |
| **CookieTokenRefreshView** | `POST /api/auth/token/refresh/` | Reads refresh token from cookie, returns new access token. |
| **LogoutView** | `POST /api/auth/logout/` | Clears refresh cookie. |

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- **Permissions module** defines reusable classes: `IsSuperadmin`, `IsManager`, `IsEngineer`, `IsClient`, `IsManagerOrEngineer`, `IsManagerOrReadOnly`, `IsAssignedEngineer`.
- Superadmin users must not have an organization; non-superadmins must have one (enforced in `clean()`).
- Destroy prevents deactivation of the last active manager in an organization.
- Avatar uploads capped at 5 MB; old file deleted on replacement.

---

## ai_summaries

**Purpose:** AI-powered report summary generation via LiteLLM with versioning, real-time WebSocket pipeline updates, and fallback templates.

### Models

| Model | Description |
|-------|-------------|
| **LLMModel** | Available LLM models (OpenRouter, Gemini, etc.) with a single system-wide default enforced via custom `save()`. |
| **ReportSummary** | Versioned summary with status lifecycle (pending -> generating -> completed/failed); stores sections, raw metrics, token counts, generation time. Scoped by project/client. |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **SummaryListView** | `GET /api/summaries/` | Paginated list of latest versions per period group; filterable by period_type, status. |
| **SummaryLatestView** | `GET /api/summaries/latest/` | Most recent completed daily and weekly summaries. |
| **SummaryDetailView** | `GET /api/summaries/{id}/` | Full detail including raw metrics, token counts, scope info. |
| **SummaryVersionsView** | `GET /api/summaries/{id}/versions/` | All regeneration versions for same period group. |
| **SummaryGenerateView** | `POST /api/summaries/generate/` | On-demand generation for custom date range with optional project/client scope. Returns 202. |
| **SummaryRegenerateView** | `POST /api/summaries/{id}/regenerate/` | New version of existing summary with optional model override. |
| **SummaryGenerationStatusView** | `GET /api/summaries/{id}/generation-status/` | Poll pipeline stage from Redis. |
| **LLMModelListView** | `GET /api/llm-models/` | List active LLM models. |
| **OrgDefaultModelView** | `GET/PATCH /api/llm-models/org-default/` | Get/set organization's default LLM model. |

### Celery Tasks

| Task | Trigger | Description |
|------|---------|-------------|
| `generate_daily_summary` | Scheduled daily 00:05 UTC | Dispatches daily summaries for all active organizations. |
| `generate_weekly_summary` | Scheduled Monday 06:00 UTC | Dispatches weekly summaries with week-over-week trend deltas. |
| `generate_summary` | Called by views and scheduled tasks | Core task: acquires Redis lock (5 min TTL), orchestrates the generation pipeline. |

### Signals
None.

### Notable Business Logic
- **Generation pipeline stages**: collecting_metrics -> building_prompt -> calling_llm -> parsing_sections -> completed. Each stage broadcast via Django Channels WebSocket + cached in Redis.
- **LLM model resolution priority**: explicit override > org default > system default > `settings.LLM_MODEL`.
- **Fallback templates**: If LLM fails, generates structured Markdown from raw metrics (daily: 2 sections, weekly: 5 sections).
- **Week-over-week trends**: `compute_deltas()` calculates absolute + percentage change; deltas < 20% suppressed as noise.
- Redis locks prevent concurrent generation for the same period/org.
- **WebSocket consumer** (`GenerationConsumer`): clients subscribe to `generation_summary_{id}` for real-time stage updates.

---

## tasks

**Purpose:** Task CRUD with hierarchical subtasks, status state machine, optimistic locking, assignments, and real-time kanban board sync via WebSocket.

### Models

| Model | Description |
|-------|-------------|
| **Task** | Core entity with title, description, priority (low/medium/high/critical), status (created/in_progress/waiting/done/archived), self-referential `parent_task` FK for subtasks, epic FK, client FK, assignees M2M, tags M2M, version field for optimistic locking. |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **TaskViewSet.list** | `GET /api/tasks/` | Paginated with multi-axis filtering (assignee, tags, deadline range, status, epic). Excludes archived/expired-done by default. |
| **TaskViewSet.create** | `POST /api/tasks/` | Role-based serializers (manager vs engineer). Triggers notifications on assignment. |
| **TaskViewSet.partial_update** | `PATCH /api/tasks/{id}/` | Optimistic locking (409 on conflict). Engineers limited to assigned tasks. Broadcasts via Channels. |
| **TaskViewSet.change_status** | `POST /api/tasks/{id}/status/` | Validates transitions via state machine. DONE->ARCHIVED is manager-only. |
| **TaskViewSet.assign** | `POST /api/tasks/{id}/assign/` | Manager-only. Atomically replaces assignee list with notifications. |
| **TaskViewSet.subtasks** | `GET /api/tasks/{id}/subtasks/` | Lists subtasks of a parent task. |
| **TaskViewSet.history** | `GET /api/tasks/{id}/history/` | Paginated audit log. |

### Celery Tasks

| Task | Description |
|------|-------------|
| `auto_archive_done_tasks` | Periodic: archives tasks with status=DONE and deadline in the past. |

### Signals
None.

### Notable Business Logic
- **Status state machine**: CREATED -> IN_PROGRESS -> WAITING | DONE; WAITING -> IN_PROGRESS; DONE -> IN_PROGRESS | ARCHIVED. Invalid transitions return 400.
- **Optimistic locking**: All updates use `version` field; concurrent edits return 409 Conflict.
- **Subtask depth limit**: One level only (no subtasks of subtasks).
- **KanbanConsumer** (WebSocket): JWT auth via query string, joins `kanban_board_{org_id}` group, supports client-side filtering by `client_id`. All task mutations broadcast events.

---

## projects

**Purpose:** Project and epic management with team assignments and AI-powered task generation from epic descriptions.

### Models

| Model | Description |
|-------|-------------|
| **Project** | Title, description, priority, status, single assignee, client FK, tags M2M, team M2M (available assignees), version field. |
| **Epic** | Similar to Project; belongs to a project (optional). `last_generation` JSONField stores raw LLM output for audit. |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **ProjectViewSet** | `/api/projects/` | Full CRUD (manager-only write). Includes `epics` and `history` actions. |
| **EpicViewSet** | `/api/epics/` | Full CRUD with role-based serializers. |
| **EpicViewSet.generate_tasks** | `POST /api/epics/{id}/generate-tasks/` | Manager-only. Acquires Redis lock, dispatches Celery task. Returns 202. |
| **EpicViewSet.generate_tasks_status** | `GET /api/epics/{id}/generate-tasks/status` | Polls Celery task status + Redis pipeline stage. |
| **EpicViewSet.confirm_tasks** | `POST /api/epics/{id}/confirm-tasks/` | Receives edited task list from preview dialog; atomically creates all tasks under epic. |

### Celery Tasks

| Task | Description |
|------|-------------|
| `generate_epic_tasks` | AI task generation pipeline: collects team context + task history, builds prompts, calls LLM, parses/validates JSON response. Stages broadcast via Channels. Soft limit 90s, hard limit 120s. |

### Signals
None.

### Notable Business Logic
- **AI generation pipeline stages**: collecting_context -> building_prompt -> calling_llm -> parsing_response -> validating -> completed.
- **Team context for LLM**: Includes team member profiles (job_title, skills), 30-day task velocity, done tasks matching epic/project tags.
- **Graceful degradation**: Invalid assignees/tags in LLM output are silently dropped with warnings; never fails the whole generation.
- **Audit trail**: `Epic.last_generation` stores raw LLM output (model, tokens, raw tasks, timestamp).
- Projects/epics allow any status transition (no state machine unlike tasks).
- Optimistic locking via `version` field, same pattern as tasks.

---

## notifications

**Purpose:** In-app notifications for task/project/epic events with deadline warnings and client email alerts.

### Models

| Model | Description |
|-------|-------------|
| **Notification** | Immutable record with event_type, recipient FK, related task/project/epic FK, message, is_read flag, `related_object_id` for polymorphic linking. |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **NotificationViewSet.list** | `GET /api/notifications/` | Paginated, filterable by `is_read`. |
| **NotificationViewSet.mark_read** | `PATCH /api/notifications/{id}/read/` | Mark single notification as read. |
| **NotificationViewSet.mark_all_read** | `POST /api/notifications/read-all/` | Mark all unread as read; returns count. |

### Celery Tasks

| Task | Trigger | Description |
|------|---------|-------------|
| `check_approaching_deadlines` | Hourly (Celery Beat) | Creates DEADLINE_WARNING notifications for tasks due within 24 hours. Deduplicated per 24h window. |
| `send_client_status_email` | Triggered on status change | Emails all active client portal users when a task status changes. |

### Signals
None.

### Notable Business Logic
- **Event types**: TASK_ASSIGNED, TASK_UNASSIGNED, MENTION, COMMENT_ADDED, STATUS_CHANGED, DEADLINE_WARNING, SUMMARY_READY, PROJECT_ASSIGNED, PROJECT_UNASSIGNED, EPIC_ASSIGNED, EPIC_UNASSIGNED.
- `create_notification()` service: creates record + dispatches async Telegram notification. Skips Telegram if recipient is actor.
- No signals — upstream apps call `create_notification()` directly.

---

## telegram

**Purpose:** Telegram bot integration for linked accounts, verification codes, and bilingual (en/ru) async message delivery.

### Models

| Model | Description |
|-------|-------------|
| **TelegramLink** | OneToOne to User; stores `chat_id`, `username`, `is_active` flag, `telegram_notifications_enabled` toggle, `linked_at` timestamp. |
| **TelegramVerificationCode** | Temporary 10-minute token for deep link verification; `code`, `expires_at`, `is_used` fields. |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **telegram_status** | `GET /api/telegram/status/` | Returns link status (is_linked, username, is_active, enabled). |
| **telegram_link** | `POST /api/telegram/link/` | Generates verification code + deep link URL. Manager/engineer only. |
| **telegram_unlink** | `POST /api/telegram/unlink/` | Deletes TelegramLink record. |
| **telegram_notifications_toggle** | `PATCH /api/telegram/notifications/` | Toggle notification delivery on/off. |
| **telegram_webhook** | `POST /api/telegram/webhook/` | CSRF-exempt, secret-validated. Dispatches to bot handler. |

### Celery Tasks

| Task | Description |
|------|-------------|
| `send_telegram_notification` | Renders bilingual message from template, sends via Bot API. Detects 403 (bot blocked) and deactivates link. Max 3 retries. |
| `cleanup_expired_verification_codes` | Deletes expired or used verification codes. |

### Signals
None.

### Notable Business Logic
- **Verification flow**: User gets deep link -> clicks -> bot `/start` -> code verified -> TelegramLink created.
- **Fallback commands**: `/verify <code>` or pasting raw code auto-detected by regex if deep link fails.
- **Bot block detection**: 403 from Telegram API marks link as inactive (preserves audit trail).
- **Role gating**: Only manager/engineer can link (client excluded).
- **Unique chat_id**: Same Telegram account cannot link to multiple backend users.
- **Bilingual templates**: `render_telegram_message()` formats HTML messages with emoji, headings, and field labels in user's language.
- **Management command**: `register_telegram_webhook` registers the bot webhook URL with Telegram API.

---

## reports

**Purpose:** Aggregated task/project metrics (lead time, cycle time, status distribution) with PDF and Excel export.

### Models
None (all data computed at query time from Task and AuditLogEntry).

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **ReportSummaryView** | `GET /api/reports/` | JSON report with period filters, task counts, resolution times, per-client/engineer/tag breakdowns. |
| **ReportPDFExportView** | `GET /api/reports/pdf/` | Streams generated PDF (WeasyPrint). Manager-only. |
| **ReportExcelExportView** | `GET /api/reports/excel/` | Streams generated XLSX (multi-sheet). Manager-only. |

### Celery Tasks
None (generation is synchronous per request).

### Signals
None.

### Notable Business Logic
- **Metrics computed**: total tasks, status/priority distribution, created/closed in period, overdue (new vs inherited), stuck waiting 3+ days, completion rate, lead/cycle time (avg, median, p90), approaching deadlines (next 48h), status transitions.
- **Period scoping**: Task creation date for filtering; audit log timestamps for crediting completions.
- `get_report_data()` is also consumed by `ai_summaries` for LLM prompt context.

---

## organizations

**Purpose:** Multi-tenant isolation boundary; every user, task, and client is scoped to an organization.

### Models

| Model | Description |
|-------|-------------|
| **Organization** | `name` (unique), `slug` (auto-generated with collision handling), `is_active`, `default_llm_model` FK to LLMModel. |

### Key Views
None (managed via Django admin and the `platform` app).

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- **OrganizationQuerySetMixin**: DRF mixin auto-filtering querysets by `request.user.organization`. Superadmins get empty querysets.
- **Management command**: `createsuperadmin` creates a superadmin user (no org, `is_staff=True`).
- Slug auto-generation handles collisions by appending `-N` suffix.

---

## clients

**Purpose:** Client CRUD and a portal for client-role users to view their tickets, public comments, and attachments.

### Models

| Model | Description |
|-------|-------------|
| **Client** | Name, client_type (company/individual), phone, email, contact_person, organization FK. Unique (name, organization). |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **ClientViewSet** | `/api/clients/` | CRUD (manager write, others read). List annotates tasks_count + employee_count. Detail annotates per-status task counts. |
| **PortalTicketListView** | `GET /api/portal/tickets/` | Client-role only. Non-archived tasks for user's linked client. |
| **PortalTicketDetailView** | `GET /api/portal/tickets/{id}/` | Full ticket with public comments and attachment details. |

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- Client-role users see only tasks linked to their `client_id`.
- Portal exposes only `is_public=True` comments.
- Client name uniqueness enforced per organization.

---

## attachments

**Purpose:** File upload/download for tasks and comments with MIME type and size validation.

### Models

| Model | Description |
|-------|-------------|
| **Attachment** | File record linked to task (required) and comment (optional); stores original_filename, file_size, content_type, uploaded_by FK. |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **AttachmentViewSet** | `/api/tasks/{id}/attachments/` | List (scoped to task), create (upload), retrieve (download as FileResponse), destroy (manager-only). |

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- **Allowed types**: PNG, JPEG, GIF, WebP, PDF, TXT, CSV, DOC/DOCX, XLS/XLSX, ZIP, RAR, 7-Zip.
- **Max file size**: 25 MB.
- Upload creates an audit log entry (`FILE_ATTACHED`).
- Download uses `FileResponse` with `as_attachment=True`.

---

## audit

**Purpose:** Immutable audit trail recording all entity changes (status, fields, comments, files, assignments).

### Models

| Model | Description |
|-------|-------------|
| **AuditLogEntry** | Records actor, action (status_change/field_update/comment_added/file_attached/assignment_change), field_name, old_value, new_value, timestamp. FK to task/project/epic (one per entry). |

### Key Views
None (accessed via parent entity `history` endpoints in tasks/projects apps).

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- `create_audit_entry()` service function used throughout the codebase.
- Entries are immutable. Indexed on `(task, timestamp)` and `(action, new_value, timestamp)`.

---

## comments

**Purpose:** Task comments with @mention parsing, role-based visibility, and file attachments.

### Models

| Model | Description |
|-------|-------------|
| **Comment** | Content (TextField), author FK, task FK, `is_public` flag, mentions M2M (User). |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **CommentViewSet** | `/api/tasks/{id}/comments/` | Full CRUD. Client users see only public comments. Author-only edit/delete. |

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- **@mention parsing**: `parse_mentions()` extracts `@FirstName LastName` from content, stores in M2M, sends notifications to newly mentioned users.
- Comments can be attachment-only (no text required if files present).
- Client-role users cannot create comments (403).
- On edit, mentions are re-parsed; only newly mentioned users are notified.

---

## tags

**Purpose:** Organization-scoped tags for task categorization with color support.

### Models

| Model | Description |
|-------|-------------|
| **Tag** | Name (max 50), color (hex `#RRGGBB`, default `#6c757d`), organization FK. Unique (name, organization). |

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **TagViewSet** | `/api/tags/` | Full CRUD. Any authenticated user can list/create; manager-only update/delete. |

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- Tag names unique per organization.
- Color validated as hex `#RRGGBB` regex.

---

## common

**Purpose:** Shared service functions and serializer mixins used across apps.

### Models
None.

### Key Views
None.

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- **`update_with_version()`**: Generic optimistic locking — updates instance, increments version, creates audit entries for changed fields. Returns `(success, error_msg, updated_instance)`.
- **`apply_versioned_status_change()`**: Same pattern for status-only changes.
- **`CommonValidatorsMixin`**: DRF mixin with `validate_*` methods for assignee_id, client_id, tag_ids, team_member_ids, project_id, epic_id — checks active status, org membership, existence.

---

## platform

**Purpose:** Superadmin-only endpoints for organization and manager provisioning.

### Models
None (operates on Organization and User from other apps).

### Key Views

| View | Endpoint | Description |
|------|----------|-------------|
| **OrganizationViewSet** | `/api/platform/organizations/` | List/create/update orgs with annotated counts (users, tasks, clients). |
| **OrganizationViewSet.managers** | `GET/POST /api/platform/organizations/{id}/managers/` | List org managers; create new manager user. |

### Celery Tasks
None.

### Signals
None.

### Notable Business Logic
- All endpoints require `IsSuperadmin`.
- List annotates `user_count`, `task_count`; detail adds role breakdown (`manager_count`, `engineer_count`, `client_user_count`) and `client_count`.
- Cannot add managers to inactive organizations.
