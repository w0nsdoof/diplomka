# API Endpoints

> Auto-generated reference for all REST API endpoints.
> Auth: JWT (access token in header, refresh token in httpOnly cookie).
> Roles: **superadmin**, **manager**, **engineer**, **client**.

---

## Health

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/health/` | `health_check` | No | Public | Returns `{"status": "ok"}` |

---

## Auth (`/api/auth/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| POST | `/api/auth/token/` | CustomTokenObtainPairView | No | Public | Login with email+password; returns access token, sets refresh cookie |
| POST | `/api/auth/token/refresh/` | CookieTokenRefreshView | No | Public | Refresh access token using httpOnly cookie |
| POST | `/api/auth/token/verify/` | DecoratedTokenVerifyView | No | Public | Verify/validate an access token |
| POST | `/api/auth/logout/` | LogoutView | No | Public | Clear refresh token cookie |

---

## Users (`/api/users/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/users/me/` | MeView | Yes | All | Get current user profile |
| PATCH | `/api/users/me/` | MeView | Yes | All | Update current user profile |
| GET | `/api/users/` | UserViewSet.list | Yes | Manager, Engineer | List users (filter: role, is_active, search) |
| POST | `/api/users/` | UserViewSet.create | Yes | Manager | Create user; client role requires client_id |
| GET | `/api/users/{id}/` | UserViewSet.retrieve | Yes | Manager, Engineer | Get user details with assigned_tasks_count |
| PATCH | `/api/users/{id}/` | UserViewSet.partial_update | Yes | Manager | Update user (name, role, is_active, password, client_id) |
| DELETE | `/api/users/{id}/` | UserViewSet.destroy | Yes | Manager | Soft-delete (deactivate) user; cannot deactivate last manager |

---

## Platform (`/api/platform/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/platform/organizations/` | OrganizationViewSet.list | Yes | Superadmin | List organizations with user/task counts |
| POST | `/api/platform/organizations/` | OrganizationViewSet.create | Yes | Superadmin | Create organization (slug auto-generated) |
| GET | `/api/platform/organizations/{id}/` | OrganizationViewSet.retrieve | Yes | Superadmin | Get organization detail with counts by role |
| PATCH | `/api/platform/organizations/{id}/` | OrganizationViewSet.partial_update | Yes | Superadmin | Update organization (name, is_active) |
| GET | `/api/platform/organizations/{id}/managers/` | OrganizationViewSet.managers | Yes | Superadmin | List managers for organization |
| POST | `/api/platform/organizations/{id}/managers/` | OrganizationViewSet.managers | Yes | Superadmin | Create manager for organization |

---

## Projects (`/api/projects/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/projects/` | ProjectViewSet.list | Yes | Manager, Engineer; Client (restricted) | List projects (filter: status, priority, client, search) |
| POST | `/api/projects/` | ProjectViewSet.create | Yes | Manager | Create project; supports team_member_ids |
| GET | `/api/projects/{id}/` | ProjectViewSet.retrieve | Yes | Manager, Engineer; Client (restricted) | Get project details |
| PATCH | `/api/projects/{id}/` | ProjectViewSet.partial_update | Yes | Manager | Update project (optimistic locking via version) |
| DELETE | `/api/projects/{id}/` | ProjectViewSet.destroy | Yes | Manager | Delete project |
| POST | `/api/projects/{id}/status/` | ProjectViewSet.change_status | Yes | Manager | Change project status (optimistic locking) |
| GET | `/api/projects/{id}/epics/` | ProjectViewSet.epics | Yes | Manager, Engineer; Client (restricted) | List epics under project |
| GET | `/api/projects/{id}/history/` | ProjectViewSet.history | Yes | Manager, Engineer | Get project audit history |

---

## Epics (`/api/epics/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/epics/` | EpicViewSet.list | Yes | Manager, Engineer | List epics (filter: project, standalone, status, priority, search) |
| POST | `/api/epics/` | EpicViewSet.create | Yes | Manager, Engineer | Create epic; engineer has limited fields |
| GET | `/api/epics/{id}/` | EpicViewSet.retrieve | Yes | Manager, Engineer | Get epic details |
| PATCH | `/api/epics/{id}/` | EpicViewSet.partial_update | Yes | Manager, Engineer | Update epic (optimistic locking); engineer limited to assigned |
| DELETE | `/api/epics/{id}/` | EpicViewSet.destroy | Yes | Manager | Delete epic |
| POST | `/api/epics/{id}/status/` | EpicViewSet.change_status | Yes | Manager | Change epic status (optimistic locking) |
| GET | `/api/epics/{id}/tasks/` | EpicViewSet.tasks | Yes | Manager, Engineer | List top-level tasks under epic |
| GET | `/api/epics/{id}/history/` | EpicViewSet.history | Yes | Manager, Engineer | Get epic audit history |
| POST | `/api/epics/{id}/generate-tasks/` | EpicViewSet.generate_tasks | Yes | Manager | Trigger AI task generation (Redis-locked) |
| GET | `/api/epics/{id}/generate-tasks/status/` | EpicViewSet.generate_tasks_status | Yes | Manager | Poll AI task generation status (query: task_id) |
| POST | `/api/epics/{id}/confirm-tasks/` | EpicViewSet.confirm_tasks | Yes | Manager | Confirm and create AI-generated tasks |

---

## Tasks (`/api/tasks/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/tasks/` | TaskViewSet.list | Yes | Manager, Engineer; Client (restricted) | List tasks (filter: assignee, tags, status, epic, deadline range, entity_type) |
| POST | `/api/tasks/` | TaskViewSet.create | Yes | Manager, Engineer | Create task; engineer has limited fields |
| GET | `/api/tasks/{id}/` | TaskViewSet.retrieve | Yes | Manager, Engineer; Client (restricted) | Get task details |
| PATCH | `/api/tasks/{id}/` | TaskViewSet.partial_update | Yes | Manager, Engineer | Update task (optimistic locking); engineer limited to assigned |
| DELETE | `/api/tasks/{id}/` | TaskViewSet.destroy | Yes | Manager | Delete task (cascades to attachments, comments, audit, notifications) |
| POST | `/api/tasks/{id}/status/` | TaskViewSet.change_status | Yes | Manager, Engineer | Change task status; done->archived is manager-only |
| POST | `/api/tasks/{id}/assign/` | TaskViewSet.assign | Yes | Manager | Assign/reassign task to active engineers |
| GET | `/api/tasks/{id}/history/` | TaskViewSet.history | Yes | Manager, Engineer | Get task audit history |
| GET | `/api/tasks/{id}/subtasks/` | TaskViewSet.subtasks | Yes | Manager, Engineer; Client (restricted) | List subtasks of a parent task |

### Task Attachments (`/api/tasks/{task_pk}/attachments/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/tasks/{task_pk}/attachments/` | AttachmentViewSet.list | Yes | All | List attachments for task |
| POST | `/api/tasks/{task_pk}/attachments/` | AttachmentViewSet.create | Yes | All | Upload file (max 25 MB; png/jpg/gif/webp/pdf/txt/csv/doc/xlsx/zip/rar) |
| GET | `/api/tasks/{task_pk}/attachments/{pk}/` | AttachmentViewSet.retrieve | Yes | All | Download attachment |
| DELETE | `/api/tasks/{task_pk}/attachments/{pk}/` | AttachmentViewSet.destroy | Yes | Manager | Delete attachment |

### Task Comments (`/api/tasks/{task_pk}/comments/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/tasks/{task_pk}/comments/` | CommentViewSet.list | Yes | All | List comments; clients see only public comments |
| POST | `/api/tasks/{task_pk}/comments/` | CommentViewSet.create | Yes | Manager, Engineer | Add comment with @mention support; clients cannot create |
| PUT | `/api/tasks/{task_pk}/comments/{pk}/` | CommentViewSet.update | Yes | Author only | Replace comment |
| PATCH | `/api/tasks/{task_pk}/comments/{pk}/` | CommentViewSet.partial_update | Yes | Author only | Edit comment |
| DELETE | `/api/tasks/{task_pk}/comments/{pk}/` | CommentViewSet.destroy | Yes | Author only | Delete comment |

---

## Clients (`/api/clients/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/clients/` | ClientViewSet.list | Yes | Manager, Engineer (all); Client (own only) | List clients with tasks_count, employee_count |
| POST | `/api/clients/` | ClientViewSet.create | Yes | Manager | Create client (name unique per org) |
| GET | `/api/clients/{id}/` | ClientViewSet.retrieve | Yes | Manager, Engineer (all); Client (own only) | Get client detail with task_summary, employee_count |
| PATCH | `/api/clients/{id}/` | ClientViewSet.partial_update | Yes | Manager | Update client |

---

## Portal (`/api/portal/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/portal/tickets/` | PortalTicketListView | Yes | Client | List tickets for user's linked client (excludes archived) |
| GET | `/api/portal/tickets/{id}/` | PortalTicketDetailView | Yes | Client | Get ticket detail with public comments and attachments |

---

## Tags (`/api/tags/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/tags/` | TagViewSet.list | Yes | All | List tags (search by name) |
| POST | `/api/tags/` | TagViewSet.create | Yes | All | Create tag (name unique per org) |
| GET | `/api/tags/{id}/` | TagViewSet.retrieve | Yes | All | Get tag details |
| PUT | `/api/tags/{id}/` | TagViewSet.update | Yes | Manager | Replace tag |
| PATCH | `/api/tags/{id}/` | TagViewSet.partial_update | Yes | Manager | Update tag |
| DELETE | `/api/tags/{id}/` | TagViewSet.destroy | Yes | Manager | Delete tag |

---

## Notifications (`/api/notifications/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/notifications/` | NotificationViewSet.list | Yes | All | List notifications (filter: is_read; newest first) |
| PATCH | `/api/notifications/{id}/read/` | NotificationViewSet.mark_read | Yes | All | Mark notification as read |
| POST | `/api/notifications/read-all/` | NotificationViewSet.mark_all_read | Yes | All | Mark all notifications as read; returns updated_count |

---

## Reports (`/api/reports/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/reports/summary/` | ReportSummaryView | Yes | Manager, Engineer | Aggregated task statistics (query: date_from, date_to, client_id) |
| GET | `/api/reports/export/pdf/` | ReportPDFExportView | Yes | Manager | Download report as PDF |
| GET | `/api/reports/export/excel/` | ReportExcelExportView | Yes | Manager | Download report as XLSX |

---

## AI Summaries (`/api/summaries/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/summaries/` | SummaryListView | Yes | Manager, Engineer | List summaries (filter: period_type, status; latest version per period) |
| GET | `/api/summaries/latest/` | SummaryLatestView | Yes | Manager, Engineer | Get latest completed daily and weekly summaries |
| GET | `/api/summaries/{id}/` | SummaryDetailView | Yes | Manager, Engineer | Get summary detail with version count |
| GET | `/api/summaries/{id}/versions/` | SummaryVersionsView | Yes | Manager, Engineer | List all versions for same period group |
| POST | `/api/summaries/generate/` | SummaryGenerateView | Yes | Manager | Trigger on-demand generation (body: period_start, period_end, project_id?, client_id?, focus_prompt?, llm_model_id?) |
| POST | `/api/summaries/{id}/regenerate/` | SummaryRegenerateView | Yes | Manager | Regenerate summary as new version (body: llm_model_id?) |
| GET | `/api/summaries/{id}/generation-status/` | SummaryGenerationStatusView | Yes | Manager, Engineer | Poll generation status (returns status, stage, stage_meta) |

---

## LLM Models (`/api/llm-models/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/llm-models/` | LLMModelListView | Yes | Manager, Engineer | List active LLM models available for AI generation |
| GET | `/api/llm-models/org-default/` | OrgDefaultModelView | Yes | Manager | Get organization's default LLM model |
| PATCH | `/api/llm-models/org-default/` | OrgDefaultModelView | Yes | Manager | Set organization's default LLM model |

---

## Telegram (`/api/telegram/`)

| Method | Endpoint | View | Auth | Roles | Description |
|--------|----------|------|------|-------|-------------|
| GET | `/api/telegram/status/` | telegram_status | Yes | All | Get Telegram link status |
| POST | `/api/telegram/link/` | telegram_link | Yes | Manager, Engineer | Generate linking code and deep link |
| POST | `/api/telegram/unlink/` | telegram_unlink | Yes | All | Unlink Telegram account |
| PATCH | `/api/telegram/notifications/` | telegram_notifications_toggle | Yes | All | Toggle Telegram notifications on/off |
| POST | `/api/telegram/webhook/` | telegram_webhook | No | Public | Telegram Bot webhook (CSRF-exempt, secret-token verified) |

---

## Permission Classes

| Class | Rule | Used By |
|-------|------|---------|
| IsSuperadmin | `user.is_superadmin` | Platform |
| IsManager | `role == "manager"` | Users (CUD), Projects/Epics (CUD/status), Tasks (assign/delete), Tags (UD), Reports (export), Summaries (generate) |
| IsEngineer | `role == "engineer"` | Rarely used directly |
| IsClient | `role == "client"` | Portal |
| IsManagerOrEngineer | `role in (manager, engineer)` | Users (list), Epics (CU), Tasks (CU/status), Reports (summary), Summaries (list), LLM Models (list) |
| IsManagerOrReadOnly | Safe methods for all; write for manager | Projects, Clients, Tags |

## Notes

- **Optimistic locking**: Projects, Epics, and Tasks use a `version` field -- returns `409 Conflict` on stale writes.
- **Organization scoping**: All data is filtered by the authenticated user's organization automatically.
- **Task status transitions**: `created -> in_progress -> waiting | done -> archived` (done->archived is manager-only).
- **Rate limiting**: Applied to auth token endpoints via `AuthRateThrottle`.
- **Pagination**: All list endpoints are paginated (default page size configured globally).
