import json

import pytest

from apps.projects.prompts import build_system_prompt, build_user_prompt
from apps.projects.services.ai_tasks import (
    build_generation_context,
    parse_llm_response,
    validate_generated_tasks,
)
from tests.factories import (
    EngineerFactory,
    EpicFactory,
    ProjectFactory,
    TagFactory,
    TaskFactory,
)

# ---------------------------------------------------------------------------
# build_system_prompt
# ---------------------------------------------------------------------------

class TestBuildSystemPrompt:
    def test_returns_non_empty_string(self):
        prompt = build_system_prompt()
        assert isinstance(prompt, str)
        assert "JSON" in prompt

    def test_dynamic_task_range_short_description(self):
        ctx = {"epic": {"description": "Short"}, "team_members": []}
        prompt = build_system_prompt(ctx)
        assert "3" in prompt and "8" in prompt

    def test_dynamic_task_range_long_description(self):
        ctx = {"epic": {"description": "x" * 1000}, "team_members": [{"id": i} for i in range(5)]}
        prompt = build_system_prompt(ctx)
        assert "5" in prompt


# ---------------------------------------------------------------------------
# build_user_prompt
# ---------------------------------------------------------------------------

class TestBuildUserPrompt:
    def test_includes_epic_fields(self):
        context = {
            "epic": {
                "title": "Auth Feature",
                "description": "Implement OAuth2",
                "priority": "high",
                "deadline": "2026-05-01",
                "tags": [{"id": 1, "name": "backend"}],
                "client": "Acme Corp",
            },
            "project": {"title": "Portal", "description": "Client portal"},
            "team_members": [],
            "existing_tasks": ["Setup DB"],
            "available_tags": [{"id": 1, "name": "backend"}],
        }
        prompt = build_user_prompt(context)
        assert "Auth Feature" in prompt
        assert "Implement OAuth2" in prompt
        assert "high" in prompt
        assert "Acme Corp" in prompt
        assert "Portal" in prompt
        assert "Setup DB" in prompt

    def test_no_project(self):
        context = {
            "epic": {
                "title": "Standalone",
                "description": "No project",
                "priority": None,
                "deadline": None,
                "tags": [],
                "client": None,
            },
            "project": None,
            "team_members": [],
            "existing_tasks": [],
            "available_tags": [],
        }
        prompt = build_user_prompt(context)
        assert "Standalone" in prompt
        assert "## Project" not in prompt

    def test_includes_team_members(self):
        context = {
            "epic": {
                "title": "T",
                "description": "D",
                "priority": None,
                "deadline": None,
                "tags": [],
                "client": None,
            },
            "project": None,
            "team_members": [
                {
                    "id": 1,
                    "name": "Alice Smith",
                    "job_title": "Backend Dev",
                    "skills": "Python, Django",
                    "track_record": [{"title": "Fix bug", "tags": ["backend"]}],
                },
            ],
            "existing_tasks": [],
            "available_tags": [],
        }
        prompt = build_user_prompt(context)
        assert "Alice Smith" in prompt
        assert "Backend Dev" in prompt
        assert "Fix bug" in prompt


# ---------------------------------------------------------------------------
# build_generation_context
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBuildGenerationContext:
    def test_epic_with_project_and_team(self):
        org = ProjectFactory().organization
        tag = TagFactory(organization=org)
        project = ProjectFactory(organization=org, created_by__organization=org)
        engineer = EngineerFactory(organization=org, job_title="Dev", skills="Python")
        project.team.add(engineer)
        project.tags.add(tag)
        epic = EpicFactory(organization=org, project=project, created_by__organization=org)
        epic.tags.add(tag)

        # Create a completed task for the engineer with matching tag
        done_task = TaskFactory(
            organization=org, created_by__organization=org, status="done",
        )
        done_task.assignees.add(engineer)
        done_task.tags.add(tag)

        context = build_generation_context(epic)

        assert context["epic"]["title"] == epic.title
        assert context["project"]["title"] == project.title
        assert len(context["team_members"]) == 1
        assert context["team_members"][0]["id"] == engineer.id
        assert len(context["available_tags"]) >= 1

    def test_epic_without_project(self):
        epic = EpicFactory(project=None)
        context = build_generation_context(epic)
        assert context["project"] is None
        assert context["team_members"] == []

    def test_epic_no_tags_falls_back_to_project_tags(self):
        org = ProjectFactory().organization
        tag = TagFactory(organization=org)
        project = ProjectFactory(organization=org, created_by__organization=org)
        project.tags.add(tag)
        engineer = EngineerFactory(organization=org)
        project.team.add(engineer)
        epic = EpicFactory(organization=org, project=project, created_by__organization=org)
        # Epic has no tags — should use project tags

        context = build_generation_context(epic)
        # Just verify it doesn't error; track_record query uses project tags
        assert len(context["team_members"]) == 1

    def test_epic_with_empty_team(self):
        project = ProjectFactory()
        epic = EpicFactory(
            organization=project.organization,
            project=project,
            created_by__organization=project.organization,
        )
        context = build_generation_context(epic)
        assert context["team_members"] == []


# ---------------------------------------------------------------------------
# parse_llm_response
# ---------------------------------------------------------------------------

class TestParseLlmResponse:
    def test_valid_json(self):
        text = json.dumps([{"title": "Task A"}, {"title": "Task B"}])
        result = parse_llm_response(text)
        assert len(result) == 2
        assert result[0]["title"] == "Task A"

    def test_json_in_markdown_fences(self):
        text = '```json\n[{"title": "Task A"}]\n```'
        result = parse_llm_response(text)
        assert len(result) == 1

    def test_invalid_text_raises(self):
        with pytest.raises(ValueError, match="Could not parse"):
            parse_llm_response("This is not JSON at all")

    def test_non_array_raises(self):
        with pytest.raises(ValueError):
            parse_llm_response('{"title": "not an array"}')


# ---------------------------------------------------------------------------
# validate_generated_tasks
# ---------------------------------------------------------------------------

class TestValidateGeneratedTasks:
    def test_valid_tasks(self):
        tasks = [
            {"title": "Task A", "priority": "high", "assignee_id": 1, "tag_ids": [10]},
            {"title": "Task B", "priority": "low", "assignee_id": 2, "tag_ids": [10, 20]},
        ]
        result, warnings = validate_generated_tasks(tasks, team_ids={1, 2}, org_tag_ids={10, 20})
        assert len(result) == 2
        assert result[0]["assignee_id"] == 1
        assert result[1]["tag_ids"] == [10, 20]
        assert warnings == []

    def test_invalid_assignee_dropped(self):
        tasks = [{"title": "T", "priority": "medium", "assignee_id": 999, "tag_ids": []}]
        result, warnings = validate_generated_tasks(tasks, team_ids={1, 2}, org_tag_ids=set())
        assert result[0]["assignee_id"] is None
        assert any("assignee" in w for w in warnings)

    def test_invalid_tag_ids_dropped(self):
        tasks = [{"title": "T", "priority": "medium", "tag_ids": [1, 999]}]
        result, warnings = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids={1})
        assert result[0]["tag_ids"] == [1]
        assert any("tag" in w for w in warnings)

    def test_priority_defaults_to_medium(self):
        tasks = [{"title": "T", "priority": "urgent"}]
        result, _ = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids=set())
        assert result[0]["priority"] == "medium"

    def test_list_capped_at_15(self):
        tasks = [{"title": f"T{i}", "priority": "low"} for i in range(20)]
        result, warnings = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids=set())
        assert len(result) == 15
        assert any("Truncated" in w for w in warnings)

    def test_empty_title_skipped(self):
        tasks = [{"title": "", "priority": "low"}, {"title": "Valid", "priority": "low"}]
        result, warnings = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids=set())
        assert len(result) == 1
        assert result[0]["title"] == "Valid"
        assert any("malformed" in w for w in warnings)

    def test_non_dict_skipped(self):
        tasks = ["not a dict", {"title": "Valid", "priority": "low"}]
        result, warnings = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids=set())
        assert len(result) == 1
        assert any("malformed" in w for w in warnings)

    def test_estimated_hours_parsed(self):
        tasks = [{"title": "T", "priority": "low", "estimated_hours": 4.5}]
        result, _ = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids=set())
        assert result[0]["estimated_hours"] == 4.5

    def test_invalid_estimated_hours_set_to_none(self):
        tasks = [{"title": "T", "priority": "low", "estimated_hours": -1}]
        result, _ = validate_generated_tasks(tasks, team_ids=set(), org_tag_ids=set())
        assert result[0]["estimated_hours"] is None
