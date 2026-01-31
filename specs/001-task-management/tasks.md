# Tasks: Task Management System for IT Outsourcing Teams

**Input**: Design documents from `/specs/001-task-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested — test tasks are omitted. Add tests per constitution (70% coverage) during or after implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/` (Django 5 + DRF)
- **Frontend**: `frontend/` (Angular 17 + Angular Material)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, containerization, and tooling

- [x] T001 Create root project structure with `backend/`, `frontend/`, `podman-compose.yml`, and `.env.example` per plan.md
- [x] T002 Initialize Django 5 project in `backend/config/` with split settings (`backend/config/settings/base.py`, `backend/config/settings/dev.py`, `backend/config/settings/prod.py`)
- [x] T003 [P] Create `backend/requirements/base.txt` with core dependencies (Django 5, djangorestframework, django-channels, celery, djangorestframework-simplejwt, drf-spectacular, weasyprint, openpyxl, channels-redis, django-cors-headers, Pillow)
- [x] T004 [P] Create `backend/requirements/dev.txt` with dev dependencies (pytest, pytest-django, pytest-cov, factory-boy, ruff, django-debug-toolbar)
- [x] T005 [P] Create `backend/requirements/prod.txt` with prod dependencies (gunicorn, sentry-sdk, whitenoise)
- [x] T006 Initialize Angular 17 project in `frontend/` with Angular Material, `@angular/cdk/drag-drop`, `@fullcalendar/angular`, `@angular/localize`
- [x] T007 [P] Configure ruff linting in `backend/pyproject.toml` (PEP 8 per constitution Principle I)
- [x] T008 [P] Configure ESLint + Prettier in `frontend/.eslintrc.json` and `frontend/.prettierrc` (Angular Style Guide per constitution Principle I)
- [x] T009 Write `podman-compose.yml` with services: db (PostgreSQL 16), redis (Redis 7), backend (Django dev server), frontend (Angular CLI), celery-worker, celery-beat
- [x] T010 Write `backend/Dockerfile` (multi-stage: Python 3.11-slim)
- [x] T011 [P] Write `frontend/Dockerfile` (multi-stage: Node 18 -> nginx)
- [x] T012 Configure Celery app in `backend/config/celery.py` and register it in `backend/config/__init__.py`
- [x] T013 Configure Django Channels with Redis layer in `backend/config/settings/base.py` (CHANNEL_LAYERS setting) and ASGI routing in `backend/config/asgi.py`
- [x] T014 [P] Configure i18n in `backend/config/settings/base.py` (LANGUAGES: ru, en; LOCALE_PATHS) and create `backend/locale/` directory structure
- [x] T015 [P] Create `frontend/src/i18n/ru.json` and `frontend/src/i18n/en.json` with empty translation stubs; configure `@angular/localize` in `frontend/angular.json`
- [x] T016 Create `frontend/proxy.conf.json` for dev proxy to backend API and WebSocket

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T017 Create custom User model (email-based auth, role field) in `backend/apps/accounts/models.py` with custom UserManager per data-model.md
- [x] T018 Create initial Django migration for accounts app; add `pg_trgm` extension via RunSQL migration in `backend/apps/accounts/migrations/`
- [x] T019 Configure `djangorestframework-simplejwt` in `backend/config/settings/base.py` (SIMPLE_JWT settings: access 30min, refresh 7d, rotation, blacklist)
- [x] T020 Implement JWT auth endpoints (token obtain, refresh, verify) in `backend/apps/accounts/views.py` and register in `backend/config/urls.py` at `/api/auth/`
- [x] T021 [P] Create RBAC permission classes (IsManager, IsEngineer, IsClient, IsAssignedEngineer) in `backend/apps/accounts/permissions.py`
- [x] T022 [P] Create DRF pagination class (page-based, default 20, max 100) in `backend/config/pagination.py`; set as DEFAULT_PAGINATION_CLASS in settings
- [x] T023 [P] Configure drf-spectacular in `backend/config/settings/base.py` and add schema/swagger/redoc URLs in `backend/config/urls.py` at `/api/schema/`
- [x] T024 [P] Create base Angular services: `AuthService` (JWT storage, login/logout, token refresh) in `frontend/src/app/core/services/auth.service.ts`
- [x] T025 [P] Create JWT interceptor in `frontend/src/app/core/interceptors/jwt.interceptor.ts` and error interceptor in `frontend/src/app/core/interceptors/error.interceptor.ts`
- [x] T026 [P] Create role-based route guards (ManagerGuard, EngineerGuard, ClientGuard) in `frontend/src/app/core/guards/`
- [x] T027 Create Angular app routing with lazy-loaded feature modules in `frontend/src/app/app.config.ts` and `frontend/src/app/app.routes.ts`
- [x] T028 Create login page component in `frontend/src/app/core/components/login/` with email/password form and JWT token handling
- [x] T029 Create app shell (sidebar navigation, header with user info/notifications bell, role-based menu items) in `frontend/src/app/core/components/layout/`
- [x] T030 Implement user management API (list, create, detail, update, deactivate) in `backend/apps/accounts/serializers.py` and `backend/apps/accounts/views.py`; register at `/api/users/` (manager only)
- [x] T031 [P] Create user management admin page in `frontend/src/app/features/admin/` (user list, create user form, role assignment — manager only)

**Checkpoint**: Foundation ready — JWT auth works, roles enforced, navigation shell renders, user management functional

---

## Phase 3: User Story 1 — Manager Creates and Assigns a Task (Priority: P1) 🎯 MVP

**Goal**: A manager can create a task with all fields, assign engineers, attach files, link to client, and add tags. The assigned engineer receives a notification.

**Independent Test**: Create a task with all fields, assign an engineer, verify it appears in the system with correct data and notification is generated.

### Implementation for User Story 1

- [x] T032 [P] [US1] Create Client model in `backend/apps/clients/models.py` per data-model.md (name, client_type, phone, email, contact_person, timestamps)
- [x] T033 [P] [US1] Create Tag model in `backend/apps/tags/models.py` per data-model.md (name unique, slug auto-generated, color optional)
- [x] T034 [US1] Create Task model in `backend/apps/tasks/models.py` per data-model.md (title, description, priority, status, deadline, client FK, created_by FK, version, assignees M2M, tags M2M) with TextChoices enums for priority and status
- [x] T035 [P] [US1] Create Attachment model in `backend/apps/attachments/models.py` per data-model.md (task FK, file, original_filename, file_size, content_type, uploaded_by FK)
- [x] T036 [P] [US1] Create Notification model in `backend/apps/notifications/models.py` per data-model.md (recipient FK, event_type, task FK, message, is_read, created_at)
- [x] T037 [P] [US1] Create AuditLogEntry model in `backend/apps/audit/models.py` per data-model.md (task FK, actor FK, action, field_name, old_value, new_value, timestamp)
- [x] T038 [US1] Generate and run Django migrations for all new models (clients, tasks, tags, attachments, notifications, audit); include composite indexes per data-model.md
- [x] T039 [US1] Implement status transition validation service in `backend/apps/tasks/services.py` (validate_transition, apply_transition with audit log creation)
- [x] T040 [US1] Implement optimistic concurrency control in `backend/apps/tasks/services.py` (version-based update with 409 Conflict on mismatch per data-model.md)
- [x] T041 [US1] Create Task serializers in `backend/apps/tasks/serializers.py` (TaskListSerializer, TaskDetailSerializer, TaskCreateSerializer, TaskStatusChangeSerializer, TaskAssignSerializer) with field validation per data-model.md
- [x] T042 [P] [US1] Create Client serializers and viewset in `backend/apps/clients/serializers.py` and `backend/apps/clients/views.py`; register at `/api/clients/` (manager CRUD)
- [x] T043 [P] [US1] Create Tag serializers and viewset in `backend/apps/tags/serializers.py` and `backend/apps/tags/views.py`; register at `/api/tags/` (list, create, delete)
- [x] T044 [US1] Create Task viewset in `backend/apps/tasks/views.py` (list with pagination, create, detail, update, status change, assign) with RBAC permissions; register at `/api/tasks/`
- [x] T045 [US1] Implement file attachment upload/download/delete API in `backend/apps/attachments/serializers.py` and `backend/apps/attachments/views.py` with MIME type allowlist and 25 MB size validation; register at `/api/tasks/{id}/attachments/`
- [x] T046 [US1] Create notification service in `backend/apps/notifications/services.py` (create_notification for task_assigned, task_unassigned, mention, comment_added, status_changed, deadline_warning events)
- [x] T047 [US1] Create notification API (list, mark read, mark all read) in `backend/apps/notifications/serializers.py` and `backend/apps/notifications/views.py`; register at `/api/notifications/`
- [x] T048 [US1] Implement audit log creation on task changes (status, field updates, assignment) in `backend/apps/audit/services.py`; create read-only API for task history at `/api/tasks/{id}/history/`
- [x] T049 [P] [US1] Create Angular Task API service in `frontend/src/app/core/services/task.service.ts` (CRUD, status change, assign, search, filter)
- [x] T050 [P] [US1] Create Angular Client API service in `frontend/src/app/core/services/client.service.ts`
- [x] T051 [P] [US1] Create Angular Tag API service in `frontend/src/app/core/services/tag.service.ts`
- [x] T052 [P] [US1] Create Angular Notification API service in `frontend/src/app/core/services/notification.service.ts`
- [x] T053 [US1] Create task creation form component in `frontend/src/app/features/tasks/components/task-form/` (title, description, priority selector, deadline picker, client selector with search, tag multi-select, assignee multi-select, file upload dropzone)
- [x] T054 [US1] Create task detail page component in `frontend/src/app/features/tasks/components/task-detail/` (all task fields, file list with download, assignment display, status badge, audit history timeline)
- [x] T055 [US1] Create task list page component in `frontend/src/app/features/tasks/components/task-list/` (table with columns: title, status, priority, assignees, client, deadline; row actions)
- [x] T056 [US1] Wire notification bell in app header to notification service; show unread count badge and dropdown list in `frontend/src/app/core/components/layout/`

**Checkpoint**: Manager can create tasks, assign engineers, attach files, link clients, add tags. Notifications are generated. Task list displays all tasks. This is the **MVP**.

---

## Phase 4: User Story 2 — Engineer Works on an Assigned Task (Priority: P1)

**Goal**: An engineer can view all tasks (assigned highlighted), change status through the workflow, add comments with @mentions, attach files. All changes are audit-logged.

**Independent Test**: Log in as engineer, view task list, change task status through Created → In Progress → Done, add comments with @mentions, verify audit log.

### Implementation for User Story 2

- [x] T057 [P] [US2] Create Comment model in `backend/apps/comments/models.py` per data-model.md (task FK, author FK, content, is_public, mentions M2M, created_at)
- [x] T058 [US2] Generate and run Django migration for comments app
- [x] T059 [US2] Implement @mention parsing service in `backend/apps/comments/services.py` (extract @mentions from content, resolve to User objects, create notifications for mentioned users)
- [x] T060 [US2] Create Comment serializers and viewset in `backend/apps/comments/serializers.py` and `backend/apps/comments/views.py` (list filtered by is_public for clients, create with @mention parsing); register at `/api/tasks/{id}/comments/`
- [x] T061 [US2] Add engineer-specific permission logic to Task viewset: engineers can view all tasks, change status only on assigned tasks, can comment on all tasks, cannot update other task fields
- [x] T062 [P] [US2] Create Angular Comment service in `frontend/src/app/core/services/comment.service.ts`
- [x] T063 [US2] Create comment section component in `frontend/src/app/features/tasks/components/comment-section/` (comment list, add comment form with @mention autocomplete, public/private toggle for managers)
- [x] T064 [US2] Add status change controls to task detail page in `frontend/src/app/features/tasks/components/task-detail/` (dropdown showing only valid transitions, confirmation dialog)
- [x] T065 [US2] Update task list component to highlight engineer's assigned tasks and show "My Tasks" quick filter in `frontend/src/app/features/tasks/components/task-list/`
- [x] T066 [US2] Add audit history display to task detail page (timeline of all changes with actor, action, timestamp) in `frontend/src/app/features/tasks/components/task-detail/`

**Checkpoint**: Engineers can work through the full task lifecycle. Comments with @mentions work. Audit trail is visible.

---

## Phase 5: User Story 3 — Kanban Board with Real-Time Updates (Priority: P2)

**Goal**: Manager sees all tasks organized in status columns. Drag-and-drop changes status. Real-time updates via WebSocket.

**Independent Test**: Open Kanban board, see tasks in correct columns, drag a card between columns, verify status updates. Open in two browsers simultaneously and see real-time sync.

### Implementation for User Story 3

- [x] T067 [US3] Create Kanban WebSocket consumer in `backend/apps/tasks/consumers.py` (authenticate JWT from query param, subscribe to task updates, broadcast status changes to connected clients)
- [x] T068 [US3] Configure WebSocket routing in `backend/config/asgi.py` (route `ws/kanban/` to KanbanConsumer)
- [x] T069 [US3] Add WebSocket broadcast calls to task status change service in `backend/apps/tasks/services.py` (send task_status_changed, task_created, task_updated events to Channels group)
- [x] T070 [P] [US3] Create Angular WebSocket service in `frontend/src/app/core/services/websocket.service.ts` (connect to ws/kanban/, handle JWT auth, reconnect on disconnect, parse incoming events)
- [x] T071 [US3] Create Kanban board component in `frontend/src/app/features/tasks/components/kanban-board/` (columns: Created, In Progress, Waiting, Done; cards with title, priority color, assignee avatar, deadline)
- [x] T072 [US3] Implement drag-and-drop between columns using Angular CDK DragDrop in `frontend/src/app/features/tasks/components/kanban-board/` (validate transition before API call, show error on invalid transition)
- [x] T073 [US3] Integrate WebSocket events into Kanban board (update card positions in real-time when other users make changes)
- [x] T074 [US3] Add filter controls to Kanban board (by performer, client, priority, tags) in `frontend/src/app/features/tasks/components/kanban-board/`

**Checkpoint**: Kanban board works with drag-and-drop and real-time updates. Filters work.

---

## Phase 6: User Story 4 — Search and Filters (Priority: P2)

**Goal**: Manager can search tasks by title, description, client name. Filter by status, priority, deadline range, performer, client, tags.

**Independent Test**: Create multiple tasks with varied attributes, search by keyword, apply combined filters, verify correct results.

### Implementation for User Story 4

- [x] T075 [US4] Add PostgreSQL full-text search to Task viewset in `backend/apps/tasks/views.py` using `SearchVector` on title + description and JOIN to Client.name; add GIN index migration in `backend/apps/tasks/migrations/`
- [x] T076 [US4] Add DRF filter backends to Task viewset in `backend/apps/tasks/views.py` (django-filter for status, priority, deadline__gte, deadline__lte, assignees, client, tags; SearchFilter for full-text)
- [x] T077 [US4] Add "overdue" filter to Task viewset (tasks where deadline < now and status not in [done, archived])
- [x] T078 [US4] Create search bar component with debounced input in `frontend/src/app/shared/components/search-bar/`
- [x] T079 [US4] Create filter panel component in `frontend/src/app/features/tasks/components/filter-panel/` (status multi-select, priority multi-select, deadline date range picker, performer dropdown, client dropdown, tag multi-select, overdue toggle)
- [x] T080 [US4] Integrate search bar and filter panel into task list page; sync filter state with URL query params for bookmarkable filtered views

**Checkpoint**: Full-text search and all filters work on the task list. Filters are combinable and URL-persistable.

---

## Phase 7: User Story 5 — Client Directory (Priority: P2)

**Goal**: Manager maintains a client directory. Tasks can be linked to clients. Client profile shows all associated tasks.

**Independent Test**: Add clients, link tasks to clients, view client profile with task summary.

### Implementation for User Story 5

- [x] T081 [US5] Add task summary aggregation to Client detail endpoint in `backend/apps/clients/views.py` (total tasks, by status counts)
- [x] T082 [US5] Add `/api/clients/{id}/tasks/` nested endpoint in `backend/apps/clients/views.py` (paginated, filterable task list for a specific client)
- [x] T083 [US5] Create client list page in `frontend/src/app/features/clients/components/client-list/` (table with name, type, contact info, task count; search bar)
- [x] T084 [US5] Create client detail page in `frontend/src/app/features/clients/components/client-detail/` (client info, task summary stats, linked tasks table)
- [x] T085 [US5] Create client form component (add/edit) in `frontend/src/app/features/clients/components/client-form/` (name, type, phone, email, contact_person)

**Checkpoint**: Client directory is functional. Clients can be created, edited, and linked to tasks. Client profiles show associated tasks.

---

## Phase 8: User Story 6 — Calendar View and Deadline Notifications (Priority: P3)

**Goal**: Manager views task deadlines on a calendar. System sends notifications 24 hours before deadlines.

**Independent Test**: Create tasks with various deadlines, open calendar view, verify tasks appear on correct dates. Verify deadline notification Celery task works.

### Implementation for User Story 6

- [x] T086 [US6] Add deadline date range filter endpoint to Task viewset (already partially done in T076 — verify `/api/tasks/?deadline__gte=&deadline__lte=` works for calendar date ranges)
- [x] T087 [US6] Create Celery periodic task `check_approaching_deadlines` in `backend/apps/notifications/tasks.py` (find tasks with deadline within 24 hours, status not done/archived, send notification to assignees and creator)
- [x] T088 [US6] Register Celery beat schedule for deadline check (hourly) in `backend/config/settings/base.py` (CELERY_BEAT_SCHEDULE)
- [x] T089 [US6] Create calendar view page in `frontend/src/app/features/calendar/` using FullCalendar Angular wrapper (month/week views, tasks plotted on deadline dates, priority color coding)
- [x] T090 [US6] Add click handler on calendar dates to show task summary popup/panel in `frontend/src/app/features/calendar/`
- [x] T091 [US6] Wire calendar view to Task API service (fetch tasks by visible date range, update on navigation)

**Checkpoint**: Calendar view shows deadlines. Celery sends deadline notifications. Clicking dates shows task details.

---

## Phase 9: User Story 7 — Reports Export (Priority: P3)

**Goal**: Manager generates reports filtered by date range with PDF and Excel export.

**Independent Test**: Generate a report for a date range, export as PDF and Excel, verify correct data in both formats.

### Implementation for User Story 7

- [x] T092 [US7] Create report summary endpoint in `backend/apps/reports/views.py` at `/api/reports/summary/` (aggregate task stats by status, priority, performer, client for date range; manager only)
- [x] T093 [US7] Implement PDF report generation with WeasyPrint in `backend/apps/reports/services.py` (HTML template → PDF; include task summary, per-performer breakdown, per-client breakdown)
- [x] T094 [US7] Create PDF export endpoint at `/api/reports/export/pdf/` in `backend/apps/reports/views.py` (accepts date_from, date_to, client_id filters; returns binary PDF response)
- [x] T095 [US7] Implement Excel report generation with openpyxl in `backend/apps/reports/services.py` (structured worksheets: summary, by performer, by client, task detail rows)
- [x] T096 [US7] Create Excel export endpoint at `/api/reports/export/excel/` in `backend/apps/reports/views.py` (returns .xlsx binary response)
- [x] T097 [US7] Create report page in `frontend/src/app/features/reports/` (date range picker, optional client filter, summary dashboard with charts, export PDF/Excel buttons)

**Checkpoint**: Reports with date range filtering work. PDF and Excel exports download correctly with accurate data.

---

## Phase 10: User Story 8 — Client Portal (Priority: P3)

**Goal**: External client logs in and sees read-only view of their tickets with public comments.

**Independent Test**: Log in as client user, see only own organization's tickets, verify no edit controls exist, verify only public comments are visible.

### Implementation for User Story 8

- [x] T098 [US8] Create client portal ticket list endpoint at `/api/portal/tickets/` in `backend/apps/clients/views.py` (filter tasks by client's organization, client role only, paginated)
- [x] T099 [US8] Create client portal ticket detail endpoint at `/api/portal/tickets/{id}/` in `backend/apps/clients/views.py` (task detail with only public comments, client's own attachments)
- [x] T100 [US8] Implement Celery task for email notification to client on ticket status change in `backend/apps/notifications/tasks.py` (trigger on status_change event, send email via Django mail backend)
- [x] T101 [US8] Create portal ticket list page in `frontend/src/app/features/portal/components/ticket-list/` (read-only table: title, status, priority, deadline, created date)
- [x] T102 [US8] Create portal ticket detail page in `frontend/src/app/features/portal/components/ticket-detail/` (task info, public comments only, attachments, no edit controls)
- [x] T103 [US8] Configure client-role routing in `frontend/src/app/app.routes.ts` (redirect client users to portal, hide non-portal navigation items)

**Checkpoint**: Client portal is read-only. Clients see only their tickets and public comments. Email notifications sent on status changes.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T104 [P] Extract and translate all backend user-facing strings using Django `gettext` in all apps; generate `.po` files with `makemessages` for ru and en locales in `backend/locale/`
- [x] T105 [P] Extract and translate all frontend user-facing strings in `frontend/src/i18n/ru.json` and `frontend/src/i18n/en.json`
- [x] T106 Add language preference to User model and create language switcher component in `frontend/src/app/core/components/layout/`; send `Accept-Language` header via interceptor
- [x] T107 [P] ~~REMOVED~~ — custom AuditLogEntry is the sole audit mechanism; django-simple-history is not used to avoid dual-logging confusion. Remove `django-simple-history` from `backend/requirements/base.txt` if present.
- [x] T108 Add `select_related` and `prefetch_related` optimization to all viewset querysets per constitution Principle IV (Task.assignees, Task.tags, Task.client, Comment.mentions, Notification.task)
- [x] T109 [P] Create comprehensive error handling: backend DRF exception handler in `backend/config/exceptions.py`; frontend global error handler and user-friendly toast notifications
- [x] T110 [P] Add OpenAPI `@extend_schema` decorators to all viewsets for request/response examples and error codes per constitution Principle VII
- [x] T111 Perform security review: verify all endpoints require JWT (except auth), validate CORS settings for prod, ensure file upload MIME validation cannot be bypassed, verify RBAC on all endpoints
- [x] T112 Run quickstart.md validation: follow setup steps from scratch, verify all access points work, verify podman-compose brings up all services correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — creates core models used by all subsequent stories
- **US2 (Phase 4)**: Depends on US1 (needs Task model and task API)
- **US3 (Phase 5)**: Depends on US1 (needs tasks to display on Kanban) + US2 (needs status change flow)
- **US4 (Phase 6)**: Depends on US1 (needs tasks to search/filter)
- **US5 (Phase 7)**: Depends on US1 (needs Client model and task-client linking — Client model created in US1)
- **US6 (Phase 8)**: Depends on US1 (needs tasks with deadlines)
- **US7 (Phase 9)**: Depends on US1 (needs tasks for report data)
- **US8 (Phase 10)**: Depends on US1 + US2 (needs tasks, comments with public flag)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — **No dependencies on other stories**
- **US2 (P1)**: After US1 — needs Task model, task viewset
- **US3 (P2)**: After US2 — needs status change flow for drag-and-drop
- **US4 (P2)**: After US1 — can parallel with US2, US3, US5
- **US5 (P2)**: After US1 — can parallel with US2, US3, US4
- **US6 (P3)**: After US1 — can parallel with US2-US5
- **US7 (P3)**: After US1 — can parallel with US2-US6
- **US8 (P3)**: After US2 — needs comments with public flag

### Within Each User Story

- Models before services
- Services before API endpoints
- API endpoints before frontend services
- Frontend services before frontend components
- Core implementation before integration

### Parallel Opportunities

- Setup tasks T003, T004, T005, T007, T008, T011 can all run in parallel
- Foundational tasks T021-T026, T031 can run in parallel after T017-T020
- US1 models T032, T033, T035, T036, T037 can all run in parallel (T034 depends on T032 for Client FK)
- US1 frontend services T049-T052 can all run in parallel
- After Foundational: US4, US5, US6, US7 can all run in parallel (all depend only on US1)

---

## Parallel Example: User Story 1

```bash
# Launch all independent models in parallel:
Task: "T032 [P] [US1] Create Client model in backend/apps/clients/models.py"
Task: "T033 [P] [US1] Create Tag model in backend/apps/tags/models.py"
Task: "T035 [P] [US1] Create Attachment model in backend/apps/attachments/models.py"
Task: "T036 [P] [US1] Create Notification model in backend/apps/notifications/models.py"
Task: "T037 [P] [US1] Create AuditLogEntry model in backend/apps/audit/models.py"

# After models + migrations, launch parallel serializers/viewsets:
Task: "T042 [P] [US1] Create Client serializers and viewset"
Task: "T043 [P] [US1] Create Tag serializers and viewset"

# Launch all frontend services in parallel:
Task: "T049 [P] [US1] Create Angular Task API service"
Task: "T050 [P] [US1] Create Angular Client API service"
Task: "T051 [P] [US1] Create Angular Tag API service"
Task: "T052 [P] [US1] Create Angular Notification API service"
```

## Parallel Example: P2 Stories After US1

```bash
# US4, US5, US6, US7 can all start after US1 is complete:
Task: "T075 [US4] Add PostgreSQL full-text search to Task viewset"
Task: "T081 [US5] Add task summary aggregation to Client detail endpoint"
Task: "T086 [US6] Add deadline date range filter endpoint"
Task: "T092 [US7] Create report summary endpoint"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Manager can create tasks, assign engineers, attach files, link clients
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → **MVP!** (manager creates/assigns tasks)
3. US2 → Test independently → Engineers can work on tasks
4. US3 → Test independently → Visual Kanban with real-time
5. US4 + US5 (parallel) → Search/filter + Client directory
6. US6 + US7 + US8 (parallel) → Calendar, Reports, Client portal
7. Polish → i18n, security hardening, performance optimization

### Parallel Team Strategy

With multiple developers after Foundational:

- Developer A: US1 → US2 → US3 (task core + engineer flow + Kanban)
- Developer B: US4 + US5 (search + clients, after US1 done)
- Developer C: US6 + US7 + US8 (calendar + reports + portal, after US1/US2 done)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance: i18n (Phase 11), 70% coverage (add tests during implementation), OpenAPI docs (Phase 11)
