import pytest

from apps.notifications.models import Notification
from tests.factories import TaskFactory

NOTIFICATIONS_URL = "/api/notifications/"


@pytest.mark.django_db
class TestNotificationList:
    def test_user_sees_own_notifications(self, engineer_client, engineer, manager):
        task = TaskFactory(created_by=manager)
        Notification.objects.create(
            recipient=engineer, event_type="task_assigned", task=task, message="Assigned"
        )
        Notification.objects.create(
            recipient=manager, event_type="task_assigned", task=task, message="Other"
        )
        resp = engineer_client.get(NOTIFICATIONS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filter_unread(self, engineer_client, engineer, manager):
        task = TaskFactory(created_by=manager)
        Notification.objects.create(
            recipient=engineer, event_type="task_assigned", task=task,
            message="Unread", is_read=False,
        )
        Notification.objects.create(
            recipient=engineer, event_type="comment_added", task=task,
            message="Read", is_read=True,
        )
        resp = engineer_client.get(NOTIFICATIONS_URL, {"is_read": "false"})
        assert resp.data["count"] == 1


@pytest.mark.django_db
class TestNotificationMarkRead:
    def test_mark_single_read(self, engineer_client, engineer, manager):
        task = TaskFactory(created_by=manager)
        notif = Notification.objects.create(
            recipient=engineer, event_type="task_assigned", task=task, message="Test"
        )
        resp = engineer_client.patch(f"{NOTIFICATIONS_URL}{notif.id}/read/")
        assert resp.status_code == 200
        assert resp.data["is_read"] is True

    def test_mark_all_read(self, engineer_client, engineer, manager):
        task = TaskFactory(created_by=manager)
        Notification.objects.create(
            recipient=engineer, event_type="task_assigned", task=task, message="1"
        )
        Notification.objects.create(
            recipient=engineer, event_type="comment_added", task=task, message="2"
        )
        resp = engineer_client.post(f"{NOTIFICATIONS_URL}read-all/")
        assert resp.status_code == 200
        assert resp.data["updated_count"] == 2
        assert Notification.objects.filter(recipient=engineer, is_read=False).count() == 0

    def test_cannot_mark_other_users_notification(self, engineer_client, manager):
        task = TaskFactory(created_by=manager)
        notif = Notification.objects.create(
            recipient=manager, event_type="task_assigned", task=task, message="Not mine"
        )
        resp = engineer_client.patch(f"{NOTIFICATIONS_URL}{notif.id}/read/")
        assert resp.status_code == 404
