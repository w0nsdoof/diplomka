import logging
from datetime import date, timedelta

from celery import shared_task
from django.conf import settings
from redis import Redis

logger = logging.getLogger(__name__)

LOCK_TTL = 300  # 5 minutes


def _get_redis():
    return Redis.from_url(settings.CELERY_BROKER_URL)


@shared_task
def generate_daily_summary():
    """Generate yesterday's daily summary. Skips if already exists."""
    from apps.ai_summaries.models import ReportSummary

    yesterday = date.today() - timedelta(days=1)
    existing = ReportSummary.objects.filter(
        period_type=ReportSummary.PeriodType.DAILY,
        period_start=yesterday,
        period_end=yesterday,
        status=ReportSummary.Status.COMPLETED,
    ).exists()
    if existing:
        logger.info("Daily summary for %s already exists, skipping", yesterday)
        return None

    result = generate_summary.delay(
        "daily", str(yesterday), str(yesterday),
    )
    logger.info("Dispatched daily summary for %s, task_id=%s", yesterday, result.id)
    return result.id


@shared_task
def generate_weekly_summary():
    """Generate previous Mon-Sun weekly summary. Includes trend data if prior week exists."""
    from apps.ai_summaries.models import ReportSummary
    from apps.ai_summaries.services import collect_metrics

    today = date.today()
    days_since_monday = today.weekday()
    last_monday = today - timedelta(days=days_since_monday + 7)
    last_sunday = last_monday + timedelta(days=6)

    existing = ReportSummary.objects.filter(
        period_type=ReportSummary.PeriodType.WEEKLY,
        period_start=last_monday,
        period_end=last_sunday,
        status=ReportSummary.Status.COMPLETED,
    ).exists()
    if existing:
        logger.info("Weekly summary for %s-%s already exists, skipping", last_monday, last_sunday)
        return None

    prev_monday = last_monday - timedelta(days=7)
    prev_sunday = prev_monday + timedelta(days=6)
    prev_metrics = None
    try:
        prev_metrics = collect_metrics(prev_monday, prev_sunday)
    except Exception:
        logger.info("Could not collect previous week metrics for trend comparison")

    result = generate_summary.delay(
        "weekly", str(last_monday), str(last_sunday),
        prev_metrics=prev_metrics,
    )
    logger.info("Dispatched weekly summary for %s-%s, task_id=%s", last_monday, last_sunday, result.id)
    return result.id


@shared_task
def generate_summary(period_type, period_start, period_end, requested_by_id=None,
                     prev_metrics=None, summary_id=None):
    """Core shared task: acquire lock, create or use existing ReportSummary, generate content.

    If summary_id is provided, use the existing row (created by view).
    Otherwise, create a new row (used by scheduled tasks).
    """
    from apps.ai_summaries.models import ReportSummary
    from apps.ai_summaries.services import generate_summary_for_period

    lock_key = f"summary:{period_type}:{period_start}:{period_end}"
    redis = _get_redis()
    lock = redis.lock(lock_key, timeout=LOCK_TTL)

    if not lock.acquire(blocking=False):
        logger.info("Lock contention for %s, skipping", lock_key)
        return None

    try:
        if summary_id:
            # Use existing summary row (created by the API view)
            try:
                summary = ReportSummary.objects.get(pk=summary_id)
            except ReportSummary.DoesNotExist:
                logger.warning("Summary id=%s not found, skipping", summary_id)
                return None
        else:
            # Create new row (used by scheduled tasks)
            requested_by = None
            if requested_by_id:
                from apps.accounts.models import User
                requested_by = User.objects.filter(pk=requested_by_id).first()

            summary = ReportSummary.objects.create(
                period_type=period_type,
                period_start=period_start,
                period_end=period_end,
                status=ReportSummary.Status.PENDING,
                requested_by=requested_by,
            )
            logger.info("Created ReportSummary id=%s for %s", summary.id, lock_key)

        generate_summary_for_period(summary.id, prev_metrics=prev_metrics)
        return summary.id
    finally:
        try:
            lock.release()
        except Exception:
            pass
