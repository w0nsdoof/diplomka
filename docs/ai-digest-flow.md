# AI Digest Pipeline: End-to-End Flow

This document traces the full lifecycle of an AI-generated report summary, from trigger to user delivery.

---

## Architecture Overview

```
Celery Beat / Manager API
        |
        v
  generate_summary (Celery task)
        |
  [Redis lock acquired]
        |
        v
  collect_metrics  ──>  reports.services.get_report_data()
        |                   (Task, AuditLogEntry queries)
        v
  render_metrics_as_markdown  ──>  Markdown tables
        |
        v
  _build_user_prompt  ──>  System + User prompt assembled
        |
        v
  call_llm  ──>  litellm.completion()  ──>  LLM provider (Groq, OpenRouter, etc.)
        |
        v
  parse_sections  ──>  ReportSummary row updated (COMPLETED)
        |
        v
  notify_managers_of_summary
        |
        ├──> Notification DB record (in-app bell icon)
        └──> send_telegram_notification (Celery task)
                |
                v
            render_telegram_message  ──>  Telegram Bot API sendMessage
```

---

## Step 1: Trigger

There are three trigger mechanisms, all of which eventually call the same core Celery task.

### 1a. Scheduled (Celery Beat)

Configured in `backend/config/settings/base.py:248-269`:

| Schedule | Task | Cron |
|---|---|---|
| **Daily** | `apps.ai_summaries.tasks.generate_daily_summary` | `00:05 UTC` every day |
| **Weekly** | `apps.ai_summaries.tasks.generate_weekly_summary` | `06:00 UTC` every Monday |

**Daily** (`backend/apps/ai_summaries/tasks.py:17-45`):
- Computes `yesterday = date.today() - timedelta(days=1)`
- Iterates every active Organization
- Skips if a `COMPLETED` ReportSummary already exists for that org + date
- Dispatches `generate_summary.delay("daily", yesterday, yesterday, organization_id=org.id)`

**Weekly** (`backend/apps/ai_summaries/tasks.py:48-89`):
- Computes `last_monday` and `last_sunday` (previous Mon-Sun)
- Iterates every active Organization
- Skips if a `COMPLETED` weekly summary already exists
- Collects the *previous* week's metrics for week-over-week trend comparison
- Dispatches `generate_summary.delay("weekly", last_monday, last_sunday, organization_id=org.id, prev_metrics=prev_metrics)`

### 1b. On-Demand (Manager API)

**Endpoint**: `POST /api/summaries/generate/`
**View**: `SummaryGenerateView` in `backend/apps/ai_summaries/views.py`
**Permission**: Manager-only (`IsManager`)

Request body:
```json
{
  "period_start": "2026-04-01",
  "period_end": "2026-04-07",
  "project_id": 5,          // optional scope
  "client_id": 3,           // optional scope
  "focus_prompt": "Focus on the billing team's workload",  // optional
  "llm_model_id": "openrouter/google/gemini-2.5-flash"     // optional model override
}
```

The view creates a `ReportSummary` row upfront (status=PENDING) and dispatches `generate_summary.delay(...)` with the `summary_id`.

### 1c. Regenerate

**Endpoint**: `POST /api/summaries/{id}/regenerate/`
**View**: `SummaryRegenerateView` in `backend/apps/ai_summaries/views.py`

Creates a *new* ReportSummary row (for version history) and dispatches the task with an optional `model_override` parameter.

---

## Step 2: Redis Lock & Row Creation

**File**: `backend/apps/ai_summaries/tasks.py:92-150`
**Function**: `generate_summary()` (core shared Celery task)

1. Constructs a lock key: `summary:{period_type}:{period_start}:{period_end}:{organization_id or 'global'}`
2. Acquires a non-blocking Redis lock (TTL = 300s)
   - If contention, logs and returns `None` (deduplication)
3. If `summary_id` was passed (on-demand/regenerate): fetches the existing row
4. Otherwise (scheduled): creates a new `ReportSummary` row with status `PENDING`
5. Calls `generate_summary_for_period(summary.id, prev_metrics, model_override)`
6. Releases the lock in a `finally` block

---

## Step 3: Metrics Collection

**File**: `backend/apps/ai_summaries/services.py:498-507`
**Function**: `collect_metrics()`

Delegates to `backend/apps/reports/services.py:157-432` (`get_report_data()`), which runs Django ORM queries against `Task` and `AuditLogEntry` models.

### Data collected

| Category | Source | Details |
|---|---|---|
| **Headline counts** | `Task` queryset | total, created_in_period, closed_in_period, overdue, unassigned_count |
| **Overdue breakdown** | `Task` + date math | overdue_new (deadline crossed during period) vs overdue_inherited |
| **Status distribution** | `Task.status` aggregation | Counts per status (created, in_progress, waiting, done, archived) |
| **Priority distribution** | `Task.priority` aggregation | Counts per priority level |
| **Lead time** | `AuditLogEntry` (STATUS_CHANGE to "done") | created_at -> done timestamp; returns median, p90, avg (hours) |
| **Cycle time** | `AuditLogEntry` (in_progress -> done) | Last in_progress -> done; returns median, p90, avg (hours) |
| **By client** | `Task.client` aggregation | Top clients by task count + done count |
| **By engineer** | `Task.assignees` aggregation | Assigned, done, in_progress, overdue per engineer |
| **By tag** | `Task.tags` aggregation | Task count per tag |
| **Stuck-waiting** | `Task(status=waiting)` + `AuditLogEntry` | Tasks in "waiting" for 3+ days; sample of up to 10 |
| **Approaching deadline** | `Task.deadline` within 48h | Up to 10 tasks, sorted by deadline proximity |
| **Status transitions** | `AuditLogEntry(STATUS_CHANGE)` in period | Count of from->to transitions |

### Scoping

- **Organization**: Always scoped (org FK on Task)
- **Project**: Optional, via `project_id` filter
- **Client**: Optional, via `client_id` filter

The raw metrics dict is saved to `ReportSummary.raw_data` (JSONField) for audit and frontend charts.

---

## Step 4: Prompt Construction

### 4a. Metrics -> Markdown

**File**: `backend/apps/ai_summaries/services.py:237-354`
**Function**: `render_metrics_as_markdown(metrics)`

Converts the metrics dict into compact Markdown tables. Only sends the top N rows per breakdown to limit token usage:

| Breakdown | Limit | Constant |
|---|---|---|
| Clients | 5 | `TOP_CLIENTS` |
| Engineers | 5 | `TOP_ENGINEERS` |
| Tags | 5 | `TOP_TAGS` |
| Stuck tasks | 5 | `STUCK_TASKS_IN_PROMPT` |

Output sections: Headline numbers, Status distribution, Priority distribution, Top clients/engineers/tags, Stuck-waiting tasks, Approaching deadline, Status transitions.

### 4b. User Prompt Assembly

**File**: `backend/apps/ai_summaries/services.py:524-557`
**Function**: `_build_user_prompt()`

Selects the prompt template based on period type:

| Period | Template | Sections required | File |
|---|---|---|---|
| **Daily** | `DAILY_USER_PROMPT` | Overview, Watchlist | `prompts.py:62-80` |
| **Weekly** | `WEEKLY_USER_PROMPT` | Overview, Key Metrics, Highlights, Risks & Blockers, Recommendations | `prompts.py:84-115` |
| **On-demand** | `ON_DEMAND_USER_PROMPT` | Same 5 sections as weekly | `prompts.py:128-152` |

**Weekly-specific**: If `prev_metrics` is available, computes week-over-week deltas via `compute_deltas()` and injects a `WEEKLY_TREND_SECTION` block. Deltas with `abs(change_pct) <= 20%` are considered noise and the LLM is instructed to ignore them.

### 4c. Scope Context (optional)

**File**: `backend/apps/ai_summaries/services.py:510-521`
**Function**: `_build_scope_context(summary)`

If the summary is scoped to a project, client, or has a focus prompt, prepends a `# Context` section:
```markdown
# Context
**Scope: Project** -- Billing System Rewrite
**Manager focus:** Focus on the billing team's workload

Use this context to tailor the summary. Prioritise information relevant to the scope and focus above.
```

### 4d. System Prompt

**File**: `backend/apps/ai_summaries/prompts.py:14-58`

A fixed prompt that establishes:
- Role: "project management analyst for an IT outsourcing company"
- Purpose: Help managers decide who needs help, what to escalate, which deadlines to act on
- Hard rules: Only reference numbers from tables, quote concrete names, distinguish new vs inherited overdue
- Anti-patterns: No filler, no header restatement, no invented recommendations
- Two worked examples (daily low-activity, weekly moderate-activity)

The full prompt text is saved to `ReportSummary.prompt_text` before the LLM call.

---

## Step 5: LLM Call

### 5a. Model Resolution

**File**: `backend/apps/ai_summaries/services.py:81-98`
**Function**: `resolve_llm_model()`

Priority chain:
1. Explicit override from request parameter (`model_override`)
2. Organization's `default_llm_model.model_id` (FK to `LLMModel`)
3. System-wide default: `LLMModel.objects.filter(is_default=True, is_active=True)`
4. Fallback: `settings.LLM_MODEL` (env `LLM_MODEL`, default `minimax/minimax-m2.5:free`)

### 5b. LiteLLM Completion

**File**: `backend/apps/ai_summaries/services.py:101-127`
**Function**: `call_llm()`

```python
litellm.completion(
    model=resolved_model,
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_prompt},
    ],
    max_tokens=settings.LLM_MAX_TOKENS,   # default: 2000
    temperature=temperature,
    api_key=settings.LLM_API_KEY,          # if set
    api_base=settings.LLM_API_BASE,        # if set
)
```

Configuration:
- `litellm.num_retries = 0` (no internal retries)
- `litellm.request_timeout = 110` seconds
- Temperature: **0.1** for daily (near-deterministic), configured default (**0.3**) for weekly/on-demand

Returns: `(text, model, prompt_tokens, completion_tokens)`

### 5c. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `LLM_MODEL` | `minimax/minimax-m2.5:free` | LiteLLM model identifier |
| `LLM_API_KEY` | (empty) | Provider API key |
| `LLM_API_BASE` | (empty) | Custom API base URL |
| `LLM_MAX_TOKENS` | `2000` | Max output tokens |
| `LLM_TEMPERATURE` | `0.3` | Default temperature |

---

## Step 6: Response Processing

### 6a. Parse Sections

**File**: `backend/apps/ai_summaries/services.py:130-152`
**Function**: `parse_sections(text)`

Splits the LLM output on `## ` headers into a `{section_name: content}` dict. If no headers are found, stores the entire text under an "Overview" key.

Expected section orders:
- **Daily**: `["Overview", "Watchlist"]`
- **Weekly/On-demand**: `["Overview", "Key Metrics", "Highlights", "Risks & Blockers", "Recommendations"]`

### 6b. Store Results (Success Path)

**File**: `backend/apps/ai_summaries/services.py:672-710`

Fields updated on `ReportSummary`:

| Field | Value |
|---|---|
| `summary_text` | Full LLM output text |
| `sections` | Parsed dict (JSONField) |
| `generation_method` | `"ai"` |
| `status` | `"completed"` |
| `llm_model` | Model ID string from response |
| `prompt_tokens` | From `response.usage` |
| `completion_tokens` | From `response.usage` |
| `generation_time_ms` | Wall-clock elapsed time |

### 6c. Fallback Path (LLM Failure)

**File**: `backend/apps/ai_summaries/services.py:711-739`

If the LLM call raises any exception:
1. Logs the error
2. Generates a template-based summary via `generate_fallback_summary()` (`services.py:412-495`)
   - Daily: 2-section template (Overview + Watchlist)
   - Weekly/On-demand: 5-section template with data from metrics
   - Includes a note: *"This summary was generated from a template because the AI service was unavailable."*
3. Saves with `generation_method="fallback"` and `error_message=str(exception)`
4. Status is still set to `COMPLETED` (not FAILED)
5. Managers are still notified

---

## Step 7: Real-Time Pipeline Stages (WebSocket + Redis)

**File**: `backend/apps/ai_summaries/services.py:594-614`
**Function**: `_set_summary_stage(summary_id, stage, meta)`

Throughout the generation process, stage updates are broadcast for the frontend to display progress:

| Stage | Metadata | When |
|---|---|---|
| `collecting_metrics` | `{}` then `{total_tasks, created_in_period, closed_in_period}` | Before and after data collection |
| `building_prompt` | `{}` then `{token_estimate, period_type}` | Before and after prompt construction |
| `calling_llm` | `{model}` | Before the LiteLLM call |
| `parsing_sections` | `{model, prompt_tokens, completion_tokens, generation_time_ms}` | After LLM returns |
| `completed` | `{section_count, generation_time_ms, method}` | Final stage |

Delivery:
1. **Redis SET**: `summary_generate:{id}:stage` with JSON payload (TTL 300s) -- for HTTP polling
2. **Django Channels**: Group `generation_summary_{id}` via `group_send` -- for WebSocket push

---

## Step 8: Manager Notification

**File**: `backend/apps/ai_summaries/services.py:560-591`
**Function**: `notify_managers_of_summary(summary)`

1. Queries all active managers in the summary's organization
2. For each manager, calls `create_notification()` (`backend/apps/notifications/services.py:4-40`)

The notification includes:
- `event_type`: `"summary_ready"`
- `related_object_id`: `summary.id` (used by frontend to route to `/reports/summaries/{id}`)
- `telegram_context`: `{"event_type": "summary_ready", "entity_type": "summary", "title": "Weekly summary", "period": "2026-04-07 to 2026-04-13"}`

---

## Step 9: Telegram Delivery

### 9a. Dispatch

**File**: `backend/apps/notifications/services.py:26-38`

`create_notification()` dispatches a Celery task:
```python
send_telegram_notification.delay(recipient.pk, message, title, telegram_context=ctx)
```

### 9b. Send Task

**File**: `backend/apps/telegram/tasks.py:23-82`
**Function**: `send_telegram_notification()`

1. Checks the user has an active `TelegramLink` with `telegram_notifications_enabled=True`
2. Since `telegram_context` is provided, renders a structured message via `render_telegram_message()`
3. Sends via `send_telegram_message(chat_id, text)` using the Telegram Bot API (`sendMessage`, `parse_mode=HTML`)
4. On 403 (bot blocked): deactivates the `TelegramLink`
5. Retries up to 3 times with 30s delay on failure

### 9c. Message Rendering

**File**: `backend/apps/telegram/templates.py:146-181`
**Function**: `render_telegram_message(event_type, language, context)`

For `summary_ready`, the rendered HTML message looks like:

```
📊 Report summary ready

Title: Weekly summary
Period: 2026-04-07 to 2026-04-13
```

- Bilingual: headings and labels are translated based on user's `language` preference (en/ru)
- Fields shown: `["title", "period"]` (defined in `EVENT_FIELDS`, line 122)
- Values are HTML-escaped and truncated to 200 chars

### 9d. Prerequisites (Telegram Linking)

Users must link their Telegram account before receiving notifications:
1. User generates a verification code via the API (`backend/apps/telegram/services.py`)
2. User sends `/start <code>` or `/verify <code>` to the bot in Telegram (`backend/apps/telegram/bot.py`)
3. Bot verifies the code and creates a `TelegramLink(user, chat_id, is_active=True, telegram_notifications_enabled=True)`

---

## Step 10: Frontend Display

### Routes

| Route | Component | Purpose |
|---|---|---|
| `/reports` | `ReportsComponent` | Latest daily + weekly summary cards, on-demand generation form |
| `/reports/summaries` | `SummaryListComponent` | Paginated table of all summaries with period-type filter |
| `/reports/summaries/:id` | `SummaryDetailComponent` | Full summary with sections, charts, metadata, regenerate |

### Summary Detail Page

Displays:
- **Scope badges** (project/client/focus if scoped)
- **Structured sections** from `ReportSummary.sections` (or plain text fallback)
- **Charts**: Status distribution (doughnut), Priority distribution (bar), Engineer workload (stacked bar), Client activity (bar) -- all from `raw_data`
- **Generation metadata**: model, token usage, time, requested_by, method
- **Prompt expansion panel** (manager-only): shows the full prompt sent to the LLM
- **Regenerate button** with LLM model selector
- **Version history** list (each regenerate creates a new row)

### Real-Time Generation Progress

The `SummaryDetailComponent` polls for status while a summary is generating:
- **Primary**: WebSocket via `GenerationWsService` (group `generation_summary_{id}`)
- **Fallback**: HTTP polling via `GET /api/summaries/{id}/generation-status/` every 3 seconds
- Renders pipeline stages as a progress stepper (collecting_metrics -> building_prompt -> calling_llm -> parsing_sections -> completed)

### API Service

**File**: `frontend/src/app/core/services/summary.service.ts`

| Method | HTTP | Endpoint |
|---|---|---|
| `getLatest()` | GET | `/api/summaries/latest/` |
| `list(filters)` | GET | `/api/summaries/` |
| `getById(id)` | GET | `/api/summaries/{id}/` |
| `getVersions(id)` | GET | `/api/summaries/{id}/versions/` |
| `generate(...)` | POST | `/api/summaries/generate/` |
| `regenerate(id, model)` | POST | `/api/summaries/{id}/regenerate/` |
| `pollGenerationStatus(id)` | GET | `/api/summaries/{id}/generation-status/` |

---

## Data Model

### ReportSummary (`backend/apps/ai_summaries/models.py:39-133`)

| Field | Type | Purpose |
|---|---|---|
| `period_type` | CharField (daily/weekly/on_demand) | Summary cadence |
| `period_start` / `period_end` | DateField | Date range covered |
| `summary_text` | TextField | Full LLM output |
| `sections` | JSONField | Parsed `{section_name: content}` |
| `raw_data` | JSONField | Full metrics dict (for charts/audit) |
| `prompt_text` | TextField | Full user prompt sent to LLM |
| `status` | CharField (pending/generating/completed/failed) | Pipeline state |
| `generation_method` | CharField (ai/fallback) | How content was produced |
| `llm_model` | CharField | Model ID that generated the text |
| `prompt_tokens` / `completion_tokens` | PositiveIntegerField | Token usage |
| `generation_time_ms` | PositiveIntegerField | Wall-clock LLM call time |
| `error_message` | TextField | Exception string (fallback path) |
| `organization` | FK -> Organization | Org scope (required) |
| `project` | FK -> Project (nullable) | Optional project scope |
| `client` | FK -> Client (nullable) | Optional client scope |
| `focus_prompt` | TextField | Manager's custom instructions |
| `requested_by` | FK -> User (nullable) | Who triggered (null for scheduled) |
| `generated_at` | DateTimeField (auto) | Timestamp |

### LLMModel (`backend/apps/ai_summaries/models.py:6-36`)

| Field | Type | Purpose |
|---|---|---|
| `model_id` | CharField (unique) | LiteLLM identifier (e.g. `openrouter/google/gemini-2.5-flash`) |
| `display_name` | CharField | UI label |
| `is_active` | BooleanField | Available for selection |
| `is_default` | BooleanField | System-wide default (enforced unique via `save()` override) |

---

## Key File Reference

| File | Role |
|---|---|
| `backend/config/settings/base.py:248-282` | Celery Beat schedule + LLM env vars |
| `backend/apps/ai_summaries/tasks.py` | Celery tasks (daily, weekly, core generate) |
| `backend/apps/ai_summaries/services.py` | Orchestration: collect, prompt, call, parse, notify |
| `backend/apps/ai_summaries/prompts.py` | System + user prompt templates |
| `backend/apps/ai_summaries/models.py` | ReportSummary + LLMModel models |
| `backend/apps/ai_summaries/views.py` | API endpoints (generate, regenerate, list, detail) |
| `backend/apps/reports/services.py` | `get_report_data()` -- raw metrics queries |
| `backend/apps/notifications/services.py` | `create_notification()` -- in-app + Telegram dispatch |
| `backend/apps/telegram/tasks.py` | `send_telegram_notification()` Celery task |
| `backend/apps/telegram/templates.py` | Bilingual message rendering |
| `frontend/src/app/core/services/summary.service.ts` | Angular HTTP service |
| `frontend/src/app/features/reports/` | Angular components (reports, list, detail) |
