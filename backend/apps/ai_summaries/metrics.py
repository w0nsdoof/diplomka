"""Prometheus metrics for AI summary generation.

Uses a custom collector that queries the database on each scrape, so metrics
are accurate regardless of which process (web vs Celery worker) did the work.
"""

import logging

from prometheus_client.core import GaugeMetricFamily, REGISTRY

logger = logging.getLogger(__name__)


class AISummaryCollector:
    """Custom collector that reads AI summary stats from the DB on each scrape."""

    def collect(self):
        try:
            from datetime import timedelta

            from django.db.models import Avg, Count, Sum
            from django.utils import timezone

            from .models import ReportSummary
        except Exception:
            return

        qs = ReportSummary.objects.all()

        # --- ai_summaries_total (by period_type, generation_method, status) ---
        total = GaugeMetricFamily(
            "ai_summaries_total",
            "Total AI summaries generated",
            labels=["period_type", "generation_method", "status"],
        )
        rows = (
            qs.values("period_type", "generation_method", "status")
            .annotate(cnt=Count("id"))
            .order_by()
        )
        for row in rows:
            total.add_metric(
                [row["period_type"], row["generation_method"], row["status"]],
                row["cnt"],
            )
        yield total

        # --- ai_summaries_last_24h ---
        last_24h = GaugeMetricFamily(
            "ai_summaries_last_24h",
            "AI summaries generated in the last 24 hours",
        )
        count_24h = qs.filter(
            status=ReportSummary.Status.COMPLETED,
            generated_at__gte=timezone.now() - timedelta(hours=24),
        ).count()
        last_24h.add_metric([], count_24h)
        yield last_24h

        # --- ai_avg_generation_time_seconds ---
        avg_time = GaugeMetricFamily(
            "ai_avg_generation_time_seconds",
            "Average AI summary generation time in seconds",
        )
        avg_ms = qs.filter(
            status=ReportSummary.Status.COMPLETED,
            generation_time_ms__isnull=False,
        ).aggregate(avg=Avg("generation_time_ms"))["avg"]
        avg_time.add_metric([], (avg_ms / 1000.0) if avg_ms else 0)
        yield avg_time

        # --- ai_tokens_used_total (by token_type) ---
        tokens = GaugeMetricFamily(
            "ai_tokens_used_total",
            "Total LLM tokens used",
            labels=["token_type"],
        )
        sums = qs.aggregate(
            prompt=Sum("prompt_tokens"),
            completion=Sum("completion_tokens"),
        )
        tokens.add_metric(["prompt"], sums["prompt"] or 0)
        tokens.add_metric(["completion"], sums["completion"] or 0)
        yield tokens


# Register the collector once at import time.
try:
    REGISTRY.register(AISummaryCollector())
except Exception:
    pass  # already registered (e.g. during testing or reload)


def record_summary_completed(summary):
    """No-op kept for backward compatibility.

    Metrics are now computed from the DB on each Prometheus scrape,
    so no in-process bookkeeping is needed.
    """
