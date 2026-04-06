TASK_GENERATION_SYSTEM_PROMPT = """\
You are a project management assistant. Given an Epic and its context, \
generate a set of tasks as a JSON array.

Each task object must have:
- title: string (concise, actionable task title)
- description: string (1-3 sentences explaining what needs to be done)
- priority: "low" | "medium" | "high" | "critical"
- assignee_id: number | null (from the provided team member list, or null if no good match)
- tag_ids: number[] (from the provided tag list, empty array if none match)
- estimated_hours: number | null (rough time estimate in hours, null if uncertain)

Rules:
- Generate between {min_tasks} and {max_tasks} tasks depending on Epic complexity.
- Only use assignee IDs from the provided team member list.
- Only use tag IDs from the provided tag set.
- Do not duplicate existing tasks (titles provided below).
- Consider team members' track records and profiles (job_title, skills) when suggesting assignees.
- If the Epic has a deadline, distribute work so tasks can finish before it.
- Return ONLY valid JSON — no markdown fences, no commentary, no extra text.\
"""


def _compute_task_range(context: dict) -> tuple[int, int]:
    """Derive min/max task count from epic complexity signals."""
    desc_len = len(context.get("epic", {}).get("description", ""))
    team_size = len(context.get("team_members", []))
    # Short description → fewer tasks; long → more
    if desc_len < 200:
        return 3, 8
    if desc_len < 800:
        return 4, 12
    # Large description + large team → up to 15
    max_tasks = min(15, max(8, team_size * 2))
    return 5, max_tasks


def build_system_prompt(context: dict | None = None) -> str:
    min_tasks, max_tasks = _compute_task_range(context or {})
    return TASK_GENERATION_SYSTEM_PROMPT.format(
        min_tasks=min_tasks, max_tasks=max_tasks,
    )


MAX_DESCRIPTION_CHARS = 2000


def build_user_prompt(context: dict) -> str:
    lines = []

    # Epic section
    epic = context["epic"]
    desc = epic["description"]
    if len(desc) > MAX_DESCRIPTION_CHARS:
        desc = desc[:MAX_DESCRIPTION_CHARS] + "… (truncated)"
    lines.append("## Epic")
    lines.append(f"Title: {epic['title']}")
    lines.append(f"Description: {desc}")
    if epic.get("priority"):
        lines.append(f"Priority: {epic['priority']}")
    if epic.get("deadline"):
        lines.append(f"Deadline: {epic['deadline']}")
    if epic.get("tags"):
        tag_names = ", ".join(t["name"] for t in epic["tags"])
        lines.append(f"Tags: {tag_names}")
    if epic.get("client"):
        lines.append(f"Client: {epic['client']}")

    # Project section
    project = context.get("project")
    if project:
        lines.append("")
        lines.append("## Project")
        lines.append(f"Title: {project['title']}")
        if project.get("description"):
            lines.append(f"Description: {project['description']}")

    # Team members
    team = context.get("team_members", [])
    if team:
        lines.append("")
        lines.append("## Team Members")
        for member in team:
            parts = [f"ID: {member['id']}, Name: {member['name']}"]
            if member.get("job_title"):
                parts.append(f"Role: {member['job_title']}")
            if member.get("skills"):
                parts.append(f"Skills: {member['skills']}")
            velocity = member.get("tasks_completed_30d")
            if velocity is not None:
                parts.append(f"Tasks done (30d): {velocity}")
            line = " | ".join(parts)
            track = member.get("track_record", [])
            if track:
                tasks_str = "; ".join(
                    f"{t['title']} (tags: {', '.join(t['tags'])})" for t in track
                )
                line += f" | Recent work: {tasks_str}"
            lines.append(f"- {line}")

    # Existing tasks
    existing = context.get("existing_tasks", [])
    if existing:
        lines.append("")
        lines.append("## Existing Tasks (do not duplicate)")
        for title in existing:
            lines.append(f"- {title}")

    # Available tags
    tags = context.get("available_tags", [])
    if tags:
        lines.append("")
        lines.append("## Available Tags")
        for tag in tags:
            lines.append(f"- ID: {tag['id']}, Name: {tag['name']}")

    return "\n".join(lines)
