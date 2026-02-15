# Research: AI-Generated Report Summaries

**Feature Branch**: `002-ai-report-summaries`
**Date**: 2026-02-14

## R1: LiteLLM as LLM Gateway

**Decision**: Use LiteLLM Python SDK (`litellm.completion()`) for all LLM calls.

**Rationale**:
- LiteLLM provides a unified OpenAI-compatible interface to 100+ LLM providers (OpenAI, Anthropic, Azure, Ollama, etc.)
- Single API call pattern regardless of provider — switching models requires only changing the `model` string and API key
- Built-in retry logic (`litellm.num_retries`), request timeouts, and exception handling
- Response format is standardized (OpenAI-compatible): `response.choices[0].message.content`
- Tracks token usage: `response.usage.prompt_tokens`, `response.usage.completion_tokens`
- Can be used as a library (no proxy server needed) — simpler deployment

**Alternatives Considered**:
- **Direct OpenAI SDK**: Locks us to a single provider; switching would require code changes
- **LiteLLM Proxy Server**: Adds operational complexity (another service to deploy); overkill for our single-call use case
- **LangChain**: Heavier dependency with features we don't need (chains, agents, memory)

**Integration Pattern**:
```python
from litellm import completion
import litellm

litellm.num_retries = 3
litellm.request_timeout = 60

response = completion(
    model=settings.LLM_MODEL,       # e.g., "openai/gpt-4o-mini"
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": metrics_prompt},
    ],
    max_tokens=2000,
    temperature=0.3,
)
summary_text = response.choices[0].message.content
tokens_used = response.usage.total_tokens
```

**Configuration (environment variables)**:
- `LLM_MODEL`: Model identifier (e.g., `openai/gpt-4o-mini`, `anthropic/claude-3-haiku-20240307`)
- `LLM_API_KEY`: Provider API key (e.g., OpenAI key, Anthropic key)
- `LLM_API_BASE`: Optional custom API base URL (for self-hosted or proxy setups)
- `LLM_MAX_TOKENS`: Max tokens for completion (default: 2000)
- `LLM_TEMPERATURE`: Temperature for generation (default: 0.3 — factual, not creative)

---

## R2: Celery Task Design for Async Summary Generation

**Decision**: Use Celery tasks with Redis locks for async summary generation, scheduled via Celery Beat.

**Rationale**:
- Celery is already configured in the project (`config/celery.py`) with Redis as broker
- Celery Beat already runs hourly deadline checks — adding daily/weekly schedules is trivial
- LLM API calls can take 10-30 seconds — must not block the API thread
- Redis-based distributed locks prevent duplicate concurrent generation for the same period

**Task Architecture**:
1. **`generate_daily_summary`** — Celery Beat task, runs daily at 00:05 UTC
2. **`generate_weekly_summary`** — Celery Beat task, runs Monday at 06:00 UTC
3. **`generate_summary`** — Core shared task called by the above and by on-demand/regenerate API endpoints
   - Accepts: `period_type`, `period_start`, `period_end`, `requested_by_id` (optional)
   - Acquires Redis lock (`summary:{period_type}:{start}:{end}`) to prevent duplicates
   - Collects metrics via existing `get_report_data()` service
   - Calls LLM via LiteLLM service
   - Falls back to template-based summary on failure
   - Creates notification for all managers on success
   - Returns the created `ReportSummary.id`

**Beat Schedule Addition**:
```python
CELERY_BEAT_SCHEDULE = {
    # existing...
    "generate-daily-summary": {
        "task": "apps.ai_summaries.tasks.generate_daily_summary",
        "schedule": crontab(minute=5, hour=0),  # 00:05 UTC daily
    },
    "generate-weekly-summary": {
        "task": "apps.ai_summaries.tasks.generate_weekly_summary",
        "schedule": crontab(minute=0, hour=6, day_of_week=1),  # Monday 06:00 UTC
    },
}
```

**Duplicate Prevention**:
- Redis lock with TTL (5 minutes) prevents concurrent generation for the same period
- Before generating, check if a `ReportSummary` with same `period_type` + `period_start` + `period_end` already exists with `status='completed'` — skip if so (for auto-generated; regenerate bypasses this check)

**Alternatives Considered**:
- **Django management command + cron**: Loses Celery's retry/monitoring; would need separate scheduling
- **Django-Q**: Another task queue — unnecessary when Celery is already in use
- **Synchronous generation**: LLM calls take 10-30s, would block API requests and violate 300ms p95

---

## R3: Fallback Summary Template

**Decision**: Use Python string templates to generate basic summaries from raw metrics when LLM is unavailable.

**Rationale**:
- FR-007 requires a fallback mechanism when LLM is unavailable after retries
- Template-based summaries guarantee a summary is always produced
- Keeps the historical record complete even during LLM outages
- Simple implementation — no external dependencies

**Template Approach**:
```python
FALLBACK_TEMPLATE = """
Report Summary ({period_type}) — {start_date} to {end_date}

Task Activity:
- Total tasks: {total}
- Created in period: {created}
- Completed in period: {closed}
- Currently overdue: {overdue}

Priority Breakdown:
{priority_breakdown}

Top Clients by Activity:
{client_breakdown}

Engineer Workload:
{engineer_breakdown}

Note: This summary was generated using a template because the AI service
was temporarily unavailable. An AI-enhanced summary may be regenerated later.
"""
```

**Alternatives Considered**:
- **Skip generation entirely**: Violates FR-007 and leaves gaps in history
- **Queue and retry later**: Could cause indefinite delays; better to produce fallback immediately and allow manual regeneration

---

## R4: Notification Integration

**Decision**: Extend existing `Notification` model with new `summary_ready` event type. Make `task` FK nullable to support non-task notifications.

**Rationale**:
- FR-010 requires notifying managers when summaries are ready
- Existing `create_notification()` service handles creation, and frontend has notification UI infrastructure
- Current `Notification.task` is a required FK — must become nullable for summary notifications

**Changes Required**:
- **Model migration**: `Notification.task` → `null=True, blank=True`
- **New event type**: Add `summary_ready` to `EVENT_TYPE_CHOICES`
- **Notification creation**: After successful summary generation, call `create_notification()` for each user with `role='manager'`
- **Frontend routing**: When notification `type === 'summary_ready'`, navigate to reports/summaries page instead of a task

**Alternatives Considered**:
- **Generic foreign key (ContentType)**: Over-engineered for just adding one new notification type
- **Separate notification model**: Duplicates infrastructure; the existing model works with minimal changes
- **WebSocket push**: Could add later, but in-app notifications satisfy FR-010

---

## R5: Summary Versioning Strategy

**Decision**: Store each version as a separate `ReportSummary` row. Use `generated_at` ordering to determine "latest".

**Rationale**:
- FR-016 and FR-017 require version history with the latest version displayed by default
- Simplest approach: each regeneration creates a new row with the same `period_type`/`period_start`/`period_end`
- Latest = most recent `generated_at` for a given period group
- No need for a separate `version` counter — ordering by timestamp is sufficient and race-condition-free

**Querying**:
- **Latest summary per period**: `ReportSummary.objects.filter(...).order_by('-generated_at').first()`
- **All versions for a period**: `ReportSummary.objects.filter(period_type=..., period_start=..., period_end=...).order_by('-generated_at')`
- **Default list view**: Uses a subquery/window function or `Subquery` to get only the latest per period group

**Alternatives Considered**:
- **`is_latest` boolean flag**: Requires updating old rows on regeneration (extra write + race condition risk)
- **Version counter field**: Adds complexity for auto-incrementing per group; offers no benefit over timestamp ordering
- **Separate `SummaryVersion` table**: Normalized but adds unnecessary join complexity

---

## R6: LLM Prompt Engineering

**Decision**: Use structured prompts with JSON-formatted metrics data and clear instructions per period type.

**Rationale**:
- The prompt must convert raw metrics (from `get_report_data()`) into a readable narrative
- Different period types need different instructions (daily = tactical, weekly = strategic with trends)
- Temperature 0.3 for factual accuracy; max_tokens capped per FR-012
- Real names are sent per spec clarification (no anonymization)

**Prompt Structure**:
1. **System message**: Role definition + formatting guidelines + length constraint
2. **User message**: Period info + JSON metrics data + specific instructions per period type

**Key Prompt Design Decisions**:
- Include all metrics data as structured JSON for accuracy
- Explicitly instruct "do not invent data" to prevent hallucination
- For weekly: include previous week's data (if available) for trend comparison
- For "no activity" periods: explicit instruction to produce brief message
- Output format: plain text paragraphs, no markdown (for clean display)

---

## R7: Metrics Data Collection

**Decision**: Reuse existing `get_report_data()` from `apps.reports.services` with minor enhancements.

**Rationale**:
- `get_report_data(date_from, date_to, client_id=None)` already aggregates exactly the metrics needed:
  - `total`, `by_status`, `by_priority`, `created_in_period`, `closed_in_period`, `overdue`
  - `by_client`: per-client breakdown (client_name, total, created, done)
  - `by_engineer`: per-engineer breakdown (engineer_name, assigned, done)
- For weekly summaries with trend comparison, call it twice (current week + previous week)
- Store the raw metrics snapshot in `ReportSummary.raw_data` (JSONField) for auditability

**Enhancements Needed**:
- The existing service returns QuerySet-derived data — ensure it's JSON-serializable for storage and prompt injection
- Add a helper to compute week-over-week deltas for weekly summaries

**Alternatives Considered**:
- **New dedicated metrics service**: Duplicates existing logic; `get_report_data()` already covers all needed metrics
- **Raw SQL queries**: Bypasses Django ORM; harder to maintain
