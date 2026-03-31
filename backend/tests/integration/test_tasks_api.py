import pytest
from django.utils import timezone

from apps.attachments.models import Attachment
from apps.audit.models import AuditLogEntry
from apps.comments.models import Comment
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
        tag = TagFactory(name="urgent")
        TaskFactory(created_by=manager, tags=[tag])
        TaskFactory(created_by=manager)
        resp = manager_client.get(TASKS_URL, {"tags": str(tag.id)})
        assert resp.data["count"] == 1


    def test_archived_tasks_excluded_from_default_list(self, manager_client, manager):
        TaskFactory(created_by=manager, status=Task.Status.CREATED)
        TaskFactory(created_by=manager, status=Task.Status.ARCHIVED)
        resp = manager_client.get(TASKS_URL)
        assert resp.data["count"] == 1

    def test_done_expired_tasks_excluded_from_default_list(self, manager_client, manager):
        TaskFactory(created_by=manager, status=Task.Status.CREATED)
        TaskFactory(
            created_by=manager,
            status=Task.Status.DONE,
            deadline=timezone.now() - timezone.timedelta(days=1),
        )
        resp = manager_client.get(TASKS_URL)
        assert resp.data["count"] == 1

    def test_done_future_deadline_still_visible(self, manager_client, manager):
        TaskFactory(
            created_by=manager,
            status=Task.Status.DONE,
            deadline=timezone.now() + timezone.timedelta(days=1),
        )
        resp = manager_client.get(TASKS_URL)
        assert resp.data["count"] == 1

    def test_filter_by_archived_status_returns_archived(self, manager_client, manager):
        TaskFactory(created_by=manager, status=Task.Status.CREATED)
        TaskFactory(created_by=manager, status=Task.Status.ARCHIVED)
        resp = manager_client.get(TASKS_URL, {"status": "archived"})
        assert resp.data["count"] == 1

    def test_filter_by_archived_includes_done_expired(self, manager_client, manager):
        TaskFactory(created_by=manager, status=Task.Status.CREATED)
        TaskFactory(created_by=manager, status=Task.Status.ARCHIVED)
        TaskFactory(
            created_by=manager,
            status=Task.Status.DONE,
            deadline=timezone.now() - timezone.timedelta(days=1),
        )
        resp = manager_client.get(TASKS_URL, {"status": "archived"})
        assert resp.data["count"] == 2


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

    def test_engineer_creates_task(self, engineer_client):
        tag = TagFactory()
        data = {
            "title": "Engineer Task",
            "description": "Desc",
            "priority": "low",
            "deadline": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "tag_ids": [tag.id],
        }
        resp = engineer_client.post(TASKS_URL, data, format="json")
        assert resp.status_code == 201
        task = Task.objects.get(title="Engineer Task")
        assert tag in task.tags.all()

    def test_engineer_creates_task_without_client_and_assignees(self, engineer_client):
        data = {
            "title": "Simple Engineer Task",
            "description": "Desc",
            "priority": "medium",
            "deadline": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "client_id": 999,
            "assignee_ids": [1],
        }
        resp = engineer_client.post(TASKS_URL, data, format="json")
        assert resp.status_code == 201
        task = Task.objects.get(title="Simple Engineer Task")
        assert task.client is None
        assert task.assignees.count() == 0

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

    def test_engineer_updates_assigned_task(self, engineer_client, engineer, task):
        task.assignees.add(engineer)
        resp = engineer_client.patch(
            task_url(task.id), {"title": "Updated by engineer"}, format="json"
        )
        assert resp.status_code == 200
        task.refresh_from_db()
        assert task.title == "Updated by engineer"

    def test_engineer_cannot_update_unassigned_task(self, engineer_client, task):
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

    def test_engineer_changes_status_assigned_task(self, engineer_client, engineer, task):
        task.assignees.add(engineer)
        resp = engineer_client.post(
            f"{task_url(task.id)}status/", {"status": "in_progress"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "in_progress"

    def test_engineer_cannot_change_status_unassigned_task(self, engineer_client, task):
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

    def test_engineer_sees_history(self, engineer_client, engineer, task):
        AuditLogEntry.objects.create(
            task=task,
            actor=engineer,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="title",
            old_value="Old",
            new_value="New",
        )
        resp = engineer_client.get(f"{task_url(task.id)}history/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1


@pytest.mark.django_db
class TestTaskDelete:
    def test_manager_deletes_task(self, manager_client, task):
        resp = manager_client.delete(task_url(task.id))
        assert resp.status_code == 204
        assert not Task.objects.filter(pk=task.id).exists()

    def test_delete_cascades_attachments(self, manager_client, task, manager):
        Attachment.objects.create(
            task=task,
            file="test.txt",
            original_filename="test.txt",
            file_size=100,
            content_type="text/plain",
            uploaded_by=manager,
        )
        manager_client.delete(task_url(task.id))
        assert Attachment.objects.count() == 0

    def test_delete_cascades_comments(self, manager_client, task, manager):
        Comment.objects.create(task=task, author=manager, content="test")
        manager_client.delete(task_url(task.id))
        assert Comment.objects.count() == 0

    def test_delete_nullifies_subtask_parent(self, manager_client, task, manager):
        subtask = TaskFactory(created_by=manager, parent_task=task)
        manager_client.delete(task_url(task.id))
        subtask.refresh_from_db()
        assert subtask.parent_task is None

    def test_engineer_cannot_delete_task(self, engineer_client, task):
        resp = engineer_client.delete(task_url(task.id))
        assert resp.status_code == 403

    def test_client_cannot_delete_task(self, client_user_client, task):
        resp = client_user_client.delete(task_url(task.id))
        assert resp.status_code == 403
