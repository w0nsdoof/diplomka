import pytest
from django.utils import timezone
from datetime import timedelta

from apps.notifications.models import Notification
from apps.notifications.tasks import check_approaching_deadlines
from tests.factories import EngineerFactory, ManagerFactory, TaskFactory


@pytest.mark.django_db
class TestCheckApproachingDeadlines:
    def test_sends_deadline_warnings(self):
        manager = ManagerFactory()
        eng = EngineerFactory()
        task = TaskFactory(
            created_by=manager,
            deadline=timezone.now() + timedelta(hours=12),
            status="in_progress",
            assignees=[eng],
        )
        result = check_approaching_deadlines()
        assert "2" in result  # 1 for assignee + 1 for created_by

        assert Notification.objects.filter(
            recipient=eng, event_type="deadline_warning", task=task
        ).exists()
        assert Notification.objects.filter(
            recipient=manager, event_type="deadline_warning", task=task
        ).exists()

    def test_does_not_duplicate_within_24h(self):
        manager = ManagerFactory()
        eng = EngineerFactory()
        task = TaskFactory(
            created_by=manager,
            deadline=timezone.now() + timedelta(hours=12),
            status="in_progress",
            assignees=[eng],
        )
        check_approaching_deadlines()
        check_approaching_deadlines()

        count = Notification.objects.filter(
            recipient=eng, event_type="deadline_warning", task=task
        ).count()
        assert count == 1

    def test_ignores_done_tasks(self):
        manager = ManagerFactory()
        TaskFactory(
            created_by=manager,
            deadline=timezone.now() + timedelta(hours=12),
            status="done",
        )
        result = check_approaching_deadlines()
        assert "0" in result

    def test_ignores_far_deadlines(self):
        manager = ManagerFactory()
        eng = EngineerFactory()
        TaskFactory(
            created_by=manager,
            deadline=timezone.now() + timedelta(days=7),
            status="in_progress",
            assignees=[eng],
        )
        result = check_approaching_deadlines()
        assert "0" in result
