# diplomka Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-15

## Active Technologies
- Python 3.11+ (backend), TypeScript 5.x (frontend) + Django 5, Django REST Framework, Django Channels, Celery, djangorestframework-simplejwt, drf-spectacular, WeasyPrint, openpyxl, django-simple-history; Angular 17, Angular Material, FullCalendar, @angular/localize (001-task-management)
- PostgreSQL 16 (primary), Redis 7 (Channels layer + Celery broker), local filesystem (file attachments via MEDIA_ROOT) (001-task-management)
- Python 3.11+ (backend), TypeScript 5.x (frontend) + Django 5, DRF, Celery, LiteLLM (new), drf-spectacular; Angular 17, Angular Material (002-ai-report-summaries)
- PostgreSQL 16 (summaries table), Redis 7 (Celery broker + task locks) (002-ai-report-summaries)

- (001-task-management)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

```bash
# Deploy to remote server (uses git pull, not rsync)
./deploy.sh                    # deploy current branch
./deploy.sh main               # deploy specific branch

# Backend
cd backend && python manage.py runserver
cd backend && python manage.py test

# Frontend
cd frontend && npm start       # dev server on :4200
cd frontend && npm run test:ci # headless tests
```

## Deployment

- Script: `deploy.sh` — git-pull based deployment to remote server (`ssh yandex`)
- Compose file: `podman-compose.yml` with `name: taskmanager` (fixed project name)
- Remote `.env` is managed separately on the server (NOT synced from local)
- First deploy: manually `scp .env` to remote, then add server IP to `DJANGO_ALLOWED_HOSTS`

## Code Style

Follow standard conventions for Python (PEP 8) and TypeScript (Angular style guide)

## Recent Changes
- 002-ai-report-summaries: Added Python 3.11+ (backend), TypeScript 5.x (frontend) + Django 5, DRF, Celery, LiteLLM (new), drf-spectacular; Angular 17, Angular Material
- 001-task-management: Added Python 3.11+ (backend), TypeScript 5.x (frontend) + Django 5, Django REST Framework, Django Channels, Celery, djangorestframework-simplejwt, drf-spectacular, WeasyPrint, openpyxl, django-simple-history; Angular 17, Angular Material, FullCalendar, @angular/localize

- 001-task-management: Added

<!-- MANUAL ADDITIONS START -->

## Issue Tracking

Known bugs and issues are tracked in [ISSUES.md](ISSUES.md). When fixing an issue, remove its row from the table in the same commit as the fix.

<!-- MANUAL ADDITIONS END -->
