import pytest

from apps.projects.models import Project
from tests.factories import (
    EngineerFactory,
    ProjectFactory,
)

PROJECTS_URL = "/api/projects/"


def project_url(project_id):
    return f"{PROJECTS_URL}{project_id}/"


@pytest.mark.django_db
class TestProjectTeamCreate:
    def test_create_project_with_team(self, manager_client, manager, engineer):
        eng2 = EngineerFactory(organization=manager.organization)
        resp = manager_client.post(
            PROJECTS_URL,
            {
                "title": "Team Project",
                "team_member_ids": [engineer.id, eng2.id],
            },
            format="json",
        )
        assert resp.status_code == 201
        project = Project.objects.get(pk=resp.data["id"])
        assert set(project.team.values_list("id", flat=True)) == {engineer.id, eng2.id}

    def test_create_project_without_team(self, manager_client):
        resp = manager_client.post(
            PROJECTS_URL,
            {"title": "Solo Project"},
            format="json",
        )
        assert resp.status_code == 201
        project = Project.objects.get(pk=resp.data["id"])
        assert project.team.count() == 0

    def test_create_project_with_invalid_team_member(self, manager_client):
        resp = manager_client.post(
            PROJECTS_URL,
            {"title": "Bad Team", "team_member_ids": [99999]},
            format="json",
        )
        assert resp.status_code == 400
        errors = resp.data.get("errors", resp.data)
        assert "team_member_ids" in errors

    def test_team_in_list_response(self, manager_client, manager, engineer):
        ProjectFactory(created_by=manager, team=[engineer])
        resp = manager_client.get(PROJECTS_URL)
        assert resp.status_code == 200
        result = resp.data["results"][0]
        assert "team" in result
        assert len(result["team"]) == 1
        assert result["team"][0]["id"] == engineer.id

    def test_team_in_detail_response(self, manager_client, manager, engineer):
        proj = ProjectFactory(created_by=manager, team=[engineer])
        resp = manager_client.get(project_url(proj.id))
        assert resp.status_code == 200
        assert len(resp.data["team"]) == 1
        assert resp.data["team"][0]["id"] == engineer.id


@pytest.mark.django_db
class TestProjectTeamUpdate:
    def test_update_team_members(self, manager_client, manager, engineer):
        proj = ProjectFactory(created_by=manager)
        resp = manager_client.patch(
            project_url(proj.id),
            {"team_member_ids": [engineer.id], "version": proj.version},
            format="json",
        )
        assert resp.status_code == 200
        proj.refresh_from_db()
        assert set(proj.team.values_list("id", flat=True)) == {engineer.id}

    def test_replace_team_members(self, manager_client, manager, engineer):
        eng2 = EngineerFactory(organization=manager.organization)
        proj = ProjectFactory(created_by=manager, team=[engineer])
        resp = manager_client.patch(
            project_url(proj.id),
            {"team_member_ids": [eng2.id], "version": proj.version},
            format="json",
        )
        assert resp.status_code == 200
        proj.refresh_from_db()
        assert set(proj.team.values_list("id", flat=True)) == {eng2.id}

    def test_clear_team(self, manager_client, manager, engineer):
        proj = ProjectFactory(created_by=manager, team=[engineer])
        resp = manager_client.patch(
            project_url(proj.id),
            {"team_member_ids": [], "version": proj.version},
            format="json",
        )
        assert resp.status_code == 200
        proj.refresh_from_db()
        assert proj.team.count() == 0

    def test_update_without_team_keeps_existing(self, manager_client, manager, engineer):
        proj = ProjectFactory(created_by=manager, team=[engineer])
        resp = manager_client.patch(
            project_url(proj.id),
            {"title": "Updated Title", "version": proj.version},
            format="json",
        )
        assert resp.status_code == 200
        proj.refresh_from_db()
        assert proj.team.count() == 1

    def test_engineer_cannot_update_project(self, engineer_client, manager, engineer):
        proj = ProjectFactory(created_by=manager)
        resp = engineer_client.patch(
            project_url(proj.id),
            {"team_member_ids": [engineer.id], "version": proj.version},
            format="json",
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestProjectTeamWithAssignee:
    def test_create_with_team_and_assignee(self, manager_client, manager, engineer):
        eng2 = EngineerFactory(organization=manager.organization)
        resp = manager_client.post(
            PROJECTS_URL,
            {
                "title": "Full Project",
                "assignee_id": engineer.id,
                "team_member_ids": [engineer.id, eng2.id],
            },
            format="json",
        )
        assert resp.status_code == 201
        project = Project.objects.get(pk=resp.data["id"])
        assert project.assignee_id == engineer.id
        assert set(project.team.values_list("id", flat=True)) == {engineer.id, eng2.id}
