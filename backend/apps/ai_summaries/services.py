import copy
import logging
import time

from django.conf import settings

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

# Temperature override per period type. Daily summaries should be near-deterministic
# (factual recap of one day) while weekly/on-demand summaries can use the configured
# default for narrative variety.
DAILY_TEMPERATURE = 0.1

# Per-section ordering for parsed sections in storage. Daily uses the short shape;
# weekly/on-demand use the full 5-section shape.
SECTION_ORDER = ["Overview", "Key Metrics", "Highlights", "Risks & Blockers", "Recommendations"]
DAILY_SECTION_ORDER = ["Overview", "Watchlist"]

# How many rows from each breakdown to send the LLM. The full data lives in
# raw_data; the prompt only needs the head of the distribution.
TOP_CLIENTS = 5
TOP_ENGINEERS = 5
TOP_TAGS = 5
STUCK_TASKS_IN_PROMPT = 5

FALLBACK_TEMPLATE_DAILY = """\
## Overview
{created} tasks created and {closed} closed on {start_date}. \
Completion rate: {completion_rate}. Currently {overdue} overdue and {unassigned} unassigned.

## Watchlist
{stuck_line}
{priority_line}

Note: This summary was generated from a template because the AI service was unavailable. \
An AI-enhanced summary may be regenerated later."""

FALLBACK_TEMPLATE_FULL = """\
## Overview
{period_type_label} for {start_date} to {end_date}: {created} tasks created, {closed} closed, \
{overdue} overdue, {unassigned} unassigned.

## Key Metrics
- Completion rate: {completion_rate}
- Lead time (created → done): {lead_time_line}
- Cycle time (in_progress → done): {cycle_time_line}

## Highlights
Top clients (by activity in period):
{client_breakdown}

Top engineers:
{engineer_breakdown}

Top tags:
{tag_breakdown}

## Risks & Blockers
{overdue_warning}
{stuck_warning}

## Recommendations
No actionable items — this template is a fallback. Regenerate the summary once the AI service is available.

Note: This summary was generated from a template because the AI service was unavailable."""


def call_llm(system_prompt, user_prompt, temperature=None):
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
        "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
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


def parse_sections(text):
    """Parse LLM output into structured sections dict keyed by header name."""
    sections = {}
    current_section = None
    current_lines = []

    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("## "):
            if current_section:
                sections[current_section] = "\n".join(current_lines).strip()
            current_section = stripped[3:].strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_lines).strip()

    if not sections:
        sections = {"Overview": text.strip()}

    return sections


# ---------- Anonymization helpers (kept for backward-compat with tests) ----------
# These are no longer wired into the generation pipeline. The original concern
# was sending org-internal client/engineer names to a third-party LLM, but the
# manager generating the report already has authenticated access to those names
# inside their own org, so anonymizing only blanded-out the output. The helpers
# stay here so callers/tests that import them keep working.

def anonymize_metrics(*metrics_list):
    """Replace real client/engineer names with pseudonyms across one or more metrics dicts."""
    client_names = []
    engineer_names = []
    seen_clients = set()
    seen_engineers = set()

    for metrics in metrics_list:
        if not metrics:
            continue
        for c in metrics.get("by_client", []):
            name = c.get("client_name", "")
            if name and name not in seen_clients:
                seen_clients.add(name)
                client_names.append(name)
        for e in metrics.get("by_engineer", []):
            name = e.get("engineer_name", "")
            if name and name not in seen_engineers:
                seen_engineers.add(name)
                engineer_names.append(name)

    forward = {}
    for i, name in enumerate(client_names):
        forward[name] = f"Client {chr(65 + i)}" if i < 26 else f"Client {i + 1}"
    for i, name in enumerate(engineer_names):
        forward[name] = f"Engineer {i + 1}"

    reverse = {v: k for k, v in forward.items()}

    results = []
    for metrics in metrics_list:
        if not metrics:
            results.append(metrics)
            continue
        anon = copy.deepcopy(metrics)
        for c in anon.get("by_client", []):
            real = c.get("client_name", "")
            if real in forward:
                c["client_name"] = forward[real]
        for e in anon.get("by_engineer", []):
            real = e.get("engineer_name", "")
            if real in forward:
                e["engineer_name"] = forward[real]
        results.append(anon)

    return results, reverse


def deanonymize_text(text, reverse_mapping):
    """Replace pseudonyms in LLM output text with real names."""
    if not reverse_mapping:
        return text
    for pseudonym in sorted(reverse_mapping, key=len, reverse=True):
        text = text.replace(pseudonym, reverse_mapping[pseudonym])
    return text


# ---------- Markdown rendering ----------

def _fmt_num(value, suffix=""):
    if value is None:
        return "N/A"
    return f"{value}{suffix}"


def _fmt_duration(d):
    """Format a duration dict from reports.services._summarize_durations."""
    if not d or d.get("count", 0) == 0 or d.get("median_hours") is None:
        return "N/A"
    return (
        f"median {d['median_hours']}h, p90 {d['p90_hours']}h, "
        f"avg {d['avg_hours']}h (n={d['count']})"
    )


def render_metrics_as_markdown(metrics):
    """Render the report-data dict as a compact, model-friendly Markdown block.

    Sends only what the LLM needs. The full raw_data is still stored on the
    summary row for audit/UI use.
    """
    if metrics is None:
        return "_No metrics available._"

    tasks = metrics.get("tasks", {}) or {}
    by_status = tasks.get("by_status", {}) or {}
    by_priority = tasks.get("by_priority", {}) or {}
    stuck = tasks.get("stuck_waiting", {}) or {}
    lead_time = tasks.get("lead_time")
    cycle_time = tasks.get("cycle_time")

    parts = []

    parts.append("## Headline numbers")
    parts.append("| Metric | Value |")
    parts.append("|---|---|")
    parts.append(f"| Total tasks (all-time, in org) | {tasks.get('total', 0)} |")
    parts.append(f"| Created in period | {tasks.get('created_in_period', 0)} |")
    parts.append(f"| Closed in period | {tasks.get('closed_in_period', 0)} |")
    parts.append(f"| Completion rate | {_fmt_num(tasks.get('completion_rate'), '%')} |")
    overdue_total = tasks.get('overdue', 0)
    overdue_new = tasks.get('overdue_new')
    overdue_inherited = tasks.get('overdue_inherited')
    if overdue_new is not None:
        parts.append(f"| Currently overdue | {overdue_total} ({overdue_new} new this period, {overdue_inherited} inherited) |")
    else:
        parts.append(f"| Currently overdue | {overdue_total} |")
    parts.append(f"| Unassigned active | {tasks.get('unassigned_count', 0)} |")
    parts.append(f"| Lead time (created → done) | {_fmt_duration(lead_time)} |")
    parts.append(f"| Cycle time (in_progress → done) | {_fmt_duration(cycle_time)} |")
    parts.append("")

    parts.append("## Status distribution (current state, all-time)")
    parts.append("| Status | Count |")
    parts.append("|---|---|")
    for status_name, count in by_status.items():
        parts.append(f"| {status_name} | {count} |")
    parts.append("")

    parts.append("## Priority distribution (current state, all-time)")
    parts.append("| Priority | Count |")
    parts.append("|---|---|")
    for priority, count in by_priority.items():
        parts.append(f"| {priority} | {count} |")
    parts.append("")

    by_client = (metrics.get("by_client") or [])[:TOP_CLIENTS]
    if by_client:
        parts.append(f"## Top {len(by_client)} clients in period")
        parts.append("| Client | Tasks | Done |")
        parts.append("|---|---|---|")
        for c in by_client:
            parts.append(f"| {c['client_name']} | {c['total']} | {c['done']} |")
        parts.append("")

    by_engineer = (metrics.get("by_engineer") or [])[:TOP_ENGINEERS]
    if by_engineer:
        parts.append(f"## Top {len(by_engineer)} engineers in period")
        parts.append("| Engineer | Assigned | Done |")
        parts.append("|---|---|---|")
        for e in by_engineer:
            parts.append(f"| {e['engineer_name']} | {e['assigned']} | {e['done']} |")
        parts.append("")

    by_tag = (metrics.get("by_tag") or [])[:TOP_TAGS]
    if by_tag:
        parts.append(f"## Top {len(by_tag)} tags in period")
        parts.append("| Tag | Count |")
        parts.append("|---|---|")
        for t in by_tag:
            parts.append(f"| {t['tag_name']} | {t['count']} |")
        parts.append("")

    stuck_count = stuck.get("count", 0)
    parts.append(f"## Stuck-waiting tasks (≥3 days in 'waiting'): {stuck_count} total")
    sample = (stuck.get("sample") or [])[:STUCK_TASKS_IN_PROMPT]
    if sample:
        parts.append("| Title | Priority | Waiting (hours) |")
        parts.append("|---|---|---|")
        for t in sample:
            wh = t.get("waiting_hours")
            wh_str = f"{wh}" if wh is not None else "?"
            parts.append(f"| {t.get('title', '')} | {t.get('priority', '')} | {wh_str} |")
    else:
        parts.append("_None._")
    parts.append("")

    approaching = tasks.get("approaching_deadline") or []
    if approaching:
        parts.append(f"## Approaching deadline (next 48 h): {len(approaching)} tasks")
        parts.append("| Title | Priority | Hours remaining |")
        parts.append("|---|---|---|")
        for t in approaching[:STUCK_TASKS_IN_PROMPT]:
            parts.append(f"| {t.get('title', '')} | {t.get('priority', '')} | {t.get('hours_remaining', '?')} |")
    else:
        parts.append("## Approaching deadline (next 48 h): 0 tasks")
    parts.append("")

    transitions = tasks.get("status_transitions") or []
    if transitions:
        parts.append("## Status transitions in period")
        parts.append("| From | To | Count |")
        parts.append("|---|---|---|")
        for t in transitions:
            parts.append(f"| {t['from']} | {t['to']} | {t['count']} |")
    else:
        parts.append("## Status transitions in period\n_No transitions recorded._")
    parts.append("")

    return "\n".join(parts).strip()


def render_deltas_as_markdown(deltas):
    """Render week-over-week deltas dict as a compact Markdown table."""
    if not deltas:
        return "_No previous-period data available._"

    parts = ["| Metric | Current | Previous | Change | Change % |", "|---|---|---|---|---|"]
    label_map = {
        "total": "Total tasks",
        "created_in_period": "Created in period",
        "closed_in_period": "Closed in period",
        "overdue": "Overdue",
        "unassigned_count": "Unassigned",
        "avg_resolution_time_hours": "Avg lead time (h)",
        "completion_rate": "Completion rate (%)",
    }
    for key, d in deltas.items():
        label = label_map.get(key, key)
        change_pct = d.get("change_pct")
        change_pct_str = f"{change_pct}%" if change_pct is not None else "N/A"
        parts.append(
            f"| {label} | {d.get('current')} | {d.get('previous')} | "
            f"{d.get('change')} | {change_pct_str} |"
        )
    return "\n".join(parts)


def compute_deltas(current_metrics, prev_metrics):
    """Compute absolute and percentage deltas between two periods' task metrics."""
    deltas = {}
    current_tasks = current_metrics.get("tasks", {})
    prev_tasks = prev_metrics.get("tasks", {})

    keys = [
        "total", "created_in_period", "closed_in_period", "overdue",
        "unassigned_count", "avg_resolution_time_hours", "completion_rate",
    ]
    for key in keys:
        curr = current_tasks.get(key)
        prev = prev_tasks.get(key)
        if curr is None and prev is None:
            continue
        curr = curr or 0
        prev = prev or 0
        change = round(curr - prev, 1)
        change_pct = round((curr - prev) / prev * 100, 1) if prev else None
        deltas[key] = {
            "current": curr,
            "previous": prev,
            "change": change,
            "change_pct": change_pct,
        }

    return deltas


def generate_fallback_summary(period_type, metrics_data):
    """Generate a template-based summary from raw metrics."""
    tasks = metrics_data.get("tasks", {})
    period = metrics_data.get("period", {})

    comp_rate = tasks.get("completion_rate")
    completion_rate = f"{comp_rate}%" if comp_rate is not None else "N/A"

    overdue_count = tasks.get("overdue", 0)
    overdue_warning = (
        f"- {overdue_count} overdue tasks need attention." if overdue_count else "- No overdue tasks."
    )

    stuck = tasks.get("stuck_waiting", {})
    stuck_count = stuck.get("count", 0)
    stuck_sample = stuck.get("sample") or []
    if stuck_count:
        stuck_titles = ", ".join(t.get("title", "") for t in stuck_sample[:5])
        stuck_warning = f"- {stuck_count} tasks stuck in waiting for 3+ days: {stuck_titles}"
        stuck_line = (
            f"{stuck_count} task(s) stuck waiting 3+ days; longest: "
            f"{stuck_sample[0].get('title', 'unknown') if stuck_sample else 'unknown'}."
        )
    else:
        stuck_warning = "- No stuck tasks."
        stuck_line = "No stuck-waiting tasks."

    priority_counts = tasks.get("by_priority", {}) or {}
    critical_high = priority_counts.get("critical", 0) + priority_counts.get("high", 0)
    priority_line = (
        f"{critical_high} active high/critical-priority task(s) in queue."
        if critical_high
        else "No high or critical priority work in the queue."
    )

    if period_type == "daily":
        return FALLBACK_TEMPLATE_DAILY.format(
            start_date=period.get("from", "N/A"),
            created=tasks.get("created_in_period", 0),
            closed=tasks.get("closed_in_period", 0),
            completion_rate=completion_rate,
            overdue=overdue_count,
            unassigned=tasks.get("unassigned_count", 0),
            stuck_line=stuck_line,
            priority_line=priority_line,
        )

    client_lines = [
        f"- {c['client_name']}: {c['total']} tasks ({c['done']} done)"
        for c in (metrics_data.get("by_client") or [])[:5]
    ]
    client_breakdown = "\n".join(client_lines) if client_lines else "- No data"

    engineer_lines = [
        f"- {e['engineer_name']}: {e['assigned']} assigned ({e['done']} done)"
        for e in (metrics_data.get("by_engineer") or [])[:5]
    ]
    engineer_breakdown = "\n".join(engineer_lines) if engineer_lines else "- No data"

    tag_lines = [
        f"- {t['tag_name']}: {t['count']} tasks"
        for t in (metrics_data.get("by_tag") or [])[:5]
    ]
    tag_breakdown = "\n".join(tag_lines) if tag_lines else "- No data"

    period_type_label = "Weekly summary" if period_type == "weekly" else "Custom-period summary"

    return FALLBACK_TEMPLATE_FULL.format(
        period_type_label=period_type_label,
        start_date=period.get("from", "N/A"),
        end_date=period.get("to", "N/A"),
        created=tasks.get("created_in_period", 0),
        closed=tasks.get("closed_in_period", 0),
        overdue=overdue_count,
        unassigned=tasks.get("unassigned_count", 0),
        completion_rate=completion_rate,
        lead_time_line=_fmt_duration(tasks.get("lead_time")),
        cycle_time_line=_fmt_duration(tasks.get("cycle_time")),
        client_breakdown=client_breakdown,
        engineer_breakdown=engineer_breakdown,
        tag_breakdown=tag_breakdown,
        overdue_warning=overdue_warning,
        stuck_warning=stuck_warning,
    )


def collect_metrics(period_start, period_end, organization=None):
    """Collect task metrics for a given date range using the existing reports service."""
    return get_report_data(
        date_from=str(period_start),
        date_to=str(period_end),
        organization=organization,
    )


def _build_user_prompt(period_type, period_start, period_end, metrics_data, prev_metrics=None):
    """Build the appropriate user prompt for the period type using Markdown rendering."""
    metrics_markdown = render_metrics_as_markdown(metrics_data)

    if period_type == "daily":
        return DAILY_USER_PROMPT.format(
            period_start=period_start,
            metrics_markdown=metrics_markdown,
        )
    elif period_type == "weekly":
        if prev_metrics:
            deltas = compute_deltas(metrics_data, prev_metrics)
            trend_section = WEEKLY_TREND_SECTION.format(
                deltas_markdown=render_deltas_as_markdown(deltas),
            )
        else:
            trend_section = WEEKLY_NO_TREND_SECTION
        return WEEKLY_USER_PROMPT.format(
            period_start=period_start,
            period_end=period_end,
            metrics_markdown=metrics_markdown,
            trend_section=trend_section,
        )
    else:
        return ON_DEMAND_USER_PROMPT.format(
            period_start=period_start,
            period_end=period_end,
            metrics_markdown=metrics_markdown,
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

    ctx = {
        "event_type": "summary_ready",
        "entity_type": "summary",
        "title": f"{summary.get_period_type_display()} summary",
        "period": period_desc,
    }

    managers = User.objects.filter(role=User.Role.MANAGER, is_active=True, organization=summary.organization)
    for manager in managers:
        create_notification(
            recipient=manager,
            event_type="summary_ready",
            task=None,
            message=message,
            related_object_id=summary.id,
            telegram_context=ctx,
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

    metrics_data = collect_metrics(summary.period_start, summary.period_end, organization=summary.organization)
    summary.raw_data = metrics_data
    summary.save(update_fields=["raw_data"])

    user_prompt = _build_user_prompt(
        summary.period_type, summary.period_start, summary.period_end,
        metrics_data, prev_metrics,
    )
    summary.prompt_text = user_prompt
    summary.save(update_fields=["prompt_text"])

    temperature = DAILY_TEMPERATURE if summary.period_type == ReportSummary.PeriodType.DAILY else None

    start_time = time.monotonic()
    try:
        text, model, prompt_tokens, completion_tokens = call_llm(
            SYSTEM_PROMPT, user_prompt, temperature=temperature,
        )
        elapsed_ms = int((time.monotonic() - start_time) * 1000)

        sections = parse_sections(text)

        summary.summary_text = text
        summary.sections = sections
        summary.generation_method = ReportSummary.GenerationMethod.AI
        summary.status = ReportSummary.Status.COMPLETED
        summary.llm_model = model
        summary.prompt_tokens = prompt_tokens
        summary.completion_tokens = completion_tokens
        summary.generation_time_ms = elapsed_ms
        summary.save(update_fields=[
            "summary_text", "sections", "generation_method", "status",
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
        sections = parse_sections(fallback_text)

        summary.summary_text = fallback_text
        summary.sections = sections
        summary.generation_method = ReportSummary.GenerationMethod.FALLBACK
        summary.status = ReportSummary.Status.COMPLETED
        summary.error_message = str(e)
        summary.generation_time_ms = elapsed_ms
        summary.save(update_fields=[
            "summary_text", "sections", "generation_method", "status",
            "error_message", "generation_time_ms",
        ])
        logger.info("Summary completed id=%s method=fallback time_ms=%s", summary.id, elapsed_ms)
        notify_managers_of_summary(summary)

    return summary
