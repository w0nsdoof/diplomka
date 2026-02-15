# Tasks: AI-Generated Report Summaries

**Input**: Design documents from `/specs/002-ai-report-summaries/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/summaries-api.yaml

**Tests**: Not explicitly requested — test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new Django app and install dependencies

- [X] T001 Create ai_summaries Django app scaffolding with `__init__.py` and `apps.py` in backend/apps/ai_summaries/
- [X] T002 [P] Add `litellm` to backend/requirements.txt and install
- [X] T003 [P] Add LLM configuration settings (`LLM_MODEL`, `LLM_API_KEY`, `LLM_API_BASE`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`) and register `apps.ai_summaries` in `INSTALLED_APPS` in backend/config/settings/base.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core model, services, and infrastructure that MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create ReportSummary model with PeriodType/Status/GenerationMethod choices, all fields per data-model.md, Meta ordering, indexes (`idx_summary_period`, `idx_summary_period_latest`), and `clean()` validation in backend/apps/ai_summaries/models.py
- [X] T005 [P] Add `SUMMARY_READY = "summary_ready"` to EventType choices and make `task` ForeignKey nullable (`null=True, blank=True`) on Notification model in backend/apps/notifications/models.py
- [X] T006 Run `makemigrations ai_summaries` and `makemigrations notifications` then `migrate` to apply both schema changes
- [X] T007 [P] Implement LLM prompt templates: system prompt (role + formatting + length constraint), daily user prompt, weekly user prompt (with trend comparison section), and on-demand user prompt in backend/apps/ai_summaries/prompts.py
- [X] T008 [P] Implement `call_llm(system_prompt, user_prompt)` function using `litellm.completion()` with settings-based model/key/temperature/max_tokens config, returning `(text, model, prompt_tokens, completion_tokens)` tuple; and `generate_fallback_summary(period_type, metrics_data)` using string template in backend/apps/ai_summaries/services.py
- [X] T009 Implement `collect_metrics(period_start, period_end)` reusing `get_report_data()` from apps.reports.services, and `generate_summary_for_period(summary_id)` orchestrator that updates ReportSummary status through `pending→generating→completed/failed`, calls LLM with appropriate prompt, falls back to template on failure, and stores token usage + timing in backend/apps/ai_summaries/services.py
- [X] T010 Implement `generate_summary` shared Celery task that acquires Redis lock (`summary:{period_type}:{start}:{end}`, TTL=300s), creates ReportSummary row, calls `generate_summary_for_period()`, and handles lock contention in backend/apps/ai_summaries/tasks.py
- [X] T011 [P] Create `SummaryListSerializer` (id, period_type, period_start, period_end, summary_text, generation_method, status, generated_at, has_versions), `SummaryDetailSerializer` (all fields + version_count + nested requested_by), `SummaryVersionSerializer`, and `GenerateRequestSerializer` (period_start, period_end with validation) in backend/apps/ai_summaries/serializers.py
- [X] T012 [P] Create URL routing with `app_name = "ai_summaries"` in backend/apps/ai_summaries/urls.py and include at `api/summaries/` in backend/config/urls.py
- [X] T013 [P] Register ReportSummary with list_display (period_type, period_start, period_end, status, generation_method, generated_at), list_filter, and search_fields in backend/apps/ai_summaries/admin.py

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — View Daily AI Summary (Priority: P1) 🎯 MVP

**Goal**: Managers see an auto-generated daily summary on the reports page that interprets yesterday's task metrics as a human-readable narrative.

**Independent Test**: Trigger daily summary generation via Celery task, verify a readable narrative appears at `GET /api/summaries/latest/` and is displayed on the reports page.

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement `generate_daily_summary` Celery task that computes yesterday's date range (`period_start=period_end=yesterday`), checks for existing completed summary to skip duplicates, and calls `generate_summary.delay()` in backend/apps/ai_summaries/tasks.py
- [X] T015 [P] [US1] Add `generate-daily-summary` to `CELERY_BEAT_SCHEDULE` with `crontab(minute=5, hour=0)` for daily execution at 00:05 UTC in backend/config/settings/base.py
- [X] T016 [P] [US1] Implement `SummaryLatestView` (GET /api/summaries/latest/) returning latest completed daily and weekly summaries with `IsAuthenticated` + `IsManager` permissions in backend/apps/ai_summaries/views.py
- [X] T017 [US1] Create `SummaryService` with methods `getLatest()`, `list(params)`, `getById(id)`, `getVersions(id)`, `generate(request)`, `regenerate(id)` calling `/api/summaries/` endpoints in frontend/src/app/core/services/summary.service.ts
- [X] T018 [US1] Add AI summary section to reports page: call `SummaryService.getLatest()` on init, display latest daily summary with period dates, generation timestamp, method badge (AI/fallback), and summary text in a Material card in frontend/src/app/features/reports/reports.component.ts

**Checkpoint**: Daily AI summary generation works end-to-end — managers see yesterday's summary on the reports page

---

## Phase 4: User Story 2 — View Weekly AI Summary (Priority: P1)

**Goal**: Managers see an auto-generated weekly summary every Monday covering the previous Mon–Sun with week-over-week trend comparisons.

**Independent Test**: Trigger weekly summary generation, verify the summary covers 7 days, includes trend comparisons (when history exists), and appears on the reports page.

### Implementation for User Story 2

- [X] T019 [P] [US2] Implement `generate_weekly_summary` Celery task that computes previous Mon–Sun date range, collects current + prior week metrics for trend comparison, and calls `generate_summary.delay()` in backend/apps/ai_summaries/tasks.py
- [X] T020 [P] [US2] Add `generate-weekly-summary` to `CELERY_BEAT_SCHEDULE` with `crontab(minute=0, hour=6, day_of_week=1)` for Monday 06:00 UTC in backend/config/settings/base.py
- [X] T021 [US2] Add latest weekly summary display alongside daily summary in the AI summary section, showing period range and week-over-week context in frontend/src/app/features/reports/reports.component.ts

**Checkpoint**: Both daily and weekly summaries are auto-generated and visible on the reports page

---

## Phase 5: User Story 3 — Browse Summary History (Priority: P2)

**Goal**: Managers can browse a chronological list of past summaries, filter by period type, and view any summary in detail with its version history.

**Independent Test**: Generate several summaries, verify they appear in a filterable list at `/api/summaries/`, and that clicking one shows full detail with version history.

### Implementation for User Story 3

- [X] T022 [P] [US3] Implement `SummaryListView` (GET /api/summaries/) with pagination, `period_type` and `status` query filters, returning only latest version per period group using a Subquery annotation, with `IsManager` permission in backend/apps/ai_summaries/views.py
- [X] T023 [P] [US3] Implement `SummaryDetailView` (GET /api/summaries/{id}/) returning full detail with version_count annotation and `IsManager` permission in backend/apps/ai_summaries/views.py
- [X] T024 [US3] Implement `SummaryVersionsView` (GET /api/summaries/{id}/versions/) returning all versions for the same period group ordered by `-generated_at` in backend/apps/ai_summaries/views.py
- [X] T025 [US3] Create `SummaryListComponent` with paginated Material table (date, period type chip, status badge, preview snippet), period_type filter dropdown, and row click navigation to detail view in frontend/src/app/features/reports/summary-list/summary-list.component.ts
- [X] T026 [US3] Create `SummaryDetailComponent` displaying full summary text, metadata (period, method, tokens, timing), and version history list with ability to switch between versions in frontend/src/app/features/reports/summary-detail/summary-detail.component.ts
- [X] T027 [US3] Add child routes under `/reports` for `summaries` → SummaryListComponent and `summaries/:id` → SummaryDetailComponent, add "View History" navigation link from reports page in frontend/src/app/app.routes.ts

**Checkpoint**: Summary history is browsable, filterable, and each summary can be viewed in full with version history

---

## Phase 6: User Story 4 — Generate On-Demand Summary (Priority: P2)

**Goal**: Managers can trigger AI summary generation for any custom date range and regenerate existing summaries, with all results stored in history.

**Independent Test**: Select a custom date range, trigger generation, verify the summary appears with `period_type=on_demand` in history; regenerate an existing summary and verify a new version is created.

### Implementation for User Story 4

- [X] T028 [P] [US4] Implement `SummaryGenerateView` (POST /api/summaries/generate/) accepting `{period_start, period_end}`, creating ReportSummary with `period_type=on_demand` and `requested_by=request.user`, dispatching `generate_summary.delay()`, returning 202 with pending summary; return 409 if generation already in progress for same period in backend/apps/ai_summaries/views.py
- [X] T029 [P] [US4] Implement `SummaryRegenerateView` (POST /api/summaries/{id}/regenerate/) that looks up the original summary, creates a new ReportSummary row with same period info and `requested_by=request.user`, dispatches `generate_summary.delay()`, returning 202; return 409 if regeneration already in progress in backend/apps/ai_summaries/views.py
- [X] T030 [US4] Add on-demand generation UI to reports page: Material date pickers for start/end date, "Generate Summary" button calling `SummaryService.generate()`, loading spinner, success snackbar with link to result in frontend/src/app/features/reports/reports.component.ts
- [X] T031 [US4] Add "Regenerate" button to summary-detail component calling `SummaryService.regenerate(id)`, show loading state, navigate to new version on completion in frontend/src/app/features/reports/summary-detail/summary-detail.component.ts

**Checkpoint**: On-demand and regeneration flows work end-to-end; all results appear in summary history

---

## Phase 7: User Story 5 — Receive Summary Notifications (Priority: P3)

**Goal**: Managers receive in-app notifications when new AI summaries are ready, with click-through to the summary detail.

**Independent Test**: Generate a summary, verify all managers receive a `summary_ready` notification, and clicking it navigates to the summary detail view.

### Implementation for User Story 5

- [X] T032 [US5] Add `notify_managers_of_summary(summary)` function that creates a Notification with `event_type="summary_ready"`, `task=None`, descriptive message, for each user with `role="manager"` — call it from `generate_summary_for_period()` on successful completion in backend/apps/ai_summaries/services.py
- [X] T033 [US5] Update `NotificationSerializer` to handle nullable `task_id` (return `None` instead of raising error when task is null) and add `summary_id` field derived from notification context in backend/apps/notifications/serializers.py
- [X] T034 [US5] Add notification click routing: when notification type is `summary_ready`, navigate to `/reports/summaries/{id}` instead of `/tasks/{task_id}` in frontend notification handling in frontend/src/app/layout/layout.component.ts

**Checkpoint**: Notification flow works end-to-end for all summary types (daily, weekly, on-demand)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: API documentation, observability, and validation

- [X] T035 [P] Add drf-spectacular `@extend_schema` decorations with request/response examples to all summary API views in backend/apps/ai_summaries/views.py
- [X] T036 [P] Add structured logging (`structlog` or `logging`) for summary generation lifecycle (start, LLM call, fallback, success, failure) in backend/apps/ai_summaries/services.py and backend/apps/ai_summaries/tasks.py
- [X] T037 Run quickstart.md validation: verify manual test scenarios (on-demand generation, daily trigger, summary display, notification) per specs/002-ai-report-summaries/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — delivers MVP
- **US2 (Phase 4)**: Depends on Foundational — can run in parallel with US1
- **US3 (Phase 5)**: Depends on Foundational — can run in parallel with US1/US2
- **US4 (Phase 6)**: Depends on US3 (needs summary-detail component for regenerate button)
- **US5 (Phase 7)**: Depends on Foundational — can run in parallel with US1–US4
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — independent of US1 (shares `SummaryLatestView` created in US1, but can be developed concurrently)
- **US3 (P2)**: After Foundational — independent of US1/US2
- **US4 (P2)**: After US3 (regenerate button lives in summary-detail component from US3)
- **US5 (P3)**: After Foundational — independent of US1–US4 (notification sending is added to existing orchestrator)

### Within Each User Story

- Backend tasks before frontend tasks
- Models before services before views
- Core implementation before integration

### Parallel Opportunities

- **Phase 1**: T002 + T003 can run in parallel (after T001)
- **Phase 2**: T004 + T005 parallel; then T007 + T008 + T011 + T012 + T013 parallel (after T006)
- **Phase 3**: T014 + T015 + T016 parallel (different files)
- **Phase 4**: T019 + T020 parallel
- **Phase 5**: T022 + T023 parallel
- **Phase 6**: T028 + T029 parallel
- **Phase 8**: T035 + T036 parallel

---

## Parallel Example: User Story 1

```
# Backend tasks can run in parallel (different files):
Task T014: "Implement generate_daily_summary Celery task in tasks.py"
Task T015: "Add daily Beat schedule in settings/base.py"
Task T016: "Implement SummaryLatestView in views.py"

# Then frontend sequentially:
Task T017: "Create SummaryService in summary.service.ts"
Task T018: "Integrate daily summary into reports.component.ts"
```

## Parallel Example: User Story 3

```
# Backend views can run in parallel:
Task T022: "Implement list view in views.py"
Task T023: "Implement detail view in views.py"

# Then sequentially:
Task T024: "Implement versions view in views.py"

# Frontend sequentially:
Task T025: "Create summary-list component"
Task T026: "Create summary-detail component"
Task T027: "Add routes and navigation"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (10 tasks)
3. Complete Phase 3: User Story 1 (5 tasks)
4. **STOP and VALIDATE**: Trigger daily summary, verify it appears on reports page
5. Deploy/demo if ready — managers get daily AI summaries

### Incremental Delivery

1. Setup + Foundational → Foundation ready (13 tasks)
2. Add US1 → Daily summaries working → Deploy/Demo (MVP!)
3. Add US2 → Weekly summaries working → Deploy/Demo
4. Add US3 → Summary history browsable → Deploy/Demo
5. Add US4 → On-demand + regeneration → Deploy/Demo
6. Add US5 → Notifications → Deploy/Demo
7. Polish → Production-ready

### Suggested MVP Scope

**US1 only** (18 tasks total: 3 setup + 10 foundational + 5 US1). This delivers the core value proposition — automated daily AI summaries visible on the reports page. Weekly, history, on-demand, and notifications are incremental additions.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable (except US4 depends on US3)
- `get_report_data()` from `apps.reports.services` is the data source — no new data collection needed
- Redis locks prevent duplicate concurrent generation for the same period
- LiteLLM is used as a library (no proxy server) — `litellm.completion()` with settings-based config
- Existing Notification model + serializer are modified; no new notification infrastructure needed
- Frontend uses standalone components with lazy loading, consistent with existing architecture
