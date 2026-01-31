# Task Management System for IT Outsourcing Teams — Quickstart Guide

## 1. Prerequisites

Ensure the following tools are installed before proceeding.

| Tool               | Minimum Version | Purpose                                |
|--------------------|-----------------|----------------------------------------|
| Python             | 3.11+           | Django backend runtime                 |
| Node.js            | 18+             | Angular frontend build and dev server  |
| npm                | 9+              | Frontend dependency management         |
| Podman             | 4.0+            | OCI container runtime                  |
| podman-compose     | 1.0+            | Multi-container orchestration          |
| PostgreSQL client  | 16              | Database (runs in container)           |
| Redis client       | 7+              | Cache and message broker (runs in container) |
| Git                | 2.30+           | Version control                        |

> **Note.** PostgreSQL and Redis run inside containers — you do not need to install the servers locally. The client tools (`psql`, `redis-cli`) are optional but helpful for debugging.

---

## 2. Project Structure Overview

```
backend/
├── config/                  # Django project configuration
│   ├── settings/
│   │   ├── base.py          # Shared settings (installed apps, middleware, DRF, JWT, Celery, Channels)
│   │   ├── dev.py           # DEBUG=True, console email backend, CORS allow-all
│   │   └── prod.py          # Production overrides, secure cookies, real SMTP
│   ├── urls.py              # Root URL configuration, API and schema routes
│   ├── asgi.py              # ASGI entrypoint (Django Channels)
│   └── wsgi.py              # WSGI entrypoint (gunicorn)
├── apps/
│   ├── accounts/            # User model, registration, authentication, role management
│   ├── tasks/               # Task CRUD, status workflow (Kanban), assignment logic
│   ├── clients/             # Client directory and client portal access
│   ├── comments/            # Comments on tasks with @mention support
│   ├── attachments/         # File upload handling and storage
│   ├── notifications/       # In-app (WebSocket) and email notifications
│   ├── reports/             # PDF and Excel report generation (Celery tasks)
│   └── audit/               # Audit log for all model changes
├── manage.py
├── requirements/
│   ├── base.txt             # Core dependencies (Django, DRF, Channels, Celery, etc.)
│   ├── dev.txt              # Dev extras (pytest, ruff, factory-boy, django-debug-toolbar)
│   └── prod.txt             # Production extras (gunicorn, sentry-sdk, whitenoise)
└── Dockerfile               # Multi-stage build: Python 3.11-slim

frontend/
├── src/
│   ├── app/
│   │   ├── core/            # AuthService, JWT interceptor, role guards, error handler
│   │   ├── shared/          # Reusable components, pipes, directives
│   │   ├── features/
│   │   │   ├── dashboard/   # KPI widgets, charts, recent activity
│   │   │   ├── tasks/       # Task list (table + filters), task detail, Kanban board
│   │   │   ├── clients/     # Client list and detail views
│   │   │   ├── calendar/    # Calendar view of task deadlines
│   │   │   ├── reports/     # Report builder and export UI
│   │   │   ├── admin/       # User management, role assignment
│   │   │   └── portal/      # Read-only client portal (task status, comments)
│   │   └── app.config.ts    # Standalone app bootstrap, providers, routes
│   ├── assets/              # Static images, icons
│   ├── environments/        # environment.ts, environment.prod.ts
│   └── i18n/                # ru.json, en.json — translation files
├── angular.json
├── package.json
└── Dockerfile               # Multi-stage build: Node 18 -> nginx

podman-compose.yml           # Services: db, redis, backend, frontend, celery-worker, celery-beat
```

---

## 3. Setup Steps

### 3.1 Clone the Repository and Configure Environment

```bash
git clone <repository-url> task-management
cd task-management
cp .env.example .env
```

Edit `.env` and review the default values. The minimum set of variables:

```dotenv
# Database
POSTGRES_DB=taskmanager
POSTGRES_USER=taskmanager
POSTGRES_PASSWORD=changeme
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0

# Django
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_SETTINGS_MODULE=config.settings.dev
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=30
REFRESH_TOKEN_LIFETIME_DAYS=7

# Superuser (created by init script)
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=admin
```

### 3.2 Start All Services

```bash
podman-compose up -d
```

This command starts the following containers:

| Service        | Container Name        | Port  | Description                          |
|----------------|-----------------------|-------|--------------------------------------|
| db             | taskmanager-db        | 5432  | PostgreSQL 16                        |
| redis          | taskmanager-redis     | 6379  | Redis 7 (Channels layer + Celery broker) |
| backend        | taskmanager-backend   | 8000  | Django dev server                    |
| frontend       | taskmanager-frontend  | 4200  | Angular dev server                   |
| celery-worker  | taskmanager-worker    | —     | Celery worker for async tasks        |
| celery-beat    | taskmanager-beat      | —     | Celery Beat for periodic tasks       |

Wait for all containers to become healthy:

```bash
podman-compose ps
```

### 3.3 Run Migrations and Create Superuser

```bash
podman-compose exec backend python manage.py migrate
podman-compose exec backend python manage.py createsuperuser \
    --email admin@example.com --noinput
```

> The `createsuperuser` command reads the password from `DJANGO_SUPERUSER_PASSWORD` in the environment.

### 3.4 Load Initial Data (Optional)

```bash
podman-compose exec backend python manage.py loaddata initial_roles
podman-compose exec backend python manage.py loaddata sample_data
```

This populates the database with default roles (Admin, Manager, Developer, Client) and a small set of sample tasks and clients for local development.

### 3.5 Access Points

| Resource              | URL                                        |
|-----------------------|--------------------------------------------|
| Frontend              | http://localhost:4200                       |
| Backend API           | http://localhost:8000/api/                  |
| Swagger UI            | http://localhost:8000/api/schema/swagger/   |
| ReDoc                 | http://localhost:8000/api/schema/redoc/     |
| Django Admin          | http://localhost:8000/admin/                |
| WebSocket (notifications) | ws://localhost:8000/ws/notifications/   |

### 3.6 Stopping and Cleaning Up

```bash
# Stop all services, keep volumes
podman-compose down

# Stop all services and remove volumes (full reset)
podman-compose down -v
```

---

## 4. Development Workflow

### 4.1 Backend Development

Run the Django development server locally (outside the container) for faster iteration:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt

# Point to containerized PostgreSQL and Redis
export DJANGO_SETTINGS_MODULE=config.settings.dev
export POSTGRES_HOST=localhost
export REDIS_URL=redis://localhost:6379/0

python manage.py runserver 0.0.0.0:8000
```

The development server automatically reloads on file changes.

To run Celery locally:

```bash
celery -A config worker -l info
celery -A config beat -l info
```

### 4.2 Frontend Development

Run the Angular CLI dev server locally with a proxy to the backend:

```bash
cd frontend
npm install
ng serve --proxy-config proxy.conf.json
```

`proxy.conf.json` forwards `/api/*` and `/ws/*` to `localhost:8000`:

```json
{
  "/api": {
    "target": "http://localhost:8000",
    "secure": false
  },
  "/ws": {
    "target": "ws://localhost:8000",
    "secure": false,
    "ws": true
  }
}
```

Angular CLI provides hot module replacement out of the box.

### 4.3 Running Tests

**Backend (pytest):**

```bash
cd backend
pytest                          # all tests
pytest apps/tasks/              # single app
pytest -x --tb=short            # stop on first failure, short traceback
pytest --cov=apps --cov-report=html   # coverage report
```

**Frontend (Karma via Angular CLI):**

```bash
cd frontend
ng test                         # watch mode
ng test --no-watch --code-coverage   # single run with coverage
```

### 4.4 Linting and Formatting

**Backend (ruff):**

```bash
cd backend
ruff check .                    # lint
ruff check . --fix              # auto-fix
ruff format .                   # format
```

**Frontend (ESLint + Prettier):**

```bash
cd frontend
npx eslint "src/**/*.ts"        # lint
npx prettier --check "src/**/*.{ts,html,scss}"   # check formatting
npx prettier --write "src/**/*.{ts,html,scss}"   # auto-format
```

### 4.5 Database Migrations

```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

Always review auto-generated migrations before committing.

### 4.6 API Schema Regeneration

The OpenAPI schema is generated automatically by `drf-spectacular`. To export it:

```bash
cd backend
python manage.py spectacular --file schema.yml
```

---

## 5. Key Configuration Notes

### 5.1 JWT Token Lifetimes

Configured in `config/settings/base.py` via `SIMPLE_JWT`:

```python
from datetime import timedelta
import os

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_LIFETIME_MINUTES", 30))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
```

- Access tokens are short-lived (30 minutes by default) and carried in the `Authorization: Bearer <token>` header.
- Refresh tokens are rotated on every use, with the old token blacklisted.

### 5.2 File Upload Settings

Configured in `config/settings/base.py`:

```python
# Maximum upload size: 25 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

ALLOWED_UPLOAD_EXTENSIONS = [
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".png", ".jpg", ".jpeg", ".gif",
    ".zip", ".rar", ".7z",
    ".txt", ".csv",
]

# Storage backend
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

Uploaded files are validated by extension and size in the `attachments` app serializer. In production, consider serving media through nginx or an S3-compatible object store.

### 5.3 Email Backend

**Development** (`config/settings/dev.py`):

```python
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
```

All emails are printed to the console output.

**Production** (`config/settings/prod.py`):

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.example.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@example.com")
```

### 5.4 Celery Beat Schedule

Configured in `config/settings/base.py`:

```python
from celery.schedules import crontab

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

CELERY_BEAT_SCHEDULE = {
    "check-approaching-deadlines": {
        "task": "apps.notifications.tasks.check_approaching_deadlines",
        "schedule": crontab(minute=0, hour="*/1"),  # every hour
        "description": "Notify assignees about tasks with deadlines within 24 hours.",
    },
    "check-overdue-tasks": {
        "task": "apps.notifications.tasks.check_overdue_tasks",
        "schedule": crontab(minute=0, hour=9),  # daily at 09:00 UTC
        "description": "Send daily digest of overdue tasks to managers.",
    },
    "cleanup-expired-tokens": {
        "task": "apps.accounts.tasks.cleanup_expired_tokens",
        "schedule": crontab(minute=0, hour=3),  # daily at 03:00 UTC
        "description": "Remove expired and blacklisted JWT refresh tokens.",
    },
}
```

### 5.5 Django Channels Layer Configuration

Configured in `config/settings/base.py`:

```python
ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.getenv("REDIS_URL", "redis://localhost:6379/0")],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}
```

WebSocket consumers are routed through `config/asgi.py`. The primary consumer `NotificationConsumer` listens on `ws/notifications/` and delivers real-time updates for task assignments, status changes, mentions, and deadline alerts.

### 5.6 Internationalization (i18n)

The system supports two languages: **Russian** (default) and **English**.

**Backend** (`config/settings/base.py`):

```python
LANGUAGE_CODE = "ru"
LANGUAGES = [
    ("ru", "Russian"),
    ("en", "English"),
]
USE_I18N = True
USE_L10N = True
LOCALE_PATHS = [BASE_DIR / "locale"]
```

**Frontend** (`frontend/src/i18n/`):

Translation files `ru.json` and `en.json` are loaded by Angular's `@ngx-translate/core`. The active language is stored in `localStorage` and sent to the backend via the `Accept-Language` header through an HTTP interceptor.

---

## Quick Reference

```bash
# Full stack start
podman-compose up -d

# View logs
podman-compose logs -f backend
podman-compose logs -f celery-worker

# Run backend tests inside container
podman-compose exec backend pytest

# Run frontend tests inside container
podman-compose exec frontend ng test --no-watch

# Open Django shell
podman-compose exec backend python manage.py shell_plus

# Generate new app
podman-compose exec backend python manage.py startapp <app_name> apps/<app_name>

# Rebuild after dependency changes
podman-compose build --no-cache backend
podman-compose build --no-cache frontend
```
