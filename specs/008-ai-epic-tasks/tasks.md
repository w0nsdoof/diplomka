# Tasks: AI Auto-Generation of Tasks from Epic

**Input**: Design documents from `/specs/008-ai-epic-tasks/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: Included — constitution requires >=70% coverage; plan.md specifies test files.

**Organization**: Tasks grouped by user story. US1+US2 (both P1) are combined because the LLM call inherently includes assignee suggestion context — they share the same service, prompt, and Celery task. US3+US4 (both P2) are combined because async polling and the preview dialog are the same frontend UX flow. US5 (notifications) is merged into Phase 3's confirm action since it reuses existing `create_notification()` and is a few lines of code — splitting it into a separate phase would leave FR-014 incomplete at the MVP checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

## Path Conventions

- **Web app**: `backend/apps/...`, `frontend/src/app/...`
- Backend tests: `backend/tests/unit/`, `backend/tests/integration/`

---

## Phase 1: Setup

**Purpose**: Create file structure for the new AI task generation module

- [x] T001 Create `backend/apps/projects/services/` directory with `__init__.py`
- [x] T002 [P] Create empty `backend/apps/projects/tasks.py` for Celery tasks (auto-discovered by `app.autodiscover_tasks()`)
- [x] T003 [P] Create `backend/apps/projects/prompts.py` for LLM prompt templates

---

## Phase 2: Foundational (Backend AI Service Core)

**Purpose**: Core AI service logic that ALL user stories depend on — prompt building, LLM context assembly, response parsing. MUST be complete before any endpoint or frontend work.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Implement `build_system_prompt()` in `backend/apps/projects/prompts.py` — system prompt instructing LLM to return JSON array of task objects with fields: title, description, priority, assignee_id, tag_ids. Include rules: 3-15 tasks, only use provided IDs, no duplicates, consider team members' track records and profiles (job_title, skills) as signals for assignee selection, valid JSON only.
- [x] T005 Implement `build_user_prompt(context: dict) -> str` in `backend/apps/projects/prompts.py` — format Epic context, project context, team members with track records, existing task titles, and available tags into the user prompt string.
- [x] T006 Implement `build_generation_context(epic: Epic) -> dict` in `backend/apps/projects/services/ai_tasks.py` — collect Epic fields (title, description, priority, deadline, tags, client), project fields (title, description) if linked, team members from `epic.project.team` filtered to active engineers with `job_title`/`skills`, tag-filtered completed task history (top-level only, max 5 per member, fallback to project tags if Epic has no tags per FR-006), existing task titles under the Epic, and full organization tag set. Use `select_related`/`prefetch_related` for performance.
- [x] T007 Implement `parse_llm_response(text: str) -> list[dict]` in `backend/apps/projects/services/ai_tasks.py` — try `json.loads()` first, fallback to extracting JSON from markdown code fences via regex. Raise `ValueError` if unparseable.
- [x] T008 Implement `validate_generated_tasks(tasks: list[dict], team_ids: set[int], org_tag_ids: set[int]) -> list[dict]` in `backend/apps/projects/services/ai_tasks.py` — validate each task has non-empty title, default priority to "medium" if invalid, silently drop invalid `assignee_id` (not in team_ids), silently drop invalid `tag_ids` (not in org_tag_ids), cap list at 15 items. Return cleaned list.

**Checkpoint**: AI service core ready — context building, prompt generation, and response parsing all functional.

---

## Phase 3: User Story 1+2+5 — Generate Tasks with Smart Assignees & Notifications (Priority: P1)

**Goal**: Manager can trigger AI task generation from an Epic via API. The system collects Epic context, project context, team member profiles with tag-filtered task history, and sends to LLM. Returns generated tasks with smart assignee suggestions. Confirming tasks creates them with standard notification flows (in-app + Telegram) for assigned engineers.

**Independent Test**: Call `POST /api/epics/{id}/generate-tasks/`, poll `GET .../status/`, verify tasks are returned with valid assignee IDs from the project team. Then call `POST /api/epics/{id}/confirm-tasks/` and verify tasks are created in the database under the Epic, and each assigned engineer has a `task_assigned` notification.

### Implementation

- [x] T009 [US1] Implement Celery task `generate_epic_tasks(epic_id: int) -> dict` with `@shared_task(soft_time_limit=90, time_limit=120)` in `backend/apps/projects/tasks.py` — call `build_generation_context()`, build prompts, call `call_llm()` (imported from `apps.ai_summaries.services`), parse and validate response. In a `finally` block, delete the Redis concurrency guard key `epic_generate:{epic_id}` to allow future generation requests. Return `{"tasks": [...], "generation_meta": {"model": ..., "prompt_tokens": ..., "completion_tokens": ..., "generation_time_ms": ...}}` on success. On LLM/parse failure, delete the Redis key and raise exception so Celery marks task as FAILURE.
- [x] T010 [P] [US1] Create `ConfirmTasksSerializer` in `backend/apps/projects/serializers.py` — accepts `tasks` list field where each item has: `title` (required, max 255), `description` (optional, default ""), `priority` (required, choice field), `assignee_id` (optional, nullable int), `tag_ids` (optional, list of ints). Validate list is non-empty and max 15 items. Validate `assignee_id` values are active engineers in the Epic's project team. Validate `tag_ids` exist in the organization. Silently drop invalid assignees/tags per FR-013/FR-018.
- [x] T011 [US1] Add `generate_tasks` action to `EpicViewSet` in `backend/apps/projects/views.py` — `@action(detail=True, methods=["post"], url_path="generate-tasks")`, `IsManager` permission. Validate Epic has non-empty title and description (400 if not). Use `redis.set(f"epic_generate:{epic.id}", "1", nx=True, ex=120)` to atomically check and set the concurrency guard — if the key already exists (returns `False`), return 409 with `{"detail": "Task generation is already in progress for this epic.", "code": "generation_in_progress"}`. Dispatch `generate_epic_tasks.delay(epic.id)`. Return 202 with `{"task_id": result.id}`. Add `@extend_schema` with tags `["Epics", "AI"]`, request/response schemas, 202/400/403/404/409 responses.
- [x] T012 [US1] Add `generate_tasks_status` action to `EpicViewSet` in `backend/apps/projects/views.py` — `@action(detail=True, methods=["get"], url_path="generate-tasks/status")`, `IsManager` permission. Read `task_id` from query params (400 if missing). Check `AsyncResult(task_id)` state. Map Celery `PENDING` to `"pending"`, `STARTED` to `"processing"`, `SUCCESS` to `"completed"` (include `result`), `FAILURE` to `"failed"` (include `error` string). Add `@extend_schema`.
- [x] T013 [US1] [US5] Add `confirm_tasks` action to `EpicViewSet` in `backend/apps/projects/views.py` — `@action(detail=True, methods=["post"], url_path="confirm-tasks")`, `IsManager` permission. Use `ConfirmTasksSerializer` for validation. In `@transaction.atomic`: iterate tasks, create each `Task` with `epic=epic`, `organization=epic.organization`, `client=epic.client`, `created_by=request.user`, `status="created"`. Set `task.assignees.set([assignee_id])` if provided. Set `task.tags.set(tag_ids)` if provided. Create `AuditLogEntry` per task. For each assigned engineer (skip if assignee == `request.user`), call `create_notification(recipient=assignee, event_type="task_assigned", task=task, message=f"You have been assigned to task '{task.title}'", actor=request.user, telegram_context=build_telegram_context(event_type="task_assigned", task=task, actor=request.user))` — import `create_notification` from `apps.notifications.services` and `build_telegram_context` from `apps.telegram.templates`. Return 201 with `{"created_count": N, "tasks": [{"id": ..., "title": ..., "status": ...}]}`. Add `@extend_schema`.

### Tests

- [x] T014 [P] [US1] Write unit tests in `backend/tests/unit/test_ai_tasks_service.py` — test `build_generation_context()` with: Epic with project+team+tags, Epic without project, Epic with no tags (fallback to project tags), Epic with empty team. Test `parse_llm_response()` with: valid JSON, JSON in markdown fences, invalid text. Test `validate_generated_tasks()` with: valid tasks, invalid assignee IDs dropped, invalid tag IDs dropped, priority defaults, list capped at 15.
- [x] T015 [P] [US1] Write integration tests in `backend/tests/integration/test_ai_epic_tasks.py` — test `POST /api/epics/{id}/generate-tasks/` as manager (202 with task_id), as engineer (403), with invalid Epic (empty description -> 400), with locked Epic (409). Test `GET .../status/` with completed/pending/failed states (verify STARTED maps to "processing"). Test `POST /api/epics/{id}/confirm-tasks/` with valid task list (201, tasks created in DB, assignees set, tags set, notifications created for assignees), empty list (400), invalid assignee (silently dropped). Mock `call_llm` to return predetermined JSON.

**Checkpoint**: Full backend API functional — generation, polling, confirmation, and notifications all work end-to-end. Smart assignees are suggested based on tag-filtered history. FR-014 fully satisfied.

---

## Phase 4: User Story 3+4 — Preview Dialog + Async UX (Priority: P2)

**Goal**: After clicking "Generate Tasks with AI" on the Epic detail page, the manager sees a loading indicator, then a preview dialog with editable tasks. The manager can edit titles, descriptions, priorities, assignees, and tags inline, remove tasks, and confirm or cancel.

**Independent Test**: Open Epic detail page, click "Generate Tasks with AI," wait for loading to finish, verify preview dialog shows with editable fields. Edit a task title, remove a task, click "Confirm," verify tasks appear in the Epic's task list.

### Implementation

- [x] T016 [P] [US3] Add TypeScript interfaces in `frontend/src/app/core/models/hierarchy.models.ts` — `GeneratedTask` (title, description, priority, assignee_id, tag_ids), `GenerationResult` (tasks: GeneratedTask[], generation_meta: {model, prompt_tokens, completion_tokens, generation_time_ms}), `GenerationStatus` (status: 'pending'|'processing'|'completed'|'failed', result?: GenerationResult, error?: string), `ConfirmTasksResponse` (created_count, tasks: {id, title, status}[]).
- [x] T017 [P] [US4] Add `generateEpicTasks(epicId: number)`, `pollGenerationStatus(epicId: number, taskId: string)`, and `confirmEpicTasks(epicId: number, tasks: GeneratedTask[])` methods to `frontend/src/app/core/services/project.service.ts` — `generateEpicTasks` does `POST /api/epics/{id}/generate-tasks/` returning `Observable<{task_id: string}>`. `pollGenerationStatus` does `GET /api/epics/{id}/generate-tasks/status/?task_id=...` returning `Observable<GenerationStatus>`. `confirmEpicTasks` does `POST /api/epics/{id}/confirm-tasks/` with `{tasks: [...]}` returning `Observable<ConfirmTasksResponse>`.
- [x] T018 [US3] Create `AiTaskPreviewDialogComponent` (standalone, OnPush) in `frontend/src/app/features/projects/components/ai-task-preview/ai-task-preview-dialog.component.ts` with template `.html` and styles `.scss` — receives `{tasks: GeneratedTask[], teamMembers: UserBrief[], tags: TagBrief[], epicId: number}` via `MAT_DIALOG_DATA`. Displays scrollable list of tasks, each with: editable `mat-input` for title, editable `textarea` for description, `mat-select` for priority (low/medium/high/critical), `mat-select` for assignee (from team members, with "Unassigned" option), `mat-chip-listbox` with autocomplete for tag selection (from provided tags), and a remove icon button. Dialog actions: "Cancel" (`mat-dialog-close`), "Confirm" (calls `confirmEpicTasks` service method, closes with result on success, shows snackbar on error). Disable "Confirm" if task list is empty. Width: 800px.
- [x] T019 [US4] Add "Generate Tasks with AI" button and async flow to `frontend/src/app/features/projects/components/epic-detail/epic-detail.component.ts` and `.html` — add button visible only to managers (`isManager` check), disabled when Epic has empty title or description. On click: set `isGenerating = true`, call `generateEpicTasks(epicId)`, start polling `pollGenerationStatus` at 1-second intervals, backing off to 3 seconds after 10 polls (use `interval` + `switchMap` + `takeWhile` from RxJS), show `mat-spinner` during generation. On `completed`: stop polling, open `AiTaskPreviewDialogComponent` with result tasks + team members + tags. On `failed`: stop polling, show error snackbar with retry option. On dialog close with result: call `loadTasks()` to refresh task list. On 409 from generate: show snackbar "Generation already in progress."
- [x] T020 [US3] Add i18n translation keys for AI task generation in `frontend/src/assets/i18n/en.json` and `frontend/src/assets/i18n/ru.json` — keys: `epic.generateTasks` ("Generate Tasks with AI" / "Сгенерировать задачи с ИИ"), `epic.generating` ("Generating tasks..." / "Генерация задач..."), `epic.generationFailed` ("Task generation failed. Please try again." / "Ошибка генерации задач. Попробуйте ещё раз."), `epic.generationInProgress` ("Generation already in progress" / "Генерация уже выполняется"), `epic.previewTitle` ("Review Generated Tasks" / "Просмотр сгенерированных задач"), `epic.confirmTasks` ("Confirm & Create" / "Подтвердить и создать"), `epic.tasksCreated` ("{count} tasks created successfully" / "{count} задач успешно создано"), `epic.noTasksToConfirm` ("Add at least one task to confirm" / "Добавьте хотя бы одну задачу для подтверждения").

### Tests

- [x] T021 [P] [US3] Write frontend unit tests in `frontend/src/app/core/services/project.service.spec.ts` and `frontend/src/app/features/projects/components/ai-task-preview/ai-task-preview-dialog.component.spec.ts` — test `generateEpicTasks`, `pollGenerationStatus`, and `confirmEpicTasks` service methods with mocked `HttpClient` (verify correct URLs, methods, payloads). Test `AiTaskPreviewDialogComponent` renders task list from injected data, removing a task updates the list, "Confirm" button is disabled when list is empty, and cancel closes the dialog without result.

**Checkpoint**: Full end-to-end flow works — manager clicks button, sees loading, reviews preview, edits tasks, confirms, tasks created and visible in Epic task list. Frontend tests pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final quality checks

- [x] T022 Run `ruff check .` from `backend/` and fix any linting issues in new files
- [x] T023 [P] Run `npm run lint` from `frontend/` and fix any linting issues in new/modified files
- [x] T024 [P] Verify `@extend_schema` decorators on all three new endpoints produce valid OpenAPI spec by running `python manage.py spectacular --file /dev/null --validate`
- [x] T025 Validate feature works end-to-end per `specs/008-ai-epic-tasks/quickstart.md` test flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1+US2+US5 (Phase 3)**: Depends on Foundational — backend API must work before frontend
- **US3+US4 (Phase 4)**: Depends on Phase 3 API endpoints being functional
- **Polish (Phase 5)**: Depends on all previous phases

### User Story Dependencies

- **US1+US2+US5 (P1)**: Depends on Foundational (Phase 2) only. No external story dependencies. Core backend feature with notifications included.
- **US3+US4 (P2)**: Depends on US1+US2+US5 API being deployed. Frontend consumes backend endpoints.

### Within Each User Story

- Serializers [P] can be built in parallel with Celery task
- View actions depend on serializers + Celery task
- Frontend interfaces [P] can be built in parallel with service methods
- Preview dialog depends on service methods + interfaces
- Epic detail button depends on dialog component + service methods
- Tests [P] can be built in parallel with implementation (but need mocks)

### Parallel Opportunities

- T002, T003 can run in parallel (Phase 1)
- T004, T005 can run sequentially (same file but related); T006-T008 depend on T004-T005
- T010 can run in parallel with T009 (different files)
- T014, T015 can run in parallel with each other and in parallel with T010-T013
- T016, T017 can run in parallel (different files, Phase 4)
- T021 can run in parallel with T020 (different files, Phase 4)
- T022, T023, T024 can run in parallel (Phase 5)

---

## Parallel Example: Phase 3 (US1+US2+US5)

```text
# After Phase 2 is complete, launch in parallel:
T009: Implement Celery task in backend/apps/projects/tasks.py
T010: Create ConfirmTasksSerializer in backend/apps/projects/serializers.py

# After T009+T010, sequentially:
T011: Add generate_tasks action (depends on T009)
T012: Add generate_tasks_status action (depends on T009)
T013: Add confirm_tasks action with notifications (depends on T010)

# Tests in parallel with implementation:
T014: Unit tests (can start as soon as Phase 2 services exist)
T015: Integration tests (can start as soon as T011-T013 exist)
```

## Parallel Example: Phase 4 (US3+US4)

```text
# Launch in parallel:
T016: TypeScript interfaces in hierarchy.models.ts
T017: Service methods in project.service.ts

# After T016+T017:
T018: Preview dialog component (depends on T016, T017)

# After T018:
T019: Epic detail button + polling (depends on T018)

# In parallel with T019-T020:
T020: i18n translation keys
T021: Frontend unit tests
```

---

## Implementation Strategy

### MVP First (Phase 1-3: Backend Only)

1. Complete Phase 1: Setup (~5 min)
2. Complete Phase 2: Foundational AI service (~2-3 tasks)
3. Complete Phase 3: US1+US2+US5 API endpoints + notifications + tests
4. **STOP and VALIDATE**: Test via curl/httpie per quickstart.md steps 2-4
5. Backend is fully functional — can demo via API

### Incremental Delivery

1. Setup + Foundational -> AI service core ready
2. Add US1+US2+US5 -> Full backend API with notifications -> Test via API (MVP!)
3. Add US3+US4 -> Full frontend UX with tests -> Test via browser
4. Polish -> Linting, docs, final validation

### Single Developer Execution Order

```text
T001 -> T002,T003 -> T004 -> T005 -> T006 -> T007 -> T008
  -> T009,T010 -> T011 -> T012 -> T013 -> T014,T015
  -> T016,T017 -> T018 -> T019 -> T020,T021
  -> T022,T023,T024 -> T025
```

---

## Concurrency Guard Design

The concurrency guard prevents duplicate generation for the same Epic. The **view** owns the guard lifecycle:

1. **View** (`generate_tasks` action): Atomically sets Redis key `epic_generate:{epic_id}` using `SET NX EX 120`. If key exists, returns 409. If set succeeds, dispatches Celery task and returns 202.
2. **Celery task** (`generate_epic_tasks`): Does NOT acquire any lock. Runs the LLM pipeline. In its `finally` block, deletes the Redis key to allow future requests.
3. **TTL safety net**: The 120s expiry on the Redis key ensures the guard auto-clears if the Celery task crashes without cleanup. The Celery task has `soft_time_limit=90` (graceful) and `time_limit=120` (forced kill), matching the TTL.

---

## Summary

| Phase | Stories | Task Count | Key Output |
|-------|---------|------------|------------|
| 1. Setup | -- | 3 | Directory structure, empty files |
| 2. Foundational | -- | 5 | AI service: prompts, context builder, parser, validator |
| 3. US1+US2+US5 (P1) | Generate + Assignees + Notifications | 7 | API endpoints + notifications + backend tests |
| 4. US3+US4 (P2) | Preview + Async UX | 6 | Frontend dialog + polling + frontend tests |
| 5. Polish | -- | 4 | Lint, docs, validation |
| **Total** | | **25** | |

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US1+US2 combined: assignee suggestion is inherent to the generation prompt/context
- US3+US4 combined: preview dialog and async polling are the same UX flow
- US5 merged into Phase 3: notification logic is a few lines in the confirm action, reusing existing `create_notification()` — keeping it separate would leave FR-014 incomplete at MVP
- No new Django models or migrations — all tasks use existing models
- `call_llm()` imported from `apps.ai_summaries.services` — not duplicated
- Celery status mapping: PENDING->"pending", STARTED->"processing", SUCCESS->"completed", FAILURE->"failed"
- Polling interval: starts at 1s, backs off to 3s after 10 polls to reduce load
