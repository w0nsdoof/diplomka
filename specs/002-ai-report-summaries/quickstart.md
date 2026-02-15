# Quickstart: AI-Generated Report Summaries

**Feature Branch**: `002-ai-report-summaries`

## Prerequisites

- Python 3.11+, Node.js 18+
- PostgreSQL 16 running
- Redis 7 running
- Existing backend + frontend from `001-task-management` working

## 1. Backend Setup

### Install new dependency

```bash
cd backend
pip install litellm
pip freeze | grep litellm >> requirements.txt
```

### Environment variables

Add to your `.env` file:

```bash
# LLM Configuration (required for AI summaries)
LLM_MODEL=openai/gpt-4o-mini       # LiteLLM model identifier
LLM_API_KEY=sk-your-api-key-here   # Provider API key
# LLM_API_BASE=                    # Optional: custom API base URL
# LLM_MAX_TOKENS=2000              # Optional: max output tokens (default: 2000)
# LLM_TEMPERATURE=0.3              # Optional: generation temperature (default: 0.3)
```

### Run migrations

```bash
python manage.py makemigrations ai_summaries
python manage.py makemigrations notifications  # task field becomes nullable
python manage.py migrate
```

### Verify Celery Beat schedule

The new beat tasks are auto-registered in settings. Verify:

```bash
python -c "from config.settings.base import CELERY_BEAT_SCHEDULE; print([k for k in CELERY_BEAT_SCHEDULE])"
# Should include: generate-daily-summary, generate-weekly-summary
```

### Start services

```bash
# Terminal 1: Django dev server
python manage.py runserver

# Terminal 2: Celery worker
celery -A config worker -l info

# Terminal 3: Celery beat (for scheduled summaries)
celery -A config beat -l info
```

## 2. Frontend Setup

No new npm dependencies required. The feature uses existing Angular Material components.

```bash
cd frontend
npm start
```

## 3. Manual Testing

### Generate a summary on-demand (API)

```bash
# Get JWT token
TOKEN=$(python -c "
import requests
r = requests.post('http://localhost:8000/api/auth/token/', json={'email':'admin@example.com','password':'<password>'})
print(r.json()['access'])
")

# Trigger on-demand summary
curl -X POST http://localhost:8000/api/summaries/generate/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period_start":"2026-02-01","period_end":"2026-02-14"}'

# Check latest summaries
curl http://localhost:8000/api/summaries/latest/ \
  -H "Authorization: Bearer $TOKEN"
```

### Trigger daily summary manually (Django shell)

```bash
python manage.py shell -c "
from apps.ai_summaries.tasks import generate_daily_summary
result = generate_daily_summary.delay()
print(f'Task ID: {result.id}')
"
```

## 4. Running Tests

```bash
# Backend tests
cd backend
pytest tests/unit/test_ai_summaries_services.py -v
pytest tests/integration/test_ai_summaries_api.py -v
pytest tests/integration/test_ai_summaries_tasks.py -v

# Frontend tests
cd frontend
npm run test:ci
```

## 5. Key Files

| File | Purpose |
|------|---------|
| `backend/apps/ai_summaries/models.py` | ReportSummary model |
| `backend/apps/ai_summaries/services.py` | LLM integration + metrics collection |
| `backend/apps/ai_summaries/prompts.py` | LLM prompt templates |
| `backend/apps/ai_summaries/tasks.py` | Celery tasks (daily, weekly, on-demand) |
| `backend/apps/ai_summaries/views.py` | API views |
| `backend/apps/ai_summaries/serializers.py` | DRF serializers |
| `frontend/src/app/core/services/summary.service.ts` | Angular API service |
| `frontend/src/app/features/reports/reports.component.ts` | Reports page (modified) |
| `frontend/src/app/features/reports/summary-list/` | Summary history browser |
| `frontend/src/app/features/reports/summary-detail/` | Summary detail + versions |

## 6. Configuration Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `LLM_MODEL` | (required) | LiteLLM model string, e.g. `openai/gpt-4o-mini` |
| `LLM_API_KEY` | (required) | API key for the LLM provider |
| `LLM_API_BASE` | (none) | Custom API base URL |
| `LLM_MAX_TOKENS` | `2000` | Max output tokens per generation |
| `LLM_TEMPERATURE` | `0.3` | LLM temperature (lower = more factual) |
| Daily schedule | `00:05 UTC` | Celery Beat crontab |
| Weekly schedule | `Mon 06:00 UTC` | Celery Beat crontab |
