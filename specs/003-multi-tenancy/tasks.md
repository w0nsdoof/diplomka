# Tasks: Organization-Based Multi-Tenancy

**Input**: Design documents from `/specs/003-multi-tenancy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are included per Constitution Principle II (70% coverage, unit tests for service classes, integration tests for critical flows).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new Django apps, register them, and set up the project structure for multi-tenancy.

- [x] T001 Create `backend/apps/organizations/` app with `__init__.py`, `apps.py`, `admin.py`, `models.py`, `mixins.py`, and empty `migrations/` directory
- [x] T002 Create `backend/apps/platform/` app with `__init__.py`, `apps.py`, `views.py`, `serializers.py`, `urls.py`, `permissions.py`
- [x] T003 Register `organizations` and `platform` in `INSTALLED_APPS` in `backend/config/settings/base.py`
- [x] T004 Add `/api/platform/` URL include in `backend/config/urls.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Organization model, migration pipeline, scoping mixin, auth changes, and test factories that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Organization Model & Migrations

- [x] T005 Implement Organization model (name, slug, is_active, created_at, updated_at) in `backend/apps/organizations/models.py`
- [x] T006 Create initial migration `backend/apps/organizations/migrations/0001_initial.py` via `makemigrations organizations`
- [x] T007 Add nullable `organization` FK to User model and add `superadmin` to role choices in `backend/apps/accounts/models.py` (add `is_superadmin` property, model-level validation for org/role consistency)
- [x] T008 [P] Add nullable `organization` FK to Client model in `backend/apps/clients/models.py`
- [x] T009 [P] Add nullable `organization` FK to Task model in `backend/apps/tasks/models.py`
- [x] T010 [P] Add nullable `organization` FK to Tag model in `backend/apps/tags/models.py`
- [x] T011 [P] Add nullable `organization` FK to ReportSummary model in `backend/apps/ai_summaries/models.py`
- [x] T012 Generate migrations for all modified apps (accounts, clients, tasks, tags, ai_summaries) via `makemigrations`
- [x] T013 Create data migration `backend/apps/organizations/migrations/0002_backfill_default_org.py` — create "Default Organization", backfill all User/Client/Task/Tag/ReportSummary org FKs, convert `is_superuser` users to `role=superadmin` with `organization=None`
- [x] T014 Create constraint-enforcement migrations (one migration per app, applied after backfill):
  - **clients**: make `organization` non-nullable, add `unique_together("name", "organization")`, drop old `unique=True` on `name`
  - **tasks**: make `organization` non-nullable
  - **tags**: make `organization` non-nullable, add `unique_together("name", "organization")` and `unique_together("slug", "organization")`, drop old `unique=True` on `name` and `slug`
  - **ai_summaries**: make `organization` non-nullable
- [x] T015 Run `python manage.py migrate` and verify all migrations apply cleanly

### Scoping Mixin & Auth

- [x] T016 [P] Implement `OrganizationQuerySetMixin` in `backend/apps/organizations/mixins.py` — override `get_queryset()` to filter by `request.user.organization`; return `qs.none()` for superadmins (200 with empty list — superadmins have no org-scoped data). Individual ViewSets MAY override with 403 if superadmin access should be explicitly forbidden (see T043)
- [x] T017 [P] Create custom JWT authentication class in `backend/config/authentication.py` — extend `JWTAuthentication.authenticate()` to check `user.organization.is_active` for non-superadmin users; raise `AuthenticationFailed("Organization is inactive.")` if org inactive. This runs on every request, so org deactivation takes effect immediately on the user's next API call (no proactive token revocation needed)
- [x] T018 Set custom authentication class as default in `backend/config/settings/base.py` (`DEFAULT_AUTHENTICATION_CLASSES`)
- [x] T019 [P] Add `IsSuperadmin` permission class in `backend/apps/accounts/permissions.py`
- [x] T020 [P] Create `createsuperadmin` management command in `backend/apps/organizations/management/commands/createsuperadmin.py`
- [x] T021 Register Organization model in Django admin in `backend/apps/organizations/admin.py`

### Test Factories

- [x] T022 Add `OrganizationFactory` and update all existing factories (UserFactory, ClientFactory, TaskFactory, TagFactory, ReportSummaryFactory) with `organization` field in `backend/tests/factories.py`. Ensure coherence: task's org matches creator's org, client's org matches associated task's org, etc.

### Tests (Phase 2)

- [x] T068 [P] Write unit tests for Organization model (str, slug auto-generation, unique name, is_active default) in `backend/tests/unit/test_organization_model.py`
- [x] T069 [P] Write unit tests for `OrganizationQuerySetMixin` (filters by user.organization, returns `qs.none()` for superadmins, raises for unauthenticated) in `backend/tests/unit/test_organization_mixin.py`
- [x] T070 Write migration verification test — apply all migrations on fresh DB, verify default org created, all existing data backfilled, superuser converted to superadmin role in `backend/tests/integration/test_migration.py`

**Checkpoint**: Foundation ready — Organization model exists, migrations work, scoping mixin available, auth checks org status, factories updated, foundation tests pass. User story implementation can now begin.

---

## Phase 3: User Story 1 — Superadmin Creates Org & First Manager (Priority: P1) 🎯 MVP

**Goal**: A superadmin can log in, create a new organization, and create the first manager for it via a platform admin UI.

**Independent Test**: Log in as superadmin → create org → create manager → verify manager can log in and sees empty workspace.

### Backend — Platform API

- [x] T023 [P] [US1] Implement `OrganizationListSerializer` and `OrganizationDetailSerializer` (with annotated stats: user_count, task_count) in `backend/apps/platform/serializers.py`
- [x] T024 [P] [US1] Implement `ManagerBriefSerializer` and `ManagerCreateSerializer` in `backend/apps/platform/serializers.py`
- [x] T025 [US1] Implement `OrganizationViewSet` (list, create, retrieve) in `backend/apps/platform/views.py` — permission: `IsSuperadmin`
- [x] T026 [US1] Implement manager nested endpoints: `GET /api/platform/organizations/{id}/managers/` and `POST .../managers/` in `backend/apps/platform/views.py`
- [x] T027 [US1] Wire platform URL routes in `backend/apps/platform/urls.py` — router for organizations, nested manager routes

### Backend — Auth Token Changes

- [x] T028 [US1] Update token serializer to include `organization_id` in login response and handle `superadmin` role in `backend/apps/accounts/serializers.py`

### Frontend — Auth & Routing

- [x] T029 [US1] Update `AuthService` to store and expose `organization_id` and handle `superadmin` role in `frontend/src/app/core/services/auth.service.ts`
- [x] T030 [US1] Add `superadminGuard` (allows only superadmin role) in `frontend/src/app/core/guards/auth.guard.ts`
- [x] T031 [US1] Add `/platform` lazy-loaded route with `superadminGuard` in `frontend/src/app/app.routes.ts`
- [x] T032 [US1] Update login component to redirect superadmin to `/platform/organizations` in `frontend/src/app/core/components/login/login.component.ts`

### Frontend — Platform Feature Module

- [x] T033 [US1] Create `OrganizationService` for platform API calls (list, create, get, update orgs; list/create managers) in `frontend/src/app/core/services/organization.service.ts`
- [x] T034 [US1] Create platform routes file `frontend/src/app/features/platform/platform.routes.ts`
- [x] T035 [US1] Implement organization list component (mat-table with name, status, user count, task count, create button) in `frontend/src/app/features/platform/components/organization-list/`
- [x] T036 [US1] Implement organization form dialog (create org with name field) in `frontend/src/app/features/platform/components/organization-form/`
- [x] T037 [US1] Implement organization detail component (org info, stats, manager list, add-manager form) in `frontend/src/app/features/platform/components/organization-detail/`

### Frontend — Layout

- [x] T038 [US1] Add superadmin nav item ("Organizations" → `/platform/organizations`) in layout component in `frontend/src/app/core/components/layout/layout.component.ts`

### Tests (US1)

- [x] T071 [US1] Write integration tests for platform API — superadmin can list/create/retrieve orgs, create managers, non-superadmin gets 403, duplicate org name rejected in `backend/tests/integration/test_platform_api.py`

**Checkpoint**: Superadmin can create organizations and seed managers. Manager can log in to empty workspace. US1 is fully functional and tested.

---

## Phase 4: User Story 2 — Data Isolation Between Organizations (Priority: P1)

**Goal**: All data-access endpoints enforce organization scoping so users see only their own organization's data. Cross-org access returns 404.

**Independent Test**: Create two organizations with data → log in as each org's user → verify task/client/tag/summary/report lists show only own data; direct ID access to other org's data returns 404.

### Backend — Apply Scoping Mixin to All ViewSets

- [x] T039 [P] [US2] Add `OrganizationQuerySetMixin` to task ViewSet and auto-set `organization` on create in `backend/apps/tasks/views.py`
- [x] T040 [P] [US2] Add `OrganizationQuerySetMixin` to client ViewSet and auto-set `organization` on create in `backend/apps/clients/views.py`
- [x] T041 [P] [US2] Add `OrganizationQuerySetMixin` to tag ViewSet and auto-set `organization` on create in `backend/apps/tags/views.py`
- [x] T042 [P] [US2] Add `OrganizationQuerySetMixin` to summary ViewSet and scope on-demand generation to org in `backend/apps/ai_summaries/views.py`
- [x] T043 [P] [US2] Add `OrganizationQuerySetMixin` to user ViewSet in `backend/apps/accounts/views.py` — managers see own org only; override mixin default for superadmins to return 403 (superadmins must use the platform API at `/api/platform/` for user management, not the org-scoped endpoint)
- [x] T044 [P] [US2] Scope report data to organization in `backend/apps/reports/views.py` and `backend/apps/reports/services.py` (pass `organization` to `get_report_data()`)

### Backend — Nested Resource Scoping

- [x] T072 [P] [US2] Scope parent task lookup in `CommentViewSet` — validate `task_pk` belongs to `request.user.organization` before filtering comments; return 404 if cross-org in `backend/apps/comments/views.py`
- [x] T073 [P] [US2] Scope parent task lookup in `AttachmentViewSet` — validate `task_pk` belongs to `request.user.organization` before filtering attachments; return 404 if cross-org in `backend/apps/attachments/views.py`
- [x] T074 [US2] Scope `parse_mentions()` to only resolve users within the commenter's organization — pass `organization` parameter and filter User queryset in `backend/apps/comments/services.py`

### Backend — WebSocket Scoping

- [x] T045 [US2] Scope Kanban WebSocket consumer — change group to `kanban_board_{org_id}`, validate org on connect in `backend/apps/tasks/consumers.py`
- [x] T046 [US2] Update `_broadcast_task_event()` to broadcast to org-specific group in `backend/apps/tasks/services.py`

### Tests (US2)

- [x] T075 [US2] Write cross-org data isolation integration tests — two orgs with data, verify: task/client/tag/summary list isolation, direct ID access returns 404, comment/attachment endpoints on other org's task return 404, parse_mentions cannot resolve cross-org users in `backend/tests/integration/test_data_isolation.py`

**Checkpoint**: All endpoints enforce org scoping. Cross-org access is impossible. Nested resources (comments, attachments) validated. US2 is fully functional and tested.

---

## Phase 5: User Story 3 — Manager Manages Users Within Their Org (Priority: P2)

**Goal**: Org managers can create, update, and deactivate users within their org. Cannot see other orgs' users.

**Independent Test**: Log in as org manager → create engineer/client users → verify they are org-scoped → verify cannot see other org's users.

### Backend

- [x] T047 [US3] Update user creation endpoint to auto-set `organization` from `request.user.organization` and prevent creating superadmin users in `backend/apps/accounts/views.py`
- [x] T048 [US3] Add last-manager protection: prevent deactivation of the last active manager in an org (return 400) in `backend/apps/accounts/views.py`
- [x] T049 [US3] Update user serializer to enforce org-scoped validation (email globally unique, role restricted to manager/engineer/client) in `backend/apps/accounts/serializers.py`

### Frontend

- [x] T050 [US3] Update admin user-management page to show only org-scoped users (already filtered by backend, but ensure UI labels reflect org context) in `frontend/src/app/features/admin/`

**Checkpoint**: Managers can fully manage their org's team. US3 is functional.

---

## Phase 6: User Story 4 — Clients Scoped Within an Organization (Priority: P2)

**Goal**: Client entity is properly scoped per org. Name uniqueness is per-org. Portal users see only their org's client tasks.

**Independent Test**: Create clients in two orgs → verify each org sees only its own → verify duplicate names allowed across orgs → portal user sees only their client's tasks.

### Backend

- [x] T051 [US4] Update Client serializer to validate name uniqueness within organization (not globally) in `backend/apps/clients/serializers.py`
- [x] T052 [US4] Verify portal endpoint scoping — already user-scoped, but confirm org-scoped client FK prevents cross-org leakage in `backend/apps/tasks/views.py` (portal endpoints)

### Frontend

- [x] T053 [US4] Verify client list and client detail pages work correctly with org-scoped data (no changes expected if API filtering is correct) in `frontend/src/app/features/clients/`

**Checkpoint**: Clients are fully org-scoped. Portal users see only their org's data. US4 is functional.

---

## Phase 7: User Story 5 — Organization-Scoped Reports and Summaries (Priority: P3)

**Goal**: AI summaries (daily, weekly, on-demand) are generated and displayed per organization.

**Independent Test**: Generate summaries for two orgs → verify each sees only their own summaries.

### Backend

- [x] T054 [P] [US5] Update `generate_daily_summary` and `generate_weekly_summary` Celery tasks to iterate over active organizations and generate per-org summaries in `backend/apps/ai_summaries/tasks.py`
- [x] T055 [P] [US5] Update `collect_metrics()` to accept `organization_id` parameter and scope all metric queries to that org in `backend/apps/ai_summaries/services.py`
- [x] T056 [US5] Update Redis lock keys from `summary:{type}:{date}` to `summary:{type}:{date}:{org_id}` in `backend/apps/ai_summaries/tasks.py`
- [x] T057 [US5] Update on-demand summary generation to pass `request.user.organization` in `backend/apps/ai_summaries/views.py`

**Checkpoint**: Summaries are per-org. Scheduled generation runs independently for each org. US5 is functional.

---

## Phase 8: User Story 6 — Superadmin Oversight (Priority: P3)

**Goal**: Superadmin can view org list with stats, deactivate/reactivate orgs, manage managers for any org.

**Independent Test**: Log in as superadmin → view org list with stats → deactivate an org → verify its users can't log in → reactivate → verify access restored.

### Backend

- [x] T058 [US6] Add `PATCH /api/platform/organizations/{id}/` support (update name, toggle `is_active`) in `backend/apps/platform/views.py`
- [x] T059 [US6] Add org detail stats annotations (manager_count, engineer_count, client_user_count, client_count) to `OrganizationDetailSerializer` in `backend/apps/platform/serializers.py`

### Frontend

- [x] T060 [US6] Add deactivate/reactivate toggle button on organization detail page in `frontend/src/app/features/platform/components/organization-detail/`
- [x] T061 [US6] Display detailed stats (manager/engineer/client user counts, client count) on organization detail page in `frontend/src/app/features/platform/components/organization-detail/`

**Checkpoint**: Superadmin has full oversight. US6 is functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, edge cases, and validation across all stories.

- [x] T062 [P] Verify all existing tests pass with default organization backfill (backward compatibility) by running `cd backend && python -m pytest tests/`
- [x] T063 [P] Verify frontend tests pass by running `cd frontend && npm run test:ci`
- [x] T064 Add `organization` field to Django admin for User, Client, Task, Tag, ReportSummary models in their respective `admin.py` files
- [x] T076 [P] Add drf-spectacular OpenAPI annotations to all new platform endpoints (OrganizationViewSet, manager nested endpoints) and verify modified endpoints have updated serializer annotations; run `python manage.py spectacular --validate` to confirm schema generation
- [x] T077 [P] Add i18n translation keys for all new user-facing strings — backend: Django `gettext` for error messages and model verbose names; frontend: Angular `i18n` for platform admin labels, nav items, snackbar messages, form labels. Both Russian and English per Constitution Principle V
- [x] T066 Run full quickstart.md validation — fresh `migrate`, `createsuperadmin`, create org, create manager, verify login and data isolation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — MVP, should be completed first
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (backend-only, different files)
- **US3 (Phase 5)**: Depends on Phase 2 — can run after US2 (extends user ViewSet changes)
- **US4 (Phase 6)**: Depends on Phase 2 + US2 (client scoping uses mixin from US2)
- **US5 (Phase 7)**: Depends on Phase 2 + US2 (summary scoping uses mixin from US2)
- **US6 (Phase 8)**: Depends on US1 (extends platform API from US1)
- **Polish (Phase 9)**: Depends on all stories being complete

### User Story Dependencies

- **US1** (Superadmin creates org): Independent after Phase 2
- **US2** (Data isolation): Independent after Phase 2 — backend scoping only
- **US3** (Manager manages users): Builds on US2 user ViewSet scoping
- **US4** (Clients scoped): Builds on US2 client ViewSet scoping
- **US5** (Reports scoped): Builds on US2 summary ViewSet scoping
- **US6** (Superadmin oversight): Builds on US1 platform API

### Within Each User Story

- Models/migrations before services
- Services before endpoints/views
- Backend before frontend
- Core implementation before integration

### Parallel Opportunities

- **Phase 2**: T008–T011 (add org FK to Client, Task, Tag, ReportSummary) are parallel
- **Phase 2**: T016–T017, T019–T021 (mixin, auth, permissions, management command) are parallel
- **Phase 2**: T068–T069 (unit tests for model and mixin) are parallel
- **Phase 3**: T023–T024 (serializers) are parallel; T033–T038 (frontend components) are partially parallel
- **Phase 4**: T039–T044, T072–T073 (apply mixin to all ViewSets + nested resource scoping) are all parallel — different files
- **Phase 7**: T054–T055 (Celery tasks and services) are parallel
- **Phase 9**: T062–T063, T076–T077 (verification and docs) are parallel

---

## Parallel Example: Phase 4 (Data Isolation)

```bash
# All ViewSet scoping tasks can run in parallel (different files):
Task T039: "Add OrganizationQuerySetMixin to task ViewSet"
Task T040: "Add OrganizationQuerySetMixin to client ViewSet"
Task T041: "Add OrganizationQuerySetMixin to tag ViewSet"
Task T042: "Add OrganizationQuerySetMixin to summary ViewSet"
Task T043: "Add OrganizationQuerySetMixin to user ViewSet"
Task T044: "Scope report data to organization"
Task T072: "Scope parent task lookup in CommentViewSet"
Task T073: "Scope parent task lookup in AttachmentViewSet"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T022, T068–T070) — CRITICAL
3. Complete Phase 3: US1 — Superadmin creates org & manager (+ T071 tests)
4. Complete Phase 4: US2 — Data isolation enforced (+ T072–T075 nested scoping & tests)
5. **STOP and VALIDATE**: Create two orgs, verify complete isolation
6. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (org creation) + US2 (data isolation) → **MVP — deploy**
3. US3 (manager manages users) + US4 (clients scoped) → P2 increment — deploy
4. US5 (reports scoped) + US6 (superadmin oversight) → P3 increment — deploy
5. Polish (T062–T064, T066, T076–T077) → Final validation, docs, and i18n

### Suggested MVP Scope

**US1 + US2** — Organization creation and data isolation. This delivers the core multi-tenancy value: separate workspaces with enforced data isolation.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing tests must pass unchanged after Phase 2 migration (backward compat via default org)
