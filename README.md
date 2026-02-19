# Task Management System for IT Outsourcing

Full-stack task management application built with Django 5 and Angular 17. Features role-based access control, real-time updates via WebSockets, AI-generated report summaries, and automated CI/CD deployment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, Django 5, DRF, Django Channels, Celery, LiteLLM |
| Frontend | Angular 17, Angular Material, TypeScript 5.x |
| Database | PostgreSQL 16 |
| Cache/Broker | Redis 7 (Channels layer + Celery broker) |
| API Docs | drf-spectacular (OpenAPI) |
| Infrastructure | Docker Compose, GitHub Actions CI/CD, Nginx |

## Project Structure

```
backend/                 # Django REST API + WebSockets
  config/                #   Settings (base/dev/test/prod), URLs, ASGI, Celery
  apps/
    accounts/            #   Custom User model (email auth), JWT, RBAC
    tasks/               #   Task CRUD, status transitions, optimistic locking
    clients/             #   Client management + client portal
    comments/            #   Task comments with @mention parsing
    attachments/         #   File upload/download per task
    tags/                #   Tag CRUD with auto-slug
    notifications/       #   In-app + email notifications, deadline warnings
    reports/             #   PDF/Excel report generation
    ai_summaries/        #   AI-generated report summaries via LiteLLM
    audit/               #   Immutable audit log
  tests/                 #   pytest (unit + integration)

frontend/                # Angular 17 SPA
  src/app/
    core/                #   Services, guards, interceptors, layout
    features/            #   Tasks, Kanban, Clients, Calendar, Reports, Admin, Portal

.github/workflows/       # CI/CD pipelines
podman-compose.yml       # Docker Compose (production)
deploy.sh                # Deployment script
```

## Roles

| Role | Access |
|------|--------|
| **Manager** | Full access: tasks, users, clients, reports, audit history |
| **Engineer** | Tasks (read) + Kanban board |
| **Client** | Portal only: own tickets, public comments |

## Development

### Prerequisites

- Python 3.11+
- Node.js 18
- PostgreSQL 16 and Redis 7 (or use Docker)

### Backend

```bash
cd backend
pip install -r requirements/dev.txt
python manage.py runserver          # dev server on :8000
python -m pytest tests/             # run tests
ruff check .                        # lint
```

### Frontend

```bash
cd frontend
npm install
npm start                           # dev server on :4200 (proxies /api to backend)
npm run test:ci                     # run tests (headless)
```

## Deployment

### CI/CD Pipeline (GitHub Actions)

| Event | What runs |
|-------|-----------|
| PR to `main` | CI: backend lint + tests, frontend tests + build |
| Push to `main` | CI + auto-deploy to production server |

Workflows: `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.

### Manual Deploy

```bash
./deploy.sh              # deploy current branch
./deploy.sh main         # deploy specific branch
```

The script SSHes into the server, pulls the latest code, rebuilds Docker images, and restarts containers.

### Production Setup

- Compose file: `podman-compose.yml` (project name: `taskmanager`)
- Services: db, redis, backend (Daphne), frontend (Nginx), celery-worker, celery-beat
- Environment: `.env` file managed separately on the server (not in git)
- Health check: `GET /api/health/` returns `{"status": "ok"}`

## Environment Variables

Key variables in `.env`:

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Django secret key |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database credentials |
| `REDIS_URL` | Redis connection URL |
| `LLM_MODEL`, `GROQ_API_KEY` | AI summary generation (LiteLLM) |
| `SENTRY_DSN` | Error monitoring (optional) |

## Team

| Student ID | Name | Role |
|------------|------|------|
| 22B030361 | [Askar Zhumabayev](https://github.com/w0nsdoof) | Fullstack |
| 22BXXXXX1 | Dariga Orazbai | PM / QA |
| 22BXXXXX2 | Merey Kemelbay | UI/UX / BA |
| 22BXXXXX3 | Madi Kuanyshbekov | Frontend |

## Issue Tracking

Known bugs and issues are tracked in [ISSUES.md](ISSUES.md).
