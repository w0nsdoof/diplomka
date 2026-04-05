TASK_GENERATION_SYSTEM_PROMPT = """\
You are a project management assistant. Given an Epic and its context, \
generate a set of tasks as a JSON array.

Each task object must have:
- title: string (concise, actionable task title)
- description: string (1-3 sentences explaining what needs to be done)
- priority: "low" | "medium" | "high" | "critical"
- assignee_id: number | null (from the provided team member list, or null if no good match)
- tag_ids: number[] (from the provided tag list, empty array if none match)

Rules:
- Generate between 3 and 15 tasks depending on Epic complexity.
- Only use assignee IDs from the provided team member list.
- Only use tag IDs from the provided tag set.
- Do not duplicate existing tasks (titles provided below).
- Consider team members' track records and profiles (job_title, skills) when suggesting assignees.
- Return ONLY valid JSON — no markdown fences, no commentary, no extra text.\
"""


def build_system_prompt() -> str:
    return TASK_GENERATION_SYSTEM_PROMPT


def build_user_prompt(context: dict) -> str:
    lines = []

    # Epic section
    epic = context["epic"]
    lines.append("## Epic")
    lines.append(f"Title: {epic['title']}")
    lines.append(f"Description: {epic['description']}")
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
