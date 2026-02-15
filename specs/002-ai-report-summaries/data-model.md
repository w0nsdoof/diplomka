# Data Model: AI-Generated Report Summaries

**Feature Branch**: `002-ai-report-summaries`
**Date**: 2026-02-14

## Entity: ReportSummary

The primary entity storing AI-generated (or fallback) narrative summaries for reporting periods.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | AutoField | PK | Primary key |
| `period_type` | CharField(20) | choices: `daily`, `weekly`, `on_demand`; indexed | Type of reporting period |
| `period_start` | DateField | indexed | Start date of the covered period (inclusive) |
| `period_end` | DateField | indexed | End date of the covered period (inclusive) |
| `summary_text` | TextField | | The generated narrative summary |
| `generation_method` | CharField(20) | choices: `ai`, `fallback` | How the summary was generated |
| `status` | CharField(20) | choices: `pending`, `generating`, `completed`, `failed`; indexed | Current generation status |
| `llm_model` | CharField(100) | blank=True | LLM model identifier used (e.g., `openai/gpt-4o-mini`) |
| `prompt_tokens` | PositiveIntegerField | null=True | Input tokens consumed |
| `completion_tokens` | PositiveIntegerField | null=True | Output tokens consumed |
| `generation_time_ms` | PositiveIntegerField | null=True | Time taken for generation in milliseconds |
| `raw_data` | JSONField | default=dict | Snapshot of the metrics data used for generation |
| `error_message` | TextField | blank=True | Error details if generation failed |
| `requested_by` | ForeignKey(User) | null=True, blank=True, SET_NULL | User who triggered on-demand/regeneration (null for auto-generated) |
| `generated_at` | DateTimeField | auto_now_add, indexed | Timestamp of generation |
| `created_at` | DateTimeField | auto_now_add | Row creation timestamp |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_summary_period` | `(period_type, period_start, period_end)` | Efficient lookup/duplicate check for a given period |
| `idx_summary_status` | `(status,)` | Filter by generation status |
| `idx_summary_generated` | `(generated_at,)` | Order by generation time (latest first) |
| `idx_summary_period_latest` | `(period_type, period_start, period_end, -generated_at)` | Get latest version for a period group |

### Validation Rules

- `period_end` must be >= `period_start`
- `period_type` must be one of: `daily`, `weekly`, `on_demand`
- For `daily`: `period_start == period_end` (single day)
- For `weekly`: `period_end - period_start == 6 days` (Mon-Sun)
- For `on_demand`: any valid date range
- `summary_text` is populated only when `status == 'completed'`
- `generation_method` is set when generation completes (`ai` or `fallback`)

### State Transitions

```
pending → generating → completed
                    → failed
```

- **pending**: Created, waiting for Celery worker to pick up
- **generating**: Celery task is actively generating (LLM call in progress)
- **completed**: Successfully generated (either AI or fallback)
- **failed**: All attempts failed (no fallback possible — should be rare since fallback is deterministic)

### Versioning

Multiple rows can exist for the same `(period_type, period_start, period_end)` tuple. Each represents a version. The **latest** version is determined by `MAX(generated_at)` within the group. No explicit version counter needed.

---

## Modified Entity: Notification (existing)

The existing `Notification` model requires two changes to support summary notifications.

### Field Changes

| Field | Change | Before | After |
|-------|--------|--------|-------|
| `task` | Make nullable | `ForeignKey(Task, on_delete=CASCADE)` | `ForeignKey(Task, on_delete=CASCADE, null=True, blank=True)` |
| `event_type` | Add choice | 6 choices | 7 choices (add `summary_ready`) |

### New Event Type

| Value | Description |
|-------|-------------|
| `summary_ready` | A new AI-generated summary is available for viewing |

For `summary_ready` notifications:
- `task` is `NULL`
- `message` contains a description like "A new daily summary for 2026-02-13 is available"
- `recipient` is each user with `role='manager'`

---

## Relationships

```
ReportSummary.requested_by → User (optional, SET_NULL)
Notification.task → Task (optional after migration, CASCADE)
Notification → created for each manager when ReportSummary.status becomes 'completed'
```

---

## Django Model Definition

```python
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class ReportSummary(models.Model):
    class PeriodType(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        ON_DEMAND = "on_demand", "On-demand"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        GENERATING = "generating", "Generating"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class GenerationMethod(models.TextChoices):
        AI = "ai", "AI"
        FALLBACK = "fallback", "Fallback template"

    period_type = models.CharField(
        max_length=20, choices=PeriodType.choices, db_index=True
    )
    period_start = models.DateField(db_index=True)
    period_end = models.DateField(db_index=True)
    summary_text = models.TextField(blank=True, default="")
    generation_method = models.CharField(
        max_length=20, choices=GenerationMethod.choices, blank=True, default=""
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    llm_model = models.CharField(max_length=100, blank=True, default="")
    prompt_tokens = models.PositiveIntegerField(null=True, blank=True)
    completion_tokens = models.PositiveIntegerField(null=True, blank=True)
    generation_time_ms = models.PositiveIntegerField(null=True, blank=True)
    raw_data = models.JSONField(default=dict)
    error_message = models.TextField(blank=True, default="")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_summaries",
    )
    generated_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]
        indexes = [
            models.Index(
                fields=["period_type", "period_start", "period_end"],
                name="idx_summary_period",
            ),
            models.Index(
                fields=["period_type", "period_start", "period_end", "-generated_at"],
                name="idx_summary_period_latest",
            ),
        ]
        verbose_name = "Report Summary"
        verbose_name_plural = "Report Summaries"

    def __str__(self):
        return f"{self.get_period_type_display()} summary: {self.period_start} - {self.period_end}"

    def clean(self):
        if self.period_end < self.period_start:
            raise ValidationError("period_end must be >= period_start")
```
