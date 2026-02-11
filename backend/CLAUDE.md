# Backend — IT Outsourcing Task Management System

Django 5 + DRF REST API with Celery async tasks and Django Channels WebSockets.

## Stack

Python 3.11+, Django 5, DRF, PostgreSQL 16, Redis 7, Celery, Django Channels, drf-spectacular (OpenAPI).

## Project Layout

```
config/           # Django settings (base/dev/test/prod), urls, asgi, celery, pagination, exceptions, middleware
apps/
  accounts/       # Custom User model (email auth), JWT serializers, RBAC permissions
  tasks/          # Task CRUD, status transitions, assignment, version-based optimistic locking
  clients/        # Client management + portal views for client-role users
  comments/       # Task comments with @mention parsing and role-based visibility
  attachments/    # File upload/download per task
  tags/           # Tag CRUD with auto-slug
  notifications/  # In-app notifications + Celery tasks (deadline warnings, status emails)
  reports/        # Summary/PDF/Excel report generation
  audit/          # Immutable audit log for all task changes
tests/
  conftest.py     # Shared pytest fixtures (authenticated API clients per role)
  factories.py    # factory-boy factories for all core models
  unit/           # Service logic, models, permissions
  integration/    # API endpoint tests, Celery tasks
```

## Commands

```bash
# Run tests (uses SQLite in-memory, no external deps needed)
python -m pytest tests/

# Run tests with coverage
python -m pytest tests/ --cov=apps --cov-report=term-missing

# Lint
ruff check .

# Run dev server
python manage.py runserver

# Run Celery worker
celery -A config worker -l info

# Run Celery beat
celery -A config beat -l info
```

## Settings

- `config.settings.dev` — local development (DEBUG=True, debug toolbar, console email, DEBUG-level app logs)
- `config.settings.test` — test runs (SQLite :memory:, in-memory channels, eager Celery, fast hasher, logging suppressed)
- `config.settings.prod` — production (reads env vars for DB, Redis, secrets, ERROR-level django.request)

## Logging

Configured in `config/settings/base.py` via Django `LOGGING` dict. Per-module loggers use `logging.getLogger(__name__)`.

- **Request logging**: `config.middleware.RequestLoggingMiddleware` logs method, path, status, duration, user for every HTTP request (skips `/api/health/`)
- **Exception logging**: `config.exceptions` logs unhandled exceptions with tracebacks, 5xx errors
- **Celery logging**: `config.celery` uses signals to log task start/finish/failure
- **App logging**: `apps.tasks.services` (status changes, conflicts), `apps.tasks.consumers` (WS connect/disconnect/auth), `apps.notifications.tasks` (deadline checks, emails), `apps.reports.services` (report generation), `apps.accounts.views` (user create/deactivate)
- **Env vars**: `LOG_LEVEL` (default: INFO), `SQL_LOG_LEVEL` (dev only, default: WARNING)

## Auth & Roles

JWT via `djangorestframework-simplejwt`. Refresh token is set as httpOnly cookie (not in response body); access token returned in JSON body only. Login: `POST /api/auth/token/`, refresh: `POST /api/auth/token/refresh/` (reads cookie), logout: `POST /api/auth/logout/` (clears cookie). Three roles enforced throughout:

- **manager** — full access (CRUD tasks, users, clients, reports, audit history)
- **engineer** — read tasks, read clients; cannot create/update tasks or change status via API
- **client** — portal-only access (own tickets, public comments)

## Key Business Rules

- Task status transitions are validated: `created → in_progress → waiting/done → archived`
- `done → archived` is manager-only
- Task updates use optimistic locking (version field); concurrent edits return 409
- Comments support `@First Last` mention parsing; mentioned users get notifications
- Clients only see `is_public=True` comments
- Deadline warning notifications are sent hourly via Celery beat (deduplicated per 24h window)
