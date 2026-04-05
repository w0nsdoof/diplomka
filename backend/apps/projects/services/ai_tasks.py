import json
import logging
import re

from apps.tasks.models import Task

logger = logging.getLogger(__name__)

VALID_PRIORITIES = {"low", "medium", "high", "critical"}


def build_generation_context(epic) -> dict:
    """Collect Epic, project, team, tags, and history into a dict for the LLM prompt."""
    context = {}

    # Epic fields
    epic_tags = list(epic.tags.all())
    context["epic"] = {
        "title": epic.title,
        "description": epic.description,
        "priority": epic.priority,
        "deadline": epic.deadline.isoformat() if epic.deadline else None,
        "tags": [{"id": t.id, "name": t.name} for t in epic_tags],
        "client": epic.client.name if epic.client else None,
    }

    # Project fields
    project = epic.project
    if project:
        context["project"] = {
            "title": project.title,
            "description": project.description,
        }
    else:
        context["project"] = None

    # Team members from project.team (active engineers only)
    team_members = []
    if project:
        engineers = project.team.filter(role="engineer", is_active=True)

        # Determine tags for history filtering: Epic tags, fallback to project tags
        filter_tags = epic_tags
        if not filter_tags:
            filter_tags = list(project.tags.all())

        for member in engineers:
            track_record = []
            if filter_tags:
                recent_tasks = (
                    Task.objects.filter(
                        assignees=member,
                        status="done",
                        parent_task__isnull=True,
                        tags__in=filter_tags,
                        organization=epic.organization,
                    )
                    .distinct()
                    .order_by("-updated_at")
                    .prefetch_related("tags")[:5]
                )
                for t in recent_tasks:
                    track_record.append({
                        "title": t.title,
                        "tags": [tag.name for tag in t.tags.all()],
                    })

            team_members.append({
                "id": member.id,
                "name": f"{member.first_name} {member.last_name}",
                "job_title": member.job_title or "",
                "skills": member.skills or "",
                "track_record": track_record,
            })

    context["team_members"] = team_members

    # Existing task titles under this Epic (top-level only)
    context["existing_tasks"] = list(
        Task.objects.filter(
            epic=epic,
            parent_task__isnull=True,
        ).values_list("title", flat=True)
    )

    # Full organization tag set
    from apps.tags.models import Tag

    context["available_tags"] = list(
        Tag.objects.filter(organization=epic.organization).values("id", "name")
    )

    return context


def parse_llm_response(text: str) -> list[dict]:
    """Parse LLM response as JSON array. Falls back to extracting from markdown fences."""
    # Try direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        raise ValueError("LLM response is not a JSON array.")
    except (json.JSONDecodeError, ValueError):
        pass

    # Fallback: extract JSON from markdown code fences
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(1))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not parse LLM response as JSON array.")


def validate_generated_tasks(
    tasks: list[dict],
    team_ids: set[int],
    org_tag_ids: set[int],
) -> list[dict]:
    """Validate and clean generated tasks. Returns cleaned list."""
    cleaned = []
    for task in tasks:
        if not isinstance(task, dict):
            continue

        title = task.get("title", "")
        if not title or not isinstance(title, str) or not title.strip():
            continue

        # Validate / default priority
        priority = task.get("priority", "medium")
        if priority not in VALID_PRIORITIES:
            priority = "medium"

        # Validate assignee_id
        assignee_id = task.get("assignee_id")
        if assignee_id is not None:
            if not isinstance(assignee_id, int) or assignee_id not in team_ids:
                assignee_id = None

        # Validate tag_ids
        raw_tag_ids = task.get("tag_ids", [])
        if not isinstance(raw_tag_ids, list):
            raw_tag_ids = []
        tag_ids = [tid for tid in raw_tag_ids if isinstance(tid, int) and tid in org_tag_ids]

        description = task.get("description", "")
        if not isinstance(description, str):
            description = ""

        cleaned.append({
            "title": title.strip(),
            "description": description,
            "priority": priority,
            "assignee_id": assignee_id,
            "tag_ids": tag_ids,
        })

        if len(cleaned) >= 15:
            break

    return cleaned
