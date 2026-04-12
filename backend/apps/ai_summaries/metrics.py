"""Prometheus metrics for AI summary generation.

Metrics are updated after each summary completes. The Grafana "Application"
dashboard queries these counters/gauges directly.
"""

from prometheus_client import Counter, Gauge

# Total summaries completed, labelled by period_type, generation_method, status.
ai_summaries_total = Counter(
    "ai_summaries_total",
    "Total AI summaries generated",
    ["period_type", "generation_method", "status"],
)

# Summaries completed in the last 24 hours (set by a periodic or post-generation update).
ai_summaries_last_24h = Gauge(
    "ai_summaries_last_24h",
    "AI summaries generated in the last 24 hours",
)

# Rolling average generation time in seconds.
ai_avg_generation_time = Gauge(
    "ai_avg_generation_time_seconds",
    "Average AI summary generation time in seconds",
)

# Token usage counters, labelled by token_type (prompt / completion).
ai_tokens_used_total = Counter(
    "ai_tokens_used_total",
    "Total LLM tokens used",
    ["token_type"],
)


def record_summary_completed(summary):
    """Call after a summary finishes (AI or fallback) to update all metrics."""
    from datetime import timedelta

    from django.utils import timezone

    from .models import ReportSummary

    ai_summaries_total.labels(
        period_type=summary.period_type,
        generation_method=summary.generation_method,
        status=summary.status,
    ).inc()

    if summary.prompt_tokens:
        ai_tokens_used_total.labels(token_type="prompt").inc(summary.prompt_tokens)
    if summary.completion_tokens:
        ai_tokens_used_total.labels(token_type="completion").inc(summary.completion_tokens)

    # Update the last-24h gauge
    last_24h_count = ReportSummary.objects.filter(
        status=ReportSummary.Status.COMPLETED,
        generated_at__gte=timezone.now() - timedelta(hours=24),
    ).count()
    ai_summaries_last_24h.set(last_24h_count)

    # Update rolling average generation time
    completed = ReportSummary.objects.filter(
        status=ReportSummary.Status.COMPLETED,
        generation_time_ms__isnull=False,
    )
    from django.db.models import Avg
    avg_ms = completed.aggregate(avg=Avg("generation_time_ms"))["avg"]
    if avg_ms is not None:
        ai_avg_generation_time.set(avg_ms / 1000.0)
