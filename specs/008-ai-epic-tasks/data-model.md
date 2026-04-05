# Data Model: AI Auto-Generation of Tasks from Epic

**Feature Branch**: `008-ai-epic-tasks`
**Date**: 2026-04-05

---

## Overview

This feature introduces **no new database models or migrations**. It operates entirely on existing entities (Epic, Task, User, Tag, Project) and uses ephemeral data structures for the AI generation pipeline. The only new "models" are serializer-level DTOs for request/response shaping and an in-memory data structure for the LLM context.

---

## Existing Entities Used

### Epic (source entity)

**Model**: `apps.projects.models.Epic`

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | AutoField | Identifies the Epic for generation |
| `title` | CharField(255) | LLM input context |
| `description` | TextField | LLM input context (required non-empty for generation) |
| `priority` | CharField — low/medium/high/critical | LLM input context |
| `status` | CharField — created/in_progress/waiting/done/archived | Not directly used, but Epic must exist |
| `deadline` | DateTimeField (nullable) | LLM input context |
| `project` | FK → Project (nullable) | Provides team roster and fallback tags |
| `tags` | M2M → Tag | Primary tag set for team history filtering |
| `client` | FK → Client (nullable) | LLM input context (client name) |
| `organization` | FK → Organization | Scoping for all queries |
| `created_by` | FK → User | Not used in generation |

**Validation for generation**: `title` must be non-empty AND `description` must be non-empty (FR-017).

---

### Task (output entity)

**Model**: `apps.tasks.models.Task`

| Field | Type | How populated by AI |
|-------|------|---------------------|
| `title` | CharField(255) | AI-generated, manager-editable |
| `description` | TextField | AI-generated, manager-editable |
| `priority` | CharField — low/medium/high/critical | AI-suggested, manager-editable. Default: "medium" |
| `status` | CharField | Always "created" (default) |
| `epic` | FK → Epic | Set to the source Epic |
| `parent_task` | FK → Task (self) | Always null (top-level tasks only) |
| `assignees` | M2M → User | AI-suggested single assignee (via `assignee_id`), manager-editable. Set via `.assignees.set()` |
| `tags` | M2M → Tag | AI-suggested from org tag set, manager-editable |
| `client` | FK → Client | Inherited from Epic's client (if any) |
| `organization` | FK → Organization | Inherited from Epic's organization |
| `created_by` | FK → User | The manager who confirmed the generation |
| `deadline` | DateTimeField | Not set by AI (inherits null). Out of scope for V1 preview editing — manager can set via standard task edit after creation. |
| `version` | PositiveInteger | Default 1 |

**Notes**:
- AI suggests a single `assignee_id` per task. The Task model supports M2M `assignees`, so we set it as a single-element list: `task.assignees.set([assignee_id])`.
- `parent_task` is always null — spec scopes this feature to top-level tasks only.
- `client` is copied from the Epic's client, not AI-generated.

---

### User / Team Member (context entity)

**Model**: `apps.accounts.models.User`

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | AutoField | Sent to LLM for assignee suggestions |
| `first_name` | CharField(150) | LLM context — team member name |
| `last_name` | CharField(150) | LLM context — team member name |
| `role` | CharField — manager/engineer/client/superadmin | Filter: only engineers from `project.team` |
| `job_title` | CharField(150) | LLM context — secondary signal for assignment |
| `skills` | TextField | LLM context — secondary signal for assignment |
| `is_active` | BooleanField | Filter: only active users |

**Query path**: `epic.project.team.filter(role="engineer", is_active=True)`

---

### Tag (context + output entity)

**Model**: `apps.tags.models.Tag`

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | AutoField | Sent to LLM; used in generated task tag_ids |
| `name` | CharField(50) | Sent to LLM for context |
| `organization` | FK → Organization | Scoping |

**Query path**: `Tag.objects.filter(organization=epic.organization)` — full org tag set sent to LLM.

---

### Project (context entity)

**Model**: `apps.projects.models.Project`

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | AutoField | Not sent to LLM |
| `title` | CharField(255) | LLM context |
| `description` | TextField | LLM context |
| `team` | M2M → User | Source of team members for assignee pool |
| `tags` | M2M → Tag | Fallback tags if Epic has no tags (FR-006) |

---

## Ephemeral Data Structures (not persisted)

### LLM Context Object (built server-side)

```python
# Built by apps.projects.services.ai_tasks.build_generation_context()
{
    "epic": {
        "title": str,
        "description": str,
        "priority": str | None,
        "deadline": str | None,  # ISO format
        "tags": [{"id": int, "name": str}, ...],
        "client": str | None,  # client name
    },
    "project": {  # None if Epic has no project
        "title": str,
        "description": str,
    },
    "team_members": [
        {
            "id": int,
            "name": str,  # "First Last"
            "job_title": str,
            "skills": str,
            "track_record": [
                {"title": str, "tags": [str, ...]}  # up to 5 completed tasks
            ],
        },
        ...
    ],
    "existing_tasks": [str, ...],  # titles of existing tasks under this Epic
    "available_tags": [{"id": int, "name": str}, ...],  # full org tag set
}
```

### Generated Task DTO (LLM output, validated server-side)

```python
# Single task from LLM response, after validation
{
    "title": str,           # required, non-empty
    "description": str,     # optional, defaults to ""
    "priority": str,        # validated against choices, defaults to "medium"
    "assignee_id": int | None,  # validated against team set, None if invalid/missing
    "tag_ids": [int, ...],  # validated against org tags, invalid IDs silently dropped
}
```

### Confirm Tasks Request (from frontend)

```python
# Array of tasks the manager has reviewed/edited
[
    {
        "title": str,           # required
        "description": str,     # optional
        "priority": str,        # required, validated
        "assignee_id": int | None,  # optional, validated against team
        "tag_ids": [int, ...],  # optional, validated against org tags
    },
    ...
]
```

---

## Relationships Diagram

```
                    ┌──────────┐
                    │  Project  │
                    │  .team ───┼──M2M──► User (engineers)
                    │  .tags ───┼──M2M──► Tag (fallback)
                    └─────┬────┘
                          │ FK (nullable)
                    ┌─────▼────┐
                    │   Epic   │
                    │  .tags ───┼──M2M──► Tag (primary filter)
                    │  .client ─┼──FK───► Client
                    └─────┬────┘
                          │ FK (set on created tasks)
                    ┌─────▼────┐
 AI generates ────► │   Task   │
                    │ .assignees┼──M2M──► User (AI-suggested)
                    │  .tags ───┼──M2M──► Tag (AI-suggested)
                    │ .created_by──FK──► User (confirming manager)
                    └──────────┘
                          │
                    ┌─────▼────────┐
                    │ Notification │  (created per assignee)
                    └──────────────┘
```

---

## State Transitions

This feature has no model-level state transitions (no new status fields). The Celery task lifecycle is tracked via Celery's built-in `AsyncResult` states:

```
PENDING → STARTED → SUCCESS (result = generated tasks JSON)
                  → FAILURE (result = error message)
```

The Redis lock lifecycle:

```
UNLOCKED → LOCKED (on generate request)
              → UNLOCKED (on task completion or TTL expiry)
```

---

## Validation Rules Summary

| Rule | Source | Enforcement |
|------|--------|-------------|
| Epic must have non-empty title and description | FR-017 | API view validation before dispatching Celery task |
| Only managers can trigger generation | FR-015 | `IsManager` permission class |
| Assignee must be active engineer in project team | FR-013 | Server-side validation; invalid silently dropped |
| Tags must exist in organization | FR-018 | Server-side validation; invalid silently dropped |
| Max 15 tasks per generation | Assumption | Prompt instruction + server-side cap on parsed output |
| No concurrent generation for same Epic | FR-011 | Redis lock with 120s TTL |
| At least one task required for confirmation | Implicit | API validation on confirm endpoint |
| Priority must be valid choice | Implicit | Default to "medium" if invalid |

---

## Index Impact

No new indexes needed. Existing indexes cover all query patterns:
- `ix_task_org_epic` — filtering tasks by Epic
- `ix_task_status` — filtering completed tasks for track records
- `ix_user_role` — filtering engineers
- `ix_epic_org_project` — joining Epic to Project
- Tag M2M through tables — standard Django join tables
