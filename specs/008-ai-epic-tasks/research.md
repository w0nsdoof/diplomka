# Research: AI Auto-Generation of Tasks from Epic

**Feature Branch**: `008-ai-epic-tasks`
**Date**: 2026-04-05

---

## R-001: LLM Integration Approach — Reuse existing `call_llm()`

**Decision**: Import and reuse `apps.ai_summaries.services.call_llm()` directly.

**Rationale**: The existing function already handles LiteLLM configuration (model, API key, base URL, retries, timeout), token tracking, and error propagation. The function signature `call_llm(system_prompt, user_prompt) -> (text, model, prompt_tokens, completion_tokens)` is generic enough for any LLM use case. No need for a shared utility module at this stage — a second consumer (this feature) calling it cross-app is acceptable.

**Alternatives considered**:
- Extract `call_llm` to a shared `apps.core.llm` module: Premature — only two consumers. Can refactor later if a third appears.
- Create a separate LiteLLM wrapper in `apps.projects`: Code duplication; settings already centralized.

---

## R-002: LLM Prompt Design — Structured JSON output

**Decision**: Use a system prompt that instructs the LLM to return a JSON array of task objects. The user prompt contains the Epic context, project context, team member profiles with track records, existing task titles, and the organization's tag set.

**Rationale**: JSON output is machine-parseable, unlike free-text which would require fragile regex/NLP parsing. LiteLLM supports all major providers; structured JSON output instructions work well with GPT-4o-mini, Claude, Groq, etc. Including `response_format={"type": "json_object"}` in the LLM call (OpenAI-compatible providers) or relying on strong prompt instructions for others.

**Prompt structure**:
```
System: You are a project management assistant. Given an Epic and team context, generate tasks as a JSON array.

Each task object must have:
- title: string (concise, actionable)
- description: string (1-3 sentences)  
- priority: "low" | "medium" | "high" | "critical"
- assignee_id: number | null (from provided team list, or null if no match)
- tag_ids: number[] (from provided tag list, empty if none match)

Rules:
- Generate 3-15 tasks depending on Epic complexity
- Only use assignee IDs from the provided team member list
- Only use tag IDs from the provided tag set
- Do not duplicate existing tasks (provided list)
- Consider team members' track records for assignee suggestions
- Return ONLY valid JSON, no markdown fences, no commentary
```

**User prompt includes**:
1. Epic: title, description, priority, deadline, tags
2. Project: title, description (if linked)
3. Team members: id, name, role, job_title, skills, track_record (up to 5 recent completed tasks with tags)
4. Existing tasks under this Epic (titles only, for dedup)
5. Available tags: id, name (full org tag set)

**Alternatives considered**:
- Free-text output with parsing: Fragile, error-prone, inconsistent across LLM providers.
- Function calling / tool use: Provider-specific; LiteLLM abstracts this but not uniformly. JSON instruction is more portable.
- Streaming response: Adds complexity for marginal UX gain since we use polling anyway.

---

## R-003: Async Pattern — Celery task + polling endpoint

**Decision**: Follow the existing AI summaries pattern: Celery task with Redis lock, frontend polls a status endpoint.

**Rationale**: The spec explicitly requires polling (clarification: "frontend gets a Celery task ID, polls a status endpoint until result is ready"). The existing `ai_summaries` feature uses this exact pattern with proven Redis locking. Celery result backend (Redis) already stores task results.

**Implementation**:
1. `POST /api/epics/{id}/generate-tasks/` — validates Epic, acquires Redis lock, dispatches Celery task, returns `{task_id: "<celery-task-id>"}` with 202 ACCEPTED.
2. `GET /api/epics/{id}/generate-tasks/status/?task_id=<id>` — checks Celery AsyncResult state. Returns `{status: "pending|processing|completed|failed", result: [...tasks]}` when done.
3. `POST /api/epics/{id}/confirm-tasks/` — receives the (possibly edited) task list from the preview, creates tasks in bulk.

**Redis concurrency guard key**: `epic_generate:{epic_id}` with 120s TTL (shorter than summaries' 300s lock since we only need to cover a single LLM call with 60s timeout, plus overhead). The view sets the key atomically via `SET NX EX`; the Celery task deletes it on completion/failure.

**Alternatives considered**:
- WebSocket push: Spec explicitly chose polling over WS. Existing WS has known production issues (localhost URL bug).
- Server-Sent Events: Not set up in the project; would require new infrastructure.
- Synchronous request: Would block for up to 60s; poor UX, timeout risk.

---

## R-004: Assignee Suggestion Algorithm — Tag-based history ranking

**Decision**: For each team member, count completed tasks that share tags with the Epic. Rank by count. Include job_title and skills as supplementary LLM context (not as a scoring algorithm — let the LLM decide using all signals).

**Rationale**: The spec requires tag-based filtering as the primary mechanism (FR-005, FR-006, FR-007, FR-008). Rather than building a complex scoring algorithm, we provide the LLM with structured data (completed task counts per matching tag, plus profile info) and let it make the assignment decision. This is simpler, more flexible, and allows the LLM to consider cross-cutting factors (workload, skill overlap, task complexity).

**Query strategy**:
```python
# For each team member, get completed top-level tasks matching Epic's tags
# Limited to 5 most recent per member (FR-008)
Task.objects.filter(
    assignees=member,
    status="done",
    parent_task__isnull=True,  # top-level only (FR-007)
    tags__in=epic_tags,        # tag match (FR-005)
    organization=epic.organization,
).distinct().order_by("-updated_at")[:5]
```

**Tag fallback** (FR-006): If Epic has no tags but belongs to a project with tags, use the project's tags for the query.

**Alternatives considered**:
- Server-side scoring algorithm: Over-engineered; the LLM can synthesize multiple signals better than a rigid formula.
- ML-based recommendation: No training data available; overkill for the scope.
- Random assignment: Defeats the purpose of the feature.

---

## R-005: Preview Data Flow — Ephemeral frontend state

**Decision**: The generated task list lives only in Angular component state (the preview dialog). It is never persisted to the database until the manager confirms.

**Rationale**: Spec explicitly states "preview is ephemeral — lives only in frontend state." This simplifies the backend (no draft/preview table) and avoids cleanup logic for abandoned previews.

**Flow**:
1. Frontend calls `POST /api/epics/{id}/generate-tasks/` → gets `task_id`
2. Frontend polls `GET /api/epics/{id}/generate-tasks/status/?task_id=<id>` until `completed`
3. Response contains the generated task array (parsed from LLM output)
4. Frontend opens preview dialog with editable task list
5. Manager edits/removes tasks, clicks "Confirm"
6. Frontend calls `POST /api/epics/{id}/confirm-tasks/` with final task array
7. Backend creates tasks, triggers notifications

**Alternatives considered**:
- Persist preview to DB: Adds complexity (draft model, cleanup job). Spec explicitly rejects this.
- Store in Redis with TTL: Unnecessary complexity; frontend state is sufficient.

---

## R-006: Bulk Task Creation — Reuse existing creation logic with notifications

**Decision**: The `confirm-tasks` endpoint iterates over the submitted tasks, creates each via `Task.objects.create()` with proper M2M sets, and triggers `create_notification()` for each assigned engineer. Wrapped in `@transaction.atomic`.

**Rationale**: Reusing the existing notification service ensures consistency (in-app + Telegram). Atomic transaction ensures all-or-nothing creation. The existing `TaskCreateSerializer.create()` has too much validation overhead for bulk (it validates each field individually); instead, we do pre-validation once on the list and create directly.

**Notification approach**: Each created task with an assignee triggers `create_notification(recipient=assignee, event_type="task_assigned", task=task, ...)` — identical to manual task creation. No special "bulk" notification needed.

**Alternatives considered**:
- Call TaskCreateSerializer.create() in a loop: Works but slower due to repeated validation. Better to validate once upfront.
- bulk_create: Doesn't work with M2M fields (assignees, tags) or signals. Need individual creates.
- Custom "batch created" notification: Over-engineered; individual notifications match spec (US-5 acceptance criteria).

---

## R-007: LLM Response Parsing — Robust JSON extraction

**Decision**: Parse LLM response as JSON. If direct `json.loads()` fails, attempt to extract JSON from markdown code fences (```json ... ```). If that fails too, return error to the manager with retry option.

**Rationale**: LLMs sometimes wrap JSON in markdown fences despite instructions. A simple regex fallback handles this common case. Beyond that, we don't try heroic recovery — the manager can retry (which may succeed) or create tasks manually.

**Validation after parsing**:
1. Must be a list
2. Each item must have `title` (non-empty string)
3. `assignee_id` must be in the project team set or null (FR-013: silently drop invalid)
4. `tag_ids` must be subset of org tags (silently drop invalid)
5. `priority` must be valid choice or default to "medium"
6. Cap at 15 tasks (FR assumption)

**Alternatives considered**:
- Use `response_format={"type": "json_object"}` LiteLLM parameter: Only works with OpenAI-compatible APIs. Not portable across all providers LiteLLM supports. Use as enhancement (pass if supported, don't rely on it).
- Retry on parse failure: The 3 retries in `call_llm` handle transport errors; a parse failure likely means the prompt needs adjustment, not a retry.

---

## R-008: Concurrency Prevention — Redis concurrency guard

**Decision**: Use a Redis key `epic_generate:{epic_id}` as a concurrency guard. The API view sets it atomically via `SET NX EX 120` (set-if-not-exists with 120s expiry). If the key already exists, return 409 CONFLICT immediately. The Celery task deletes the key in its `finally` block on completion or failure.

**Rationale**: This is simpler than a distributed lock because there's no need for lock ownership transfer between processes. The view and Celery task run in separate processes — a `redis.lock()` acquired by the view can't be released by the Celery worker. Using an atomic SET NX avoids this problem entirely. Redis is already available as Celery broker/backend. 120s TTL acts as a safety net if the Celery task crashes without cleanup. The Celery task has `time_limit=120` matching the TTL.

**Frontend handling**: If 409 returned, show "Generation already in progress" message.

**Alternatives considered**:
- `redis.lock()` in both view and Celery task: Lock acquired by the view can't be released by the Celery worker (different process). Would require the view to release immediately, creating a race window.
- Database-level lock (SELECT FOR UPDATE): Wouldn't work for async Celery tasks running in separate processes.
- Celery task deduplication: Celery doesn't natively prevent duplicate task dispatch. Redis guard is explicit and simple.

---

## R-009: Frontend Preview Dialog — MatDialog with editable task table

**Decision**: New `AiTaskPreviewDialogComponent` opened via `MatDialog`. Displays tasks in a scrollable list with inline editing. Each task row shows title (editable input), description (editable textarea), priority (mat-select), assignee (mat-select from team), tags (mat-chip-set), and a remove button.

**Rationale**: Matches existing dialog patterns in the app (e.g., `CreateEntityDialogComponent` at 600px, `ConfirmDialogComponent`). A wider dialog (800px) accommodates the richer content. Inline editing is faster than opening per-task dialogs.

**Key interactions**:
- "Confirm All" button: Creates all remaining tasks
- "Cancel" button: Closes dialog, no tasks created
- Remove button per row: Removes task from preview
- All fields editable inline

**Alternatives considered**:
- Full-page preview route: Over-engineered for a list of 3-15 tasks. Dialog is sufficient.
- Stepper/wizard: Unnecessary steps. Single preview screen is simpler and faster.
- Non-editable preview with "edit" links: Slower workflow; inline is better.

---

## R-010: Error Handling Strategy

**Decision**: Three error scenarios, each with clear UX:

1. **LLM call fails** (timeout, API error): Celery task catches exception, returns `{status: "failed", error: "..."}`. Frontend shows error snackbar + "Retry" button.
2. **LLM returns unparseable output**: Same as above — treated as a generation failure.
3. **Confirm-tasks validation fails** (e.g., all tasks removed): Frontend disables "Confirm" when task list is empty. Backend returns 400 if empty list submitted.

**Rationale**: Spec requires graceful error handling with retry (FR-016, SC-006). No fallback template (unlike summaries) — task generation either works or the manager creates manually.

**Alternatives considered**:
- Fallback to template-generated tasks: No sensible template for arbitrary Epic descriptions. Unlike summaries which have metrics to template, task generation is inherently creative.
- Auto-retry on failure: The LLM already retries 3 times internally. If all fail, it's a persistent issue; don't loop.
