import json
import logging
import time

from django.conf import settings
from django.utils import timezone

from apps.reports.services import get_report_data

from .prompts import (
    DAILY_USER_PROMPT,
    ON_DEMAND_USER_PROMPT,
    SYSTEM_PROMPT,
    WEEKLY_NO_TREND_SECTION,
    WEEKLY_TREND_SECTION,
    WEEKLY_USER_PROMPT,
)

logger = logging.getLogger(__name__)

FALLBACK_TEMPLATE = """Report Summary ({period_type}) — {start_date} to {end_date}

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

Note: This summary was generated using a template because the AI service \
was temporarily unavailable. An AI-enhanced summary may be regenerated later."""


def call_llm(system_prompt, user_prompt):
    """Call LLM via LiteLLM. Returns (text, model, prompt_tokens, completion_tokens)."""
    import litellm

    litellm.num_retries = 3
    litellm.request_timeout = 60

    kwargs = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": settings.LLM_MAX_TOKENS,
        "temperature": settings.LLM_TEMPERATURE,
    }
    if settings.LLM_API_KEY:
        kwargs["api_key"] = settings.LLM_API_KEY
    if settings.LLM_API_BASE:
        kwargs["api_base"] = settings.LLM_API_BASE

    response = litellm.completion(**kwargs)
    text = response.choices[0].message.content
    model = response.model or settings.LLM_MODEL
    prompt_tokens = getattr(response.usage, "prompt_tokens", None)
    completion_tokens = getattr(response.usage, "completion_tokens", None)
    return text, model, prompt_tokens, completion_tokens


def generate_fallback_summary(period_type, metrics_data):
    """Generate a template-based summary from raw metrics."""
    tasks = metrics_data.get("tasks", {})
    period = metrics_data.get("period", {})

    priority_lines = []
    for p, count in tasks.get("by_priority", {}).items():
        priority_lines.append(f"- {p}: {count}")
    priority_breakdown = "\n".join(priority_lines) if priority_lines else "- No data"

    client_lines = []
    for c in metrics_data.get("by_client", [])[:5]:
        client_lines.append(f"- {c['client_name']}: {c['total']} tasks ({c['done']} done)")
    client_breakdown = "\n".join(client_lines) if client_lines else "- No data"

    engineer_lines = []
    for e in metrics_data.get("by_engineer", [])[:5]:
        engineer_lines.append(f"- {e['engineer_name']}: {e['assigned']} assigned ({e['done']} done)")
    engineer_breakdown = "\n".join(engineer_lines) if engineer_lines else "- No data"

    return FALLBACK_TEMPLATE.format(
        period_type=period_type,
        start_date=period.get("from", "N/A"),
        end_date=period.get("to", "N/A"),
        total=tasks.get("total", 0),
        created=tasks.get("created_in_period", 0),
        closed=tasks.get("closed_in_period", 0),
        overdue=tasks.get("overdue", 0),
        priority_breakdown=priority_breakdown,
        client_breakdown=client_breakdown,
        engineer_breakdown=engineer_breakdown,
    )


def collect_metrics(period_start, period_end):
    """Collect task metrics for a given date range using the existing reports service."""
    return get_report_data(
        date_from=str(period_start),
        date_to=str(period_end),
    )


def _build_user_prompt(period_type, period_start, period_end, metrics_data, prev_metrics=None):
    """Build the appropriate user prompt for the period type."""
    metrics_json = json.dumps(metrics_data, indent=2, default=str)

    if period_type == "daily":
        return DAILY_USER_PROMPT.format(
            period_start=period_start,
            metrics_json=metrics_json,
        )
    elif period_type == "weekly":
        if prev_metrics:
            trend_section = WEEKLY_TREND_SECTION.format(
                prev_metrics_json=json.dumps(prev_metrics, indent=2, default=str),
            )
        else:
            trend_section = WEEKLY_NO_TREND_SECTION
        return WEEKLY_USER_PROMPT.format(
            period_start=period_start,
            period_end=period_end,
            metrics_json=metrics_json,
            trend_section=trend_section,
        )
    else:
        return ON_DEMAND_USER_PROMPT.format(
            period_start=period_start,
            period_end=period_end,
            metrics_json=metrics_json,
        )


def notify_managers_of_summary(summary):
    """Create a notification for all managers when a summary is ready."""
    from apps.accounts.models import User
    from apps.notifications.services import create_notification

    period_desc = f"{summary.period_start}"
    if summary.period_start != summary.period_end:
        period_desc = f"{summary.period_start} to {summary.period_end}"

    message = (
        f"A new {summary.get_period_type_display().lower()} summary "
        f"for {period_desc} is available."
    )

    managers = User.objects.filter(role=User.Role.MANAGER, is_active=True)
    for manager in managers:
        create_notification(
            recipient=manager,
            event_type="summary_ready",
            task=None,
            message=message,
            related_object_id=summary.id,
        )
    logger.info("Notified %d managers about summary id=%s", managers.count(), summary.id)


def generate_summary_for_period(summary_id, prev_metrics=None):
    """Orchestrate summary generation: collect metrics, call LLM, handle fallback."""
    from .models import ReportSummary

    summary = ReportSummary.objects.get(pk=summary_id)
    summary.status = ReportSummary.Status.GENERATING
    summary.save(update_fields=["status"])

    logger.info(
        "Generating summary id=%s period_type=%s period=%s-%s",
        summary.id, summary.period_type, summary.period_start, summary.period_end,
    )

    metrics_data = collect_metrics(summary.period_start, summary.period_end)
    summary.raw_data = metrics_data
    summary.save(update_fields=["raw_data"])

    user_prompt = _build_user_prompt(
        summary.period_type, summary.period_start, summary.period_end,
        metrics_data, prev_metrics,
    )

    start_time = time.monotonic()
    try:
        text, model, prompt_tokens, completion_tokens = call_llm(SYSTEM_PROMPT, user_prompt)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)

        summary.summary_text = text
        summary.generation_method = ReportSummary.GenerationMethod.AI
        summary.status = ReportSummary.Status.COMPLETED
        summary.llm_model = model
        summary.prompt_tokens = prompt_tokens
        summary.completion_tokens = completion_tokens
        summary.generation_time_ms = elapsed_ms
        summary.save(update_fields=[
            "summary_text", "generation_method", "status",
            "llm_model", "prompt_tokens", "completion_tokens", "generation_time_ms",
        ])
        logger.info(
            "Summary completed id=%s method=ai model=%s tokens=%s/%s time_ms=%s",
            summary.id, model, prompt_tokens, completion_tokens, elapsed_ms,
        )
        notify_managers_of_summary(summary)
    except Exception as e:
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.warning(
            "LLM failed for summary id=%s: %s. Using fallback.", summary.id, e,
        )
        fallback_text = generate_fallback_summary(summary.period_type, metrics_data)
        summary.summary_text = fallback_text
        summary.generation_method = ReportSummary.GenerationMethod.FALLBACK
        summary.status = ReportSummary.Status.COMPLETED
        summary.error_message = str(e)
        summary.generation_time_ms = elapsed_ms
        summary.save(update_fields=[
            "summary_text", "generation_method", "status",
            "error_message", "generation_time_ms",
        ])
        logger.info("Summary completed id=%s method=fallback time_ms=%s", summary.id, elapsed_ms)
        notify_managers_of_summary(summary)

    return summary
