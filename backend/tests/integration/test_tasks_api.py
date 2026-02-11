import pytest
from django.utils import timezone

from apps.audit.models import AuditLogEntry
from apps.notifications.models import Notification
from apps.tasks.models import Task
from tests.factories import (
    ClientFactory,
    EngineerFactory,
    TagFactory,
    TaskFactory,
)

TASKS_URL = "/api/tasks/"


def task_url(task_id):
    return f"{TASKS_URL}{task_id}/"


@pytest.mark.django_db
class TestTaskList:
    def test_manager_sees_all_tasks(self, manager_client, manager):
        TaskFactory.create_batch(3, created_by=manager)
        resp = manager_client.get(TASKS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 3

    def test_client_sees_only_own_tasks(self, client_user_client, client_user, manager):
        TaskFactory(created_by=manager, client=client_user.client)
        TaskFactory(created_by=manager)  # no client
        resp = client_user_client.get(TASKS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filter_by_status(self, manager_client, manager):
        TaskFactory(created_by=manager, status=Task.Status.CREATED)
        TaskFactory(created_by=manager, status=Task.Status.DONE)
        resp = manager_client.get(TASKS_URL, {"status": "created"})
        assert resp.data["count"] == 1

    def test_filter_by_assignee(self, manager_client, manager):
        eng = EngineerFactory()
        TaskFactory(created_by=manager, assignees=[eng])
        TaskFactory(created_by=manager)
        resp = manager_client.get(TASKS_URL, {"assignee": eng.id})
        assert resp.data["count"] == 1

    def test_filter_by_tags(self, manager_client, manager):
        tag = TagFactory(name="urgent", slug="urgent")
        TaskFactory(created_by=manager, tags=[tag])
        TaskFactory(created_by=manager)
        resp = manager_client.get(TASKS_URL, {"tags": "urgent"})
        assert resp.data["count"] == 1


@pytest.mark.django_db
class TestTaskCreate:
    def test_manager_creates_task(self, manager_client, manager):
        client = ClientFactory()
        tag = TagFactory()
        eng = EngineerFactory()
        data = {
            "title": "New Task",
            "description": "Description",
            "priority": "high",
            "deadline": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "client_id": client.id,
            "assignee_ids": [eng.id],
            "tag_ids": [tag.id],
        }
        resp = manager_client.post(TASKS_URL, data, format="json")
        assert resp.status_code == 201
        task = Task.objects.get(title="New Task")
        assert task.client == client
        assert eng in task.assignees.all()
        assert tag in task.tags.all()

    def test_creates_assignment_notifications(self, manager_client, manager):
        eng = EngineerFactory()
        data = {
            "title": "Notify Test",
            "description": "Desc",
            "priority": "low",
            "deadline": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "assignee_ids": [eng.id],
        }
        manager_client.post(TASKS_URL, data, format="json")
        assert Notification.objects.filter(
            recipient=eng, event_type="task_assigned"
        ).exists()

    def test_engineer_cannot_create_task(self, engineer_client):
        data = {
            "title": "Nope",
            "description": "Desc",
            "priority": "low",
            "deadline": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
        }
        resp = engineer_client.post(TASKS_URL, data, format="json")
        assert resp.status_code == 403

    def test_validates_assignees_are_engineers(self, manager_client, manager):
        data = {
            "title": "Bad Assignee",
            "description": "Desc",
            "priority": "low",
            "deadline": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "assignee_ids": [999],
        }
        resp = manager_client.post(TASKS_URL, data, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestTaskDetail:
    def test_retrieve_task(self, manager_client, task):
        resp = manager_client.get(task_url(task.id))
        assert resp.status_code == 200
        assert resp.data["title"] == task.title
        assert "version" in resp.data


@pytest.mark.django_db
class TestTaskUpdate:
    def test_manager_updates_task(self, manager_client, task):
        resp = manager_client.patch(
            task_url(task.id), {"title": "Updated"}, format="json"
        )
        assert resp.status_code == 200
        task.refresh_from_db()
        assert task.title == "Updated"

    def test_engineer_cannot_update_task(self, engineer_client, task):
        resp = engineer_client.patch(
            task_url(task.id), {"title": "Nope"}, format="json"
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestTaskStatusChange:
    def test_manager_changes_status(self, manager_client, task):
        resp = manager_client.post(
            f"{task_url(task.id)}status/", {"status": "in_progress"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "in_progress"

    def test_engineer_cannot_change_status(self, engineer_client, task):
        # IsManagerOrReadOnly blocks all engineer POST requests at the permission level
        resp = engineer_client.post(
            f"{task_url(task.id)}status/", {"status": "in_progress"}, format="json"
        )
        assert resp.status_code == 403

    def test_invalid_transition_returns_400(self, manager_client, task):
        resp = manager_client.post(
            f"{task_url(task.id)}status/", {"status": "done"}, format="json"
        )
        assert resp.status_code == 400
        assert resp.data["code"] == "invalid_status_transition"

    def test_manager_can_archive_done_task(self, manager_client, manager):
        task = TaskFactory(created_by=manager, status=Task.Status.DONE)
        resp = manager_client.post(
            f"{task_url(task.id)}status/", {"status": "archived"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "archived"


@pytest.mark.django_db
class TestTaskAssign:
    def test_manager_assigns_engineers(self, manager_client, task):
        eng1 = EngineerFactory()
        eng2 = EngineerFactory()
        resp = manager_client.post(
            f"{task_url(task.id)}assign/",
            {"assignee_ids": [eng1.id, eng2.id]},
            format="json",
        )
        assert resp.status_code == 200
        assert len(resp.data["assignees"]) == 2

    def test_assignment_creates_notifications(self, manager_client, task):
        eng = EngineerFactory()
        manager_client.post(
            f"{task_url(task.id)}assign/", {"assignee_ids": [eng.id]}, format="json"
        )
        assert Notification.objects.filter(
            recipient=eng, event_type="task_assigned"
        ).exists()

    def test_unassignment_creates_notifications(self, manager_client, task):
        eng = EngineerFactory()
        task.assignees.add(eng)
        manager_client.post(
            f"{task_url(task.id)}assign/", {"assignee_ids": []}, format="json"
        )
        assert Notification.objects.filter(
            recipient=eng, event_type="task_unassigned"
        ).exists()

    def test_engineer_cannot_assign(self, engineer_client, task):
        resp = engineer_client.post(
            f"{task_url(task.id)}assign/", {"assignee_ids": []}, format="json"
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestTaskHistory:
    def test_manager_sees_history(self, manager_client, task, manager):
        AuditLogEntry.objects.create(
            task=task,
            actor=manager,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="title",
            old_value="Old",
            new_value="New",
        )
        resp = manager_client.get(f"{task_url(task.id)}history/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_engineer_cannot_see_history(self, engineer_client, task):
        resp = engineer_client.get(f"{task_url(task.id)}history/")
        assert resp.status_code == 403
