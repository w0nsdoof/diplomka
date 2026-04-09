"""Tests for apps.reports.services.get_report_data — focus on the new period-scoped
breakdowns and cycle/lead time metrics derived from the audit log.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditLogEntry
from apps.reports.services import (
    _percentile,
    _summarize_durations,
    get_report_data,
)
from tests.factories import (
    ClientFactory,
    EngineerFactory,
    ManagerFactory,
    OrganizationFactory,
    TaskFactory,
)


def _local_noon():
    """A timezone-aware "now" pinned to local noon today.

    Tests that pass date-only strings to get_report_data() rely on the string
    being interpreted as a local-day boundary. Pinning to noon guarantees that
    the corresponding UTC timestamp falls comfortably inside the local day in
    any reasonable project timezone (which is Asia/Almaty in this project).
    """
    tz = timezone.get_current_timezone()
    return timezone.now().astimezone(tz).replace(hour=12, minute=0, second=0, microsecond=0)


@pytest.fixture
def org():
    return OrganizationFactory()


@pytest.fixture
def manager(org):
    return ManagerFactory(organization=org)


def _make_status_change(task, new_value, when):
    """Create an audit-log entry and force-set its timestamp (auto_now_add bypasses kwargs)."""
    entry = AuditLogEntry.objects.create(
        task=task,
        action=AuditLogEntry.Action.STATUS_CHANGE,
        old_value="",
        new_value=new_value,
    )
    AuditLogEntry.objects.filter(pk=entry.pk).update(timestamp=when)
    entry.refresh_from_db()
    return entry


class TestPercentile:
    def test_single_value(self):
        assert _percentile([5.0], 50) == 5.0

    def test_median_of_three(self):
        assert _percentile([1.0, 2.0, 3.0], 50) == 2.0

    def test_p90_of_ten(self):
        # 10 values 1..10, p90 should be 9.1 with linear interpolation
        result = _percentile([float(i) for i in range(1, 11)], 90)
        assert result == pytest.approx(9.1, abs=0.01)

    def test_empty(self):
        assert _percentile([], 50) is None


class TestSummarizeDurations:
    def test_returns_zero_for_empty(self):
        s = _summarize_durations([])
        assert s["count"] == 0
        assert s["avg_hours"] is None

    def test_summary_structure(self):
        s = _summarize_durations([2.0, 4.0, 6.0, 8.0, 10.0])
        assert s["count"] == 5
        assert s["avg_hours"] == 6.0
        assert s["median_hours"] == 6.0
        # k = (5-1)*0.9 = 3.6 → 8 + (10-8)*0.6 = 9.2
        assert s["p90_hours"] == pytest.approx(9.2, abs=0.05)


@pytest.mark.django_db
class TestPeriodScopedBreakdowns:
    """Regression tests for the bug where by_engineer/by_client/by_tag used the
    all-time queryset even when a date filter was given."""

    def test_by_engineer_only_includes_period_tasks(self, org, manager):
        eng_a = EngineerFactory(organization=org)
        eng_b = EngineerFactory(organization=org)

        now = _local_noon()
        old_task = TaskFactory(created_by=manager, organization=org, assignees=[eng_a])
        # Force the old task to look like it was created two months ago
        old_date = now - timedelta(days=60)
        type(old_task).objects.filter(pk=old_task.pk).update(created_at=old_date)

        TaskFactory(created_by=manager, organization=org, assignees=[eng_b])

        date_from = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        date_to = now.strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)

        engineer_names = {e["engineer_name"] for e in data["by_engineer"]}
        assert eng_b.first_name in " ".join(engineer_names) or any(
            eng_b.first_name in n for n in engineer_names
        )
        # The old engineer's task should NOT count toward this period's breakdown.
        assert all(eng_a.first_name not in n for n in engineer_names)

    def test_by_client_period_scoped(self, org, manager):
        client_old = ClientFactory(organization=org)
        client_new = ClientFactory(organization=org)

        now = _local_noon()
        old = TaskFactory(created_by=manager, organization=org, client=client_old)
        type(old).objects.filter(pk=old.pk).update(created_at=now - timedelta(days=60))

        TaskFactory(created_by=manager, organization=org, client=client_new)

        date_from = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        date_to = now.strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)
        client_names = {c["client_name"] for c in data["by_client"]}
        assert client_new.name in client_names
        assert client_old.name not in client_names


@pytest.mark.django_db
class TestCycleAndLeadTime:
    def test_lead_time_computed_from_audit_log(self, org, manager):
        now = _local_noon()
        task = TaskFactory(
            created_by=manager, organization=org, status="done",
        )
        # Pin task creation to "5 hours ago" so the lead time is deterministic.
        type(task).objects.filter(pk=task.pk).update(created_at=now - timedelta(hours=5))
        _make_status_change(task, "done", now)

        # Pass strings exactly the way collect_metrics() does in production —
        # this is what the daily-summary celery task hits.
        date_from = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        date_to = now.strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)
        lt = data["tasks"]["lead_time"]
        assert lt["count"] == 1, f"got count={lt['count']}, full lt={lt}"
        assert lt["avg_hours"] == pytest.approx(5.0, abs=0.1)
        assert lt["median_hours"] == pytest.approx(5.0, abs=0.1)

    def test_cycle_time_uses_in_progress_to_done(self, org, manager):
        now = _local_noon()
        task = TaskFactory(
            created_by=manager, organization=org, status="done",
        )
        type(task).objects.filter(pk=task.pk).update(created_at=now - timedelta(hours=10))
        # In-progress 3 hours before done.
        _make_status_change(task, "in_progress", now - timedelta(hours=3))
        _make_status_change(task, "done", now)

        date_from = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        date_to = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)
        ct = data["tasks"]["cycle_time"]
        assert ct["count"] == 1
        assert ct["median_hours"] == pytest.approx(3.0, abs=0.1)

        # Lead time should still be ~10h
        assert data["tasks"]["lead_time"]["median_hours"] == pytest.approx(10.0, abs=0.1)

    def test_cycle_time_zero_when_no_in_progress_event(self, org, manager):
        """A task can be marked done without ever passing through in_progress; cycle_time should be 0/N/A."""
        now = _local_noon()
        task = TaskFactory(created_by=manager, organization=org, status="done")
        type(task).objects.filter(pk=task.pk).update(created_at=now - timedelta(hours=2))
        _make_status_change(task, "done", now)

        date_from = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        date_to = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)
        # Lead time is computed
        assert data["tasks"]["lead_time"]["count"] == 1
        # Cycle time has no in_progress event to anchor to → count 0
        assert data["tasks"]["cycle_time"]["count"] == 0
        assert data["tasks"]["cycle_time"]["median_hours"] is None


@pytest.mark.django_db
class TestStuckWaitingSample:
    def test_stuck_waiting_returns_count_and_sample_with_hours(self, org, manager):
        # Use real wall-clock time so the waiting_hours computation in
        # services.py (which calls timezone.now() itself) matches.
        real_now = timezone.now()
        task = TaskFactory(
            created_by=manager, organization=org, status="waiting", title="Refactor billing",
            priority="high",
        )
        # Mark it as having entered "waiting" 4 days ago.
        _make_status_change(task, "waiting", real_now - timedelta(days=4))

        data = get_report_data(organization=org)
        stuck = data["tasks"]["stuck_waiting"]
        assert stuck["count"] == 1
        assert stuck["sample"][0]["title"] == "Refactor billing"
        assert stuck["sample"][0]["priority"] == "high"
        # ~96h ± a few seconds of test runtime drift
        assert 95 <= stuck["sample"][0]["waiting_hours"] <= 97

    def test_stuck_waiting_excludes_recent_waiting(self, org, manager):
        now = _local_noon()
        task = TaskFactory(created_by=manager, organization=org, status="waiting")
        _make_status_change(task, "waiting", now - timedelta(hours=2))  # < 3 days

        data = get_report_data(organization=org)
        assert data["tasks"]["stuck_waiting"]["count"] == 0
        assert data["tasks"]["stuck_waiting"]["sample"] == []


@pytest.mark.django_db
class TestApproachingDeadline:
    def test_approaching_deadline_returns_tasks_due_in_48h(self, org, manager):
        now = timezone.now()
        TaskFactory(
            created_by=manager, organization=org, status="created",
            title="Almost due", priority="high",
            deadline=now + timedelta(hours=12),
        )
        # Task due in 3 days — should NOT appear
        TaskFactory(
            created_by=manager, organization=org, status="created",
            deadline=now + timedelta(days=3),
        )
        # Done task due soon — should NOT appear
        TaskFactory(
            created_by=manager, organization=org, status="done",
            deadline=now + timedelta(hours=6),
        )

        data = get_report_data(organization=org)
        approaching = data["tasks"]["approaching_deadline"]
        assert len(approaching) == 1
        assert approaching[0]["title"] == "Almost due"
        assert approaching[0]["priority"] == "high"
        assert 11 <= approaching[0]["hours_remaining"] <= 13

    def test_approaching_deadline_empty_when_no_upcoming(self, org, manager):
        TaskFactory(
            created_by=manager, organization=org, status="created",
            deadline=timezone.now() + timedelta(days=5),
        )
        data = get_report_data(organization=org)
        assert data["tasks"]["approaching_deadline"] == []


@pytest.mark.django_db
class TestOverdueBreakdown:
    def test_new_vs_inherited_overdue(self, org, manager):
        now = timezone.now()
        # Overdue task whose deadline passed during the period (new overdue)
        TaskFactory(
            created_by=manager, organization=org, status="created",
            deadline=now - timedelta(hours=6),
        )
        # Overdue task whose deadline passed before the period (inherited)
        TaskFactory(
            created_by=manager, organization=org, status="in_progress",
            deadline=now - timedelta(days=30),
        )

        date_from = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        date_to = now.strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)
        assert data["tasks"]["overdue"] == 2
        assert data["tasks"]["overdue_new"] == 1
        assert data["tasks"]["overdue_inherited"] == 1

    def test_overdue_breakdown_is_none_without_period(self, org, manager):
        TaskFactory(
            created_by=manager, organization=org, status="created",
            deadline=timezone.now() - timedelta(days=1),
        )
        data = get_report_data(organization=org)
        assert data["tasks"]["overdue_new"] is None
        assert data["tasks"]["overdue_inherited"] is None


@pytest.mark.django_db
class TestStatusTransitions:
    def test_status_transitions_counted_in_period(self, org, manager):
        now = _local_noon()
        task = TaskFactory(created_by=manager, organization=org, status="done")

        _make_status_change(task, "in_progress", now - timedelta(hours=5))
        _make_status_change(task, "done", now - timedelta(hours=1))

        date_from = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        date_to = now.strftime("%Y-%m-%d")

        data = get_report_data(date_from=date_from, date_to=date_to, organization=org)
        transitions = data["tasks"]["status_transitions"]
        transition_map = {(t["from"], t["to"]): t["count"] for t in transitions}
        assert transition_map.get(("", "in_progress"), 0) == 1
        assert transition_map.get(("", "done"), 0) == 1

    def test_status_transitions_empty_without_period(self, org, manager):
        data = get_report_data(organization=org)
        assert data["tasks"]["status_transitions"] == []
