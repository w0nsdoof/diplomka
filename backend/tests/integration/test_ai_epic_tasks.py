import json
from unittest.mock import patch

import pytest

from apps.tasks.models import Task
from tests.factories import (
    EngineerFactory,
    EpicFactory,
    ProjectFactory,
    TagFactory,
)

GENERATE_URL = "/api/epics/{id}/generate-tasks/"
STATUS_URL = "/api/epics/{id}/generate-tasks/status/"
CONFIRM_URL = "/api/epics/{id}/confirm-tasks/"

LLM_RESPONSE = json.dumps([
    {
        "title": "Set up database schema",
        "description": "Create tables and indexes.",
        "priority": "high",
        "assignee_id": None,
        "tag_ids": [],
    },
    {
        "title": "Implement REST API endpoints",
        "description": "Build CRUD endpoints.",
        "priority": "medium",
        "assignee_id": None,
        "tag_ids": [],
    },
])


@pytest.fixture
def epic_with_project(manager):
    project = ProjectFactory(organization=manager.organization, created_by=manager)
    epic = EpicFactory(
        organization=manager.organization,
        created_by=manager,
        project=project,
        title="Build Auth Module",
        description="Implement full OAuth2 authentication flow with JWT tokens.",
    )
    return epic


# ---------------------------------------------------------------------------
# POST /api/epics/{id}/generate-tasks/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGenerateTasksEndpoint:
    @patch("apps.projects.views.Redis")
    @patch("apps.projects.tasks.generate_epic_tasks.delay")
    def test_manager_can_trigger_generation(self, mock_delay, mock_redis_cls, manager_client, epic_with_project):
        mock_redis_instance = mock_redis_cls.from_url.return_value
        mock_redis_instance.set.return_value = True  # lock acquired
        mock_delay.return_value.id = "abc-123"

        url = GENERATE_URL.format(id=epic_with_project.id)
        response = manager_client.post(url)

        assert response.status_code == 202
        assert response.data["task_id"] == "abc-123"
        mock_delay.assert_called_once_with(epic_with_project.id, model_override=None)

    def test_engineer_gets_403(self, engineer_client, epic_with_project):
        url = GENERATE_URL.format(id=epic_with_project.id)
        response = engineer_client.post(url)
        assert response.status_code == 403

    @patch("apps.projects.views.Redis")
    def test_empty_description_returns_400(self, mock_redis_cls, manager_client, manager):
        epic = EpicFactory(
            organization=manager.organization,
            created_by=manager,
            title="Title",
            description="",
        )
        url = GENERATE_URL.format(id=epic.id)
        response = manager_client.post(url)
        assert response.status_code == 400
        assert "non-empty title and description" in response.data["detail"]

    @patch("apps.projects.views.Redis")
    def test_locked_epic_returns_409(self, mock_redis_cls, manager_client, epic_with_project):
        mock_redis_instance = mock_redis_cls.from_url.return_value
        mock_redis_instance.set.return_value = False  # lock NOT acquired

        url = GENERATE_URL.format(id=epic_with_project.id)
        response = manager_client.post(url)

        assert response.status_code == 409
        assert response.data["code"] == "generation_in_progress"


# ---------------------------------------------------------------------------
# GET /api/epics/{id}/generate-tasks/status/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGenerateTasksStatusEndpoint:
    @patch("apps.projects.views.AsyncResult")
    def test_completed_status(self, mock_async_result, manager_client, epic_with_project):
        mock_result = mock_async_result.return_value
        mock_result.state = "SUCCESS"
        mock_result.result = {
            "tasks": [{"title": "T1"}],
            "generation_meta": {"model": "test", "prompt_tokens": 100, "completion_tokens": 50, "generation_time_ms": 1000},
        }

        url = STATUS_URL.format(id=epic_with_project.id)
        response = manager_client.get(url, {"task_id": "abc-123"})

        assert response.status_code == 200
        assert response.data["status"] == "completed"
        assert response.data["result"]["tasks"][0]["title"] == "T1"

    @patch("apps.projects.views.AsyncResult")
    def test_pending_status(self, mock_async_result, manager_client, epic_with_project):
        mock_result = mock_async_result.return_value
        mock_result.state = "PENDING"

        url = STATUS_URL.format(id=epic_with_project.id)
        response = manager_client.get(url, {"task_id": "abc-123"})

        assert response.status_code == 200
        assert response.data["status"] == "pending"

    @patch("apps.projects.views.AsyncResult")
    def test_started_maps_to_processing(self, mock_async_result, manager_client, epic_with_project):
        mock_result = mock_async_result.return_value
        mock_result.state = "STARTED"

        url = STATUS_URL.format(id=epic_with_project.id)
        response = manager_client.get(url, {"task_id": "abc-123"})

        assert response.status_code == 200
        assert response.data["status"] == "processing"

    @patch("apps.projects.views.AsyncResult")
    def test_failed_status(self, mock_async_result, manager_client, epic_with_project):
        mock_result = mock_async_result.return_value
        mock_result.state = "FAILURE"
        mock_result.result = Exception("LLM timeout")

        url = STATUS_URL.format(id=epic_with_project.id)
        response = manager_client.get(url, {"task_id": "abc-123"})

        assert response.status_code == 200
        assert response.data["status"] == "failed"
        assert "LLM timeout" in response.data["error"]

    def test_missing_task_id_returns_400(self, manager_client, epic_with_project):
        url = STATUS_URL.format(id=epic_with_project.id)
        response = manager_client.get(url)
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/epics/{id}/confirm-tasks/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestConfirmTasksEndpoint:
    def test_creates_tasks_in_db(self, manager_client, epic_with_project, manager):
        url = CONFIRM_URL.format(id=epic_with_project.id)
        payload = {
            "tasks": [
                {
                    "title": "Task Alpha",
                    "description": "Do alpha things",
                    "priority": "high",
                    "assignee_id": None,
                    "tag_ids": [],
                },
                {
                    "title": "Task Beta",
                    "description": "",
                    "priority": "medium",
                    "assignee_id": None,
                    "tag_ids": [],
                },
            ],
        }
        response = manager_client.post(url, payload, format="json")

        assert response.status_code == 201
        assert response.data["created_count"] == 2
        assert Task.objects.filter(epic=epic_with_project).count() == 2

    def test_assigns_and_notifies(self, manager_client, epic_with_project, manager):
        engineer = EngineerFactory(organization=manager.organization)
        epic_with_project.project.team.add(engineer)

        url = CONFIRM_URL.format(id=epic_with_project.id)
        payload = {
            "tasks": [
                {
                    "title": "Assigned Task",
                    "priority": "high",
                    "assignee_id": engineer.id,
                    "tag_ids": [],
                },
            ],
        }
        response = manager_client.post(url, payload, format="json")

        assert response.status_code == 201
        task = Task.objects.get(title="Assigned Task")
        assert engineer in task.assignees.all()

        # Check notification was created
        from apps.notifications.models import Notification

        notif = Notification.objects.filter(
            recipient=engineer, event_type="task_assigned",
        )
        assert notif.exists()

    def test_sets_tags(self, manager_client, epic_with_project, manager):
        tag = TagFactory(organization=manager.organization)

        url = CONFIRM_URL.format(id=epic_with_project.id)
        payload = {
            "tasks": [
                {
                    "title": "Tagged Task",
                    "priority": "medium",
                    "tag_ids": [tag.id],
                },
            ],
        }
        response = manager_client.post(url, payload, format="json")

        assert response.status_code == 201
        task = Task.objects.get(title="Tagged Task")
        assert tag in task.tags.all()

    def test_empty_list_returns_400(self, manager_client, epic_with_project):
        url = CONFIRM_URL.format(id=epic_with_project.id)
        response = manager_client.post(url, {"tasks": []}, format="json")
        assert response.status_code == 400

    def test_invalid_assignee_silently_dropped(self, manager_client, epic_with_project):
        url = CONFIRM_URL.format(id=epic_with_project.id)
        payload = {
            "tasks": [
                {
                    "title": "Task with bad assignee",
                    "priority": "medium",
                    "assignee_id": 99999,
                    "tag_ids": [],
                },
            ],
        }
        response = manager_client.post(url, payload, format="json")

        assert response.status_code == 201
        task = Task.objects.get(title="Task with bad assignee")
        assert task.assignees.count() == 0

    def test_engineer_gets_403(self, engineer_client, epic_with_project):
        url = CONFIRM_URL.format(id=epic_with_project.id)
        response = engineer_client.post(url, {"tasks": [{"title": "T", "priority": "low"}]}, format="json")
        assert response.status_code == 403
