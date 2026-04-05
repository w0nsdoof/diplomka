# Development Guidelines

See [README.md](README.md) for project overview, tech stack, and setup.

## Git Workflow

- **`main`** — stable branch, auto-deploys to production on push
- **Feature branches** — `NNN-feature-name` (e.g. `003-add-caching`)
- Work on feature branch, push, create PR to `main`
- CI runs on PR (lint + test + build); merge triggers deploy
- Never push directly to `main` — always go through a PR

## CI/CD

- **PR to `main`**: runs backend lint (ruff), backend tests (pytest), frontend tests (karma), frontend build
- **Push to `main`**: runs CI, then auto-deploys via SSH to production server
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Deploy uses a dedicated `deploy` user on the server (not root)

## Commands

```bash
# Deploy (manual fallback)
./deploy.sh                    # deploy current branch
./deploy.sh main               # deploy specific branch

# Backend
cd backend && python manage.py runserver
cd backend && python -m pytest tests/
cd backend && ruff check .

# Frontend
cd frontend && npm start       # dev server on :4200
cd frontend && npm run test:ci # headless tests
```

## Code Style

- Python: PEP 8, enforced by `ruff` (config in `backend/pyproject.toml`)
- TypeScript: Angular style guide
- All Angular components use standalone (no NgModules) + `OnPush` change detection

## Deployment

- Script: `deploy.sh` — git-pull based, SSHes to server (`ssh yandex` for manual, `deploy` user for CI)
- Compose file: `docker-compose.yml` with `name: taskmanager`
- Remote `.env` is managed separately on the server (NOT synced from local)
- HTTPS/reverse-proxy is handled by a standalone Caddy instance at `~/reverse-proxy/` on the server (not part of this repo). Domain routing for all services is managed there.

## Issue Tracking

Known bugs and issues are tracked in [ISSUES.md](ISSUES.md). When fixing an issue, remove its row from the table in the same commit as the fix.

## Active Technologies
- Python 3.13 (Django 6.0 / DRF 3.16), Angular 19 (TypeScript 5.8) + Django REST Framework, djangorestframework-simplejwt, LiteLLM, Django Channels, Angular Material 19, factory-boy
- PostgreSQL 16 (shared database, organization FK discriminator), Redis 7 (Celery broker, cache, channel layer)
- Python 3.13, Django 6.0 / DRF 3.16 (backend); TypeScript 5.8, Angular 19 (frontend) + Django REST Framework 3.16, drf-spectacular, Angular Material 19, Angular CDK (007-work-hierarchy)
- Python 3.13 (Django 6.0 / DRF 3.16), TypeScript 5.8 (Angular 19) + LiteLLM (existing), Celery 5.6+ (existing), Redis 7 (existing), Angular Material 19 (existing), drf-spectacular (existing) (008-ai-epic-tasks)
- PostgreSQL 16 (no new models needed — uses existing Task, Epic, User, Tag, Project models) (008-ai-epic-tasks)

## Recent Changes
- project-team: Added `team` M2M field on Project model — managers can assign team members to projects via create/edit forms; team displayed in project detail with avatar pills
- 007-work-hierarchy: Added 4-level work hierarchy (Project → Epic → Task → Subtask), new `projects` Django app, MatTree browser, unified creation dialog, parent breadcrumbs, hierarchy notifications
- 006-telegram-notifications: Updated full stack — Python 3.13, Django 6.0, DRF 3.16, Angular 19, Node 22, Material 19
- 003-multi-tenancy: Added Python 3.11+ (Django 4.2+ / DRF), Angular 17+ (TypeScript) + Django REST Framework, djangorestframework-simplejwt, LiteLLM, Django Channels, Angular Material, factory-boy
