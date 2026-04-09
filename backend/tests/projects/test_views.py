import pytest
from django.utils import timezone

from apps.audit.models import AuditLogEntry
from apps.projects.models import Epic, Project
from tests.factories import (
    ClientFactory,
    EngineerFactory,
    TagFactory,
    TaskFactory,
)
from tests.projects.factories import EpicFactory, ProjectFactory

PROJECTS_URL = "/api/projects/"
EPICS_URL = "/api/epics/"


def project_url(project_id):
    return f"{PROJECTS_URL}{project_id}/"


def epic_url(epic_id):
    return f"{EPICS_URL}{epic_id}/"


# ===========================================================================
# ProjectViewSet tests
# ===========================================================================


@pytest.mark.django_db
class TestProjectList:
    def test_returns_paginated_list(self, manager_client, manager):
        ProjectFactory.create_batch(3, created_by=manager)
        resp = manager_client.get(PROJECTS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 3
        assert "results" in resp.data

    def test_filter_by_status(self, manager_client, manager):
        ProjectFactory(created_by=manager, status=Project.Status.CREATED)
        ProjectFactory(created_by=manager, status=Project.Status.DONE)
        resp = manager_client.get(PROJECTS_URL, {"status": "created"})
        assert resp.data["count"] == 1

    def test_search_by_title(self, manager_client, manager):
        ProjectFactory(created_by=manager, title="Alpha Project")
        ProjectFactory(created_by=manager, title="Beta Project")
        resp = manager_client.get(PROJECTS_URL, {"search": "Alpha"})
        assert resp.data["count"] == 1

    def test_anon_gets_401(self, anon_client):
        resp = anon_client.get(PROJECTS_URL)
        assert resp.status_code == 401


@pytest.mark.django_db
class TestProjectCreate:
    def test_manager_can_create(self, manager_client, manager):
        data = {
            "title": "New Project",
            "description": "A project",
            "priority": "high",
            "deadline": (timezone.now() + timezone.timedelta(days=30)).isoformat(),
        }
        resp = manager_client.post(PROJECTS_URL, data, format="json")
        assert resp.status_code == 201
        assert Project.objects.filter(title="New Project").exists()

    def test_engineer_gets_403(self, engineer_client):
        data = {"title": "Forbidden", "description": "Nope"}
        resp = engineer_client.post(PROJECTS_URL, data, format="json")
        assert resp.status_code == 403

    def test_creates_audit_entry(self, manager_client, manager):
        data = {"title": "Audited Project", "priority": "low"}
        resp = manager_client.post(PROJECTS_URL, data, format="json")
        assert resp.status_code == 201
        project = Project.objects.get(title="Audited Project")
        assert AuditLogEntry.objects.filter(project=project).exists()

    def test_with_assignee_and_client(self, manager_client, manager):
        engineer = EngineerFactory(organization=manager.organization)
        client = ClientFactory(organization=manager.organization)
        data = {
            "title": "Full Project",
            "assignee_id": engineer.pk,
            "client_id": client.pk,
        }
        resp = manager_client.post(PROJECTS_URL, data, format="json")
        assert resp.status_code == 201
        project = Project.objects.get(title="Full Project")
        assert project.assignee == engineer
        assert project.client == client

    def test_with_tags(self, manager_client, manager):
        tag = TagFactory(organization=manager.organization)
        data = {"title": "Tagged Project", "tag_ids": [tag.pk]}
        resp = manager_client.post(PROJECTS_URL, data, format="json")
        assert resp.status_code == 201
        project = Project.objects.get(title="Tagged Project")
        assert tag in project.tags.all()


@pytest.mark.django_db
class TestProjectDetail:
    def test_returns_detail(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = manager_client.get(project_url(project.pk))
        assert resp.status_code == 200
        assert resp.data["title"] == project.title
        assert "version" in resp.data
        assert "description" in resp.data
        assert "created_by" in resp.data

    def test_engineer_can_read(self, engineer_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = engineer_client.get(project_url(project.pk))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestProjectUpdate:
    def test_manager_can_update_with_version(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = manager_client.patch(
            project_url(project.pk),
            {"title": "Updated Title", "version": project.version},
            format="json",
        )
        assert resp.status_code == 200
        project.refresh_from_db()
        assert project.title == "Updated Title"

    def test_engineer_gets_403(self, engineer_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = engineer_client.patch(
            project_url(project.pk),
            {"title": "Nope", "version": project.version},
            format="json",
        )
        assert resp.status_code == 403

    def test_version_increments_on_update(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        original_version = project.version
        resp = manager_client.patch(
            project_url(project.pk),
            {"title": "Version Check", "version": project.version},
            format="json",
        )
        assert resp.status_code == 200
        project.refresh_from_db()
        assert project.version == original_version + 1


@pytest.mark.django_db
class TestProjectDelete:
    def test_manager_can_delete(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = manager_client.delete(project_url(project.pk))
        assert resp.status_code == 204
        assert not Project.objects.filter(pk=project.pk).exists()

    def test_engineer_gets_403(self, engineer_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = engineer_client.delete(project_url(project.pk))
        assert resp.status_code == 403


@pytest.mark.django_db
class TestProjectStatusChange:
    def test_manager_can_change_status(self, manager_client, manager):
        project = ProjectFactory(created_by=manager, status=Project.Status.CREATED)
        resp = manager_client.post(
            f"{project_url(project.pk)}status/",
            {"status": "in_progress"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "in_progress"

    def test_engineer_gets_403(self, engineer_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = engineer_client.post(
            f"{project_url(project.pk)}status/",
            {"status": "in_progress"},
            format="json",
        )
        assert resp.status_code == 403

    def test_creates_audit_entry(self, manager_client, manager):
        project = ProjectFactory(created_by=manager, status=Project.Status.CREATED)
        manager_client.post(
            f"{project_url(project.pk)}status/",
            {"status": "in_progress"},
            format="json",
        )
        assert AuditLogEntry.objects.filter(
            project=project,
            action=AuditLogEntry.Action.STATUS_CHANGE,
        ).exists()


@pytest.mark.django_db
class TestProjectEpics:
    def test_returns_child_epics(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        EpicFactory(created_by=manager, project=project, organization=manager.organization)
        EpicFactory(created_by=manager, project=project, organization=manager.organization)
        # Epic in a different project should not appear
        EpicFactory(created_by=manager, organization=manager.organization)

        resp = manager_client.get(f"{project_url(project.pk)}epics/")
        assert resp.status_code == 200
        assert resp.data["count"] == 2

    def test_empty_epics(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        resp = manager_client.get(f"{project_url(project.pk)}epics/")
        assert resp.status_code == 200
        assert resp.data["count"] == 0

    def test_epic_includes_enriched_fields(self, manager_client, manager):
        """Each epic includes display_status, task_stats, team, and nested tasks with subtasks."""
        project = ProjectFactory(created_by=manager)
        engineer = EngineerFactory(organization=manager.organization, job_title="Backend Dev")
        epic = EpicFactory(created_by=manager, project=project, organization=manager.organization)

        # Create tasks: 1 done, 1 in_progress, 1 created — all top-level
        t1 = TaskFactory(created_by=manager, epic=epic, organization=manager.organization, status="done", assignees=[engineer])
        t2 = TaskFactory(created_by=manager, epic=epic, organization=manager.organization, status="in_progress", assignees=[manager])
        TaskFactory(created_by=manager, epic=epic, organization=manager.organization, status="created")
        # Subtask under t1
        TaskFactory(created_by=manager, epic=epic, parent_task=t1, organization=manager.organization, status="done", assignees=[engineer])

        resp = manager_client.get(f"{project_url(project.pk)}epics/")
        assert resp.status_code == 200
        epic_data = resp.data["results"][0]

        # display_status
        assert epic_data["display_status"] == "active"

        # task_stats (only top-level tasks)
        stats = epic_data["task_stats"]
        assert stats["completed"] == 1
        assert stats["in_progress"] == 1
        assert stats["not_started"] == 1
        assert stats["total"] == 3

        # team — distinct assignees from all tasks (including subtasks)
        team_ids = {m["id"] for m in epic_data["team"]}
        assert engineer.pk in team_ids
        assert manager.pk in team_ids

        # team member has first_name and job_title
        eng_entry = next(m for m in epic_data["team"] if m["id"] == engineer.pk)
        assert eng_entry["first_name"] == engineer.first_name
        assert eng_entry["job_title"] == "Backend Dev"

        # tasks array — top-level only, with subtasks nested
        tasks = epic_data["tasks"]
        assert len(tasks) == 3  # 3 top-level tasks
        done_task = next(t for t in tasks if t["id"] == t1.pk)
        assert len(done_task["subtasks"]) == 1

    def test_completed_epic_display_status(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        EpicFactory(created_by=manager, project=project, organization=manager.organization, status="done")
        resp = manager_client.get(f"{project_url(project.pk)}epics/")
        assert resp.data["results"][0]["display_status"] == "completed"

    def test_epic_no_tasks_gives_empty_stats(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        EpicFactory(created_by=manager, project=project, organization=manager.organization)
        resp = manager_client.get(f"{project_url(project.pk)}epics/")
        epic_data = resp.data["results"][0]
        assert epic_data["task_stats"] == {"not_started": 0, "in_progress": 0, "completed": 0, "total": 0}
        assert epic_data["team"] == []
        assert epic_data["tasks"] == []


@pytest.mark.django_db
class TestProjectHistory:
    def test_returns_audit_history(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        AuditLogEntry.objects.create(
            project=project,
            actor=manager,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="title",
            old_value="Old",
            new_value="New",
        )
        resp = manager_client.get(f"{project_url(project.pk)}history/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_engineer_can_view_history(self, engineer_client, manager):
        project = ProjectFactory(created_by=manager)
        AuditLogEntry.objects.create(
            project=project,
            actor=manager,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="status",
            old_value="created",
            new_value="in_progress",
        )
        resp = engineer_client.get(f"{project_url(project.pk)}history/")
        assert resp.status_code == 200


# ===========================================================================
# EpicViewSet tests
# ===========================================================================


@pytest.mark.django_db
class TestEpicList:
    def test_returns_paginated_list(self, manager_client, manager):
        EpicFactory.create_batch(3, created_by=manager)
        resp = manager_client.get(EPICS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 3
        assert "results" in resp.data

    def test_filter_by_status(self, manager_client, manager):
        EpicFactory(created_by=manager, status=Epic.Status.CREATED)
        EpicFactory(created_by=manager, status=Epic.Status.DONE)
        resp = manager_client.get(EPICS_URL, {"status": "done"})
        assert resp.data["count"] == 1

    def test_standalone_filter(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        EpicFactory(created_by=manager, project=project, organization=manager.organization)
        EpicFactory(created_by=manager, project=None, organization=manager.organization)
        resp = manager_client.get(EPICS_URL, {"standalone": "true"})
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["project"] is None

    def test_search_by_title(self, manager_client, manager):
        EpicFactory(created_by=manager, title="Auth Epic")
        EpicFactory(created_by=manager, title="Payment Epic")
        resp = manager_client.get(EPICS_URL, {"search": "Auth"})
        assert resp.data["count"] == 1


@pytest.mark.django_db
class TestEpicCreate:
    def test_manager_can_create(self, manager_client, manager):
        data = {
            "title": "New Epic",
            "description": "An epic",
            "priority": "medium",
        }
        resp = manager_client.post(EPICS_URL, data, format="json")
        assert resp.status_code == 201
        assert Epic.objects.filter(title="New Epic").exists()

    def test_manager_can_create_with_project(self, manager_client, manager):
        project = ProjectFactory(created_by=manager)
        data = {
            "title": "Linked Epic",
            "project_id": project.pk,
        }
        resp = manager_client.post(EPICS_URL, data, format="json")
        assert resp.status_code == 201
        epic = Epic.objects.get(title="Linked Epic")
        assert epic.project == project

    def test_engineer_can_create_limited_fields(self, engineer_client, engineer):
        data = {
            "title": "Engineer Epic",
            "description": "By engineer",
            "priority": "low",
        }
        resp = engineer_client.post(EPICS_URL, data, format="json")
        assert resp.status_code == 201
        epic = Epic.objects.get(title="Engineer Epic")
        assert epic.created_by == engineer
        # Engineer cannot set assignee or client
        assert epic.assignee is None
        assert epic.client is None

    def test_engineer_cannot_set_assignee(self, engineer_client, engineer):
        other_engineer = EngineerFactory(organization=engineer.organization)
        data = {
            "title": "Attempt Assignee",
            "assignee_id": other_engineer.pk,
        }
        resp = engineer_client.post(EPICS_URL, data, format="json")
        assert resp.status_code == 201
        epic = Epic.objects.get(title="Attempt Assignee")
        # assignee_id is ignored for engineers
        assert epic.assignee is None

    def test_creates_audit_entry(self, manager_client, manager):
        data = {"title": "Audited Epic", "priority": "high"}
        resp = manager_client.post(EPICS_URL, data, format="json")
        assert resp.status_code == 201
        epic = Epic.objects.get(title="Audited Epic")
        assert AuditLogEntry.objects.filter(epic=epic).exists()


@pytest.mark.django_db
class TestEpicDetail:
    def test_returns_detail(self, manager_client, manager):
        epic = EpicFactory(created_by=manager)
        resp = manager_client.get(epic_url(epic.pk))
        assert resp.status_code == 200
        assert resp.data["title"] == epic.title
        assert "version" in resp.data
        assert "description" in resp.data
        assert "created_by" in resp.data
        assert "project" in resp.data

    def test_engineer_can_read(self, engineer_client, manager):
        epic = EpicFactory(created_by=manager)
        resp = engineer_client.get(epic_url(epic.pk))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestEpicUpdate:
    def test_manager_can_update(self, manager_client, manager):
        epic = EpicFactory(created_by=manager)
        resp = manager_client.patch(
            epic_url(epic.pk),
            {"title": "Updated Epic", "version": epic.version},
            format="json",
        )
        assert resp.status_code == 200
        epic.refresh_from_db()
        assert epic.title == "Updated Epic"

    def test_engineer_gets_403_on_unassigned(self, engineer_client, engineer, manager):
        epic = EpicFactory(created_by=manager)
        resp = engineer_client.patch(
            epic_url(epic.pk),
            {"title": "Nope", "version": epic.version},
            format="json",
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestEpicDelete:
    def test_manager_can_delete(self, manager_client, manager):
        epic = EpicFactory(created_by=manager)
        resp = manager_client.delete(epic_url(epic.pk))
        assert resp.status_code == 204
        assert not Epic.objects.filter(pk=epic.pk).exists()

    def test_engineer_gets_403(self, engineer_client, manager):
        epic = EpicFactory(created_by=manager)
        resp = engineer_client.delete(epic_url(epic.pk))
        assert resp.status_code == 403


@pytest.mark.django_db
class TestEpicStatusChange:
    def test_manager_can_change_status(self, manager_client, manager):
        epic = EpicFactory(created_by=manager, status=Epic.Status.CREATED)
        resp = manager_client.post(
            f"{epic_url(epic.pk)}status/",
            {"status": "in_progress"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "in_progress"

    def test_engineer_gets_403(self, engineer_client, manager):
        epic = EpicFactory(created_by=manager)
        resp = engineer_client.post(
            f"{epic_url(epic.pk)}status/",
            {"status": "in_progress"},
            format="json",
        )
        assert resp.status_code == 403

    def test_creates_audit_entry(self, manager_client, manager):
        epic = EpicFactory(created_by=manager, status=Epic.Status.CREATED)
        manager_client.post(
            f"{epic_url(epic.pk)}status/",
            {"status": "done"},
            format="json",
        )
        assert AuditLogEntry.objects.filter(
            epic=epic,
            action=AuditLogEntry.Action.STATUS_CHANGE,
        ).exists()


@pytest.mark.django_db
class TestEpicTasks:
    def test_returns_child_tasks(self, manager_client, manager):
        epic = EpicFactory(created_by=manager, organization=manager.organization)
        TaskFactory(created_by=manager, organization=manager.organization, epic=epic)
        TaskFactory(created_by=manager, organization=manager.organization, epic=epic)
        # Task without epic should not appear
        TaskFactory(created_by=manager, organization=manager.organization)

        resp = manager_client.get(f"{epic_url(epic.pk)}tasks/")
        assert resp.status_code == 200
        assert resp.data["count"] == 2

    def test_excludes_subtasks(self, manager_client, manager):
        epic = EpicFactory(created_by=manager, organization=manager.organization)
        parent = TaskFactory(
            created_by=manager, organization=manager.organization, epic=epic,
        )
        # Subtask under the epic - should be excluded
        TaskFactory(
            created_by=manager,
            organization=manager.organization,
            epic=epic,
            parent_task=parent,
        )
        resp = manager_client.get(f"{epic_url(epic.pk)}tasks/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_empty_tasks(self, manager_client, manager):
        epic = EpicFactory(created_by=manager, organization=manager.organization)
        resp = manager_client.get(f"{epic_url(epic.pk)}tasks/")
        assert resp.status_code == 200
        assert resp.data["count"] == 0


@pytest.mark.django_db
class TestEpicHistory:
    def test_returns_audit_history(self, manager_client, manager):
        epic = EpicFactory(created_by=manager)
        AuditLogEntry.objects.create(
            epic=epic,
            actor=manager,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="title",
            old_value="Old",
            new_value="New",
        )
        resp = manager_client.get(f"{epic_url(epic.pk)}history/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_engineer_can_view_history(self, engineer_client, manager):
        epic = EpicFactory(created_by=manager)
        AuditLogEntry.objects.create(
            epic=epic,
            actor=manager,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="status",
            old_value="created",
            new_value="in_progress",
        )
        resp = engineer_client.get(f"{epic_url(epic.pk)}history/")
        assert resp.status_code == 200
