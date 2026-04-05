# Quickstart: AI Auto-Generation of Tasks from Epic

**Feature Branch**: `008-ai-epic-tasks`

---

## Prerequisites

- Backend running (`python manage.py runserver`)
- Celery worker running (`celery -A config worker -l info`)
- Redis running (Celery broker + lock store)
- LLM configured via env vars: `LLM_MODEL`, `LLM_API_KEY` (or `GROQ_API_KEY`), optionally `LLM_API_BASE`
- At least one manager user account
- A project with team members (engineers) assigned

## Quick Test Flow

### 1. Create test data (if not present)

```bash
# Ensure you have a project with team members, an epic under it, and some tags
# Use the existing test accounts: manager@example.com, engineer@example.com
```

### 2. Trigger generation (backend API)

```bash
# Login as manager
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"<password>"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

# Trigger generation for epic ID 1
curl -s -X POST http://localhost:8000/api/epics/1/generate-tasks/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Response: {"task_id": "abc123..."}
```

### 3. Poll for results

```bash
TASK_ID="<task_id from step 2>"

curl -s http://localhost:8000/api/epics/1/generate-tasks/status/?task_id=$TASK_ID \
  -H "Authorization: Bearer $TOKEN"

# Poll until status is "completed" or "failed"
# Response when done: {"status": "completed", "result": {"tasks": [...]}}
```

### 4. Confirm tasks

```bash
# Take the tasks from step 3, edit as needed, and confirm
curl -s -X POST http://localhost:8000/api/epics/1/confirm-tasks/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "title": "Set up database schema",
        "description": "Create tables and indexes.",
        "priority": "high",
        "assignee_id": 2,
        "tag_ids": [1]
      }
    ]
  }'

# Response: {"created_count": 1, "tasks": [{"id": 101, "title": "...", "status": "created"}]}
```

### 5. Verify via frontend

1. Navigate to the Epic detail page (`/epics/1`)
2. Click "Generate Tasks with AI" button
3. Wait for loading indicator → preview dialog appears
4. Review/edit tasks, click "Confirm"
5. Tasks appear in the Epic's task list
6. Assigned engineers receive notifications

## Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_MODEL` | `openai/gpt-4o-mini` | LiteLLM model identifier |
| `LLM_API_KEY` | `""` | API key for the LLM provider |
| `LLM_API_BASE` | `""` | Custom API base URL (optional) |
| `LLM_MAX_TOKENS` | `2000` | Max tokens for LLM response |
| `LLM_TEMPERATURE` | `0.3` | LLM temperature (lower = more deterministic) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for Celery + locks |

## Running Tests

```bash
cd backend

# Unit tests for AI task service
python -m pytest tests/unit/test_ai_tasks_service.py -v

# Integration tests for API endpoints
python -m pytest tests/integration/test_ai_epic_tasks.py -v

# All tests
python -m pytest tests/ -v
```

## Architecture Overview

```
[Manager clicks "Generate Tasks"]
        │
        ▼
POST /api/epics/{id}/generate-tasks/
        │
        ├─ Validate Epic (title + description present)
        ├─ Acquire Redis lock (epic_generate:{id}, 120s TTL)
        ├─ Dispatch Celery task
        └─ Return 202 {task_id}
              │
              ▼
        [Celery Worker]
        ├─ Build LLM context (epic, project, team, tags, history)
        ├─ Call LLM via call_llm()
        ├─ Parse JSON response
        ├─ Validate assignees + tags
        └─ Store result in Celery result backend
              │
              ▼
GET /api/epics/{id}/generate-tasks/status/?task_id=...
        │
        └─ Return {status, result: {tasks: [...]}}
              │
              ▼
        [Frontend Preview Dialog]
        ├─ Manager edits/removes tasks
        └─ Clicks "Confirm"
              │
              ▼
POST /api/epics/{id}/confirm-tasks/
        │
        ├─ Validate task list
        ├─ Create tasks in @transaction.atomic
        ├─ Set assignees (M2M)
        ├─ Set tags (M2M)
        ├─ Create notifications per assignee
        └─ Return 201 {created_count, tasks}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 409 on generate | Generation already in progress. Wait or check Redis for stale lock (`epic_generate:{id}`) |
| "LLM service unavailable" | Check `LLM_API_KEY` and `LLM_MODEL` env vars. Verify LLM provider is reachable. |
| Empty task list returned | Epic description may be too vague. Add more detail to the Epic description. |
| Assignees not suggested | Ensure project has team members with completed tasks matching Epic tags. |
| Celery task stays PENDING | Ensure Celery worker is running: `celery -A config worker -l info` |
