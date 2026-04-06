import json
import logging
import re

from apps.tasks.models import Task

logger = logging.getLogger(__name__)

VALID_PRIORITIES = {"low", "medium", "high", "critical"}

# Rough char-to-token ratio (~4 chars per token).  Keep total prompt under
# 80% of the model's typical 8k context to leave room for the response.
MAX_PROMPT_CHARS = 24_000  # ~6k tokens
MAX_TEAM_MEMBERS = 20
MAX_EXISTING_TASKS = 50
MAX_TAGS = 100


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
            base_qs = Task.objects.filter(
                assignees=member,
                status="done",
                parent_task__isnull=True,
                organization=epic.organization,
            ).distinct().order_by("-updated_at").prefetch_related("tags")

            # Primary: tasks matching epic/project tags
            if filter_tags:
                tagged_tasks = list(base_qs.filter(tags__in=filter_tags)[:10])
                for t in tagged_tasks:
                    track_record.append({
                        "title": t.title,
                        "tags": [tag.name for tag in t.tags.all()],
                    })

            # Backfill with recent tasks (any tags) if we have few matches
            if len(track_record) < 5:
                seen_ids = {t.pk for t in (tagged_tasks if filter_tags else [])}
                for t in base_qs.exclude(pk__in=seen_ids)[:5 - len(track_record)]:
                    track_record.append({
                        "title": t.title,
                        "tags": [tag.name for tag in t.tags.all()],
                    })

            # Task velocity: total done tasks in last 30 days
            from django.utils import timezone as tz
            thirty_days_ago = tz.now() - tz.timedelta(days=30)
            done_count_30d = Task.objects.filter(
                assignees=member,
                status="done",
                organization=epic.organization,
                updated_at__gte=thirty_days_ago,
            ).count()

            team_members.append({
                "id": member.id,
                "name": f"{member.first_name} {member.last_name}",
                "job_title": member.job_title or "",
                "skills": member.skills or "",
                "track_record": track_record,
                "tasks_completed_30d": done_count_30d,
            })

    context["team_members"] = team_members[:MAX_TEAM_MEMBERS]

    # Existing task titles under this Epic (top-level only)
    context["existing_tasks"] = list(
        Task.objects.filter(
            epic=epic,
            parent_task__isnull=True,
        ).values_list("title", flat=True)[:MAX_EXISTING_TASKS]
    )

    # Organization tag set (capped)
    from apps.tags.models import Tag

    context["available_tags"] = list(
        Tag.objects.filter(organization=epic.organization).values("id", "name")[:MAX_TAGS]
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
    *,
    max_tasks: int = 15,
) -> tuple[list[dict], list[str]]:
    """Validate and clean generated tasks. Returns (cleaned list, warnings)."""
    cleaned = []
    warnings: list[str] = []
    dropped_assignees = 0
    dropped_tags = 0
    skipped_tasks = 0

    for task in tasks:
        if not isinstance(task, dict):
            skipped_tasks += 1
            continue

        title = task.get("title", "")
        if not title or not isinstance(title, str) or not title.strip():
            skipped_tasks += 1
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
                dropped_assignees += 1

        # Validate tag_ids
        raw_tag_ids = task.get("tag_ids", [])
        if not isinstance(raw_tag_ids, list):
            raw_tag_ids = []
        valid_tag_ids = [tid for tid in raw_tag_ids if isinstance(tid, int) and tid in org_tag_ids]
        dropped_tags += len(raw_tag_ids) - len(valid_tag_ids)

        description = task.get("description", "")
        if not isinstance(description, str):
            description = ""

        # Parse estimated_hours if present
        estimated_hours = task.get("estimated_hours")
        if estimated_hours is not None:
            try:
                estimated_hours = float(estimated_hours)
                if estimated_hours <= 0 or estimated_hours > 999:
                    estimated_hours = None
            except (TypeError, ValueError):
                estimated_hours = None

        cleaned.append({
            "title": title.strip(),
            "description": description,
            "priority": priority,
            "assignee_id": assignee_id,
            "tag_ids": valid_tag_ids,
            "estimated_hours": estimated_hours,
        })

        if len(cleaned) >= max_tasks:
            remaining = len(tasks) - len(cleaned) - skipped_tasks
            if remaining > 0:
                warnings.append(f"Truncated to {max_tasks} tasks ({remaining} extra tasks omitted).")
            break

    if skipped_tasks:
        warnings.append(f"Skipped {skipped_tasks} malformed task(s) from AI output.")
    if dropped_assignees:
        warnings.append(f"Cleared {dropped_assignees} invalid assignee suggestion(s).")
    if dropped_tags:
        warnings.append(f"Removed {dropped_tags} invalid tag reference(s).")

    return cleaned, warnings
