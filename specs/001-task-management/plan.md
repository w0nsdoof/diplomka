# Implementation Plan: Task Management System for IT Outsourcing Teams

**Branch**: `001-task-management` | **Date**: 2026-01-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-task-management/spec.md`

## Summary

Build a web-based task management system for IT outsourcing teams to replace ad-hoc tracking via WhatsApp, Telegram, and phone calls. The system provides task CRUD with status workflow, Kanban board with real-time updates, file attachments, audit logging, comments with @mentions, search/filters, client directory, calendar view, notifications, reports export (PDF/Excel), and a read-only client portal. The backend uses Django 5 + DRF with PostgreSQL 16, Django Channels for WebSocket, and Celery for async jobs. The frontend uses Angular 17 with Angular Material. Podman is used for containerized development.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: Django 5, Django REST Framework, Django Channels, Celery, djangorestframework-simplejwt, drf-spectacular, WeasyPrint, openpyxl; Angular 17, Angular Material, FullCalendar, @angular/localize
**Storage**: PostgreSQL 16 (primary), Redis 7 (Channels layer + Celery broker), local filesystem (file attachments via MEDIA_ROOT)
**Testing**: pytest + pytest-django (backend), Karma + Jasmine via Angular CLI (frontend)
**Target Platform**: Web browsers (Chrome, Firefox, Edge, Safari — latest 2 versions), Linux server deployment
**Project Type**: web (backend + frontend)
**Performance Goals**: API p95 < 300 ms (constitution), search < 2 seconds for 10,000 tasks, 50 concurrent users
**Constraints**: All strings translatable (Russian + English), 70% code coverage minimum, JWT auth on all endpoints, pagination on all list endpoints
**Scale/Scope**: Up to 50 users, 10,000 tasks, 9 Django apps, ~12 Angular feature modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | ruff (Python), ESLint+Prettier (TypeScript) configured in project |
| II. Testing Discipline | PASS | pytest + Angular CLI tests; 70% coverage target; E2E for critical flows |
| III. Security | PASS | JWT via simplejwt on all endpoints; RBAC enforced per role; server-side input validation; no secrets in VCS |
| IV. Performance | PASS | p95 < 300 ms target; pagination on all list endpoints; select_related/prefetch_related; indexed queries |
| V. Localization | PASS | Russian + English via Django gettext + Angular i18n; spec assumption updated to match constitution |
| VI. Database | PASS | PostgreSQL 16; Django migrations only; indexes on filter/sort/FK columns documented in data-model.md |
| VII. Documentation | PASS | drf-spectacular for auto-generated OpenAPI 3.0; request/response examples in contracts |

**Post-Phase 1 re-check**: All principles remain satisfied. The data model includes required indexes (VI), API contracts specify pagination on all list endpoints (IV), and localization is planned for both backend and frontend (V).

## Project Structure

### Documentation (this feature)

```text
specs/001-task-management/
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions and rationale
├── data-model.md        # Phase 1: entity definitions, indexes, validation rules, state machine
├── quickstart.md        # Phase 1: development setup guide
├── contracts/           # Phase 1: API contracts
│   └── api-contracts.md # REST + WebSocket endpoint specifications
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── config/                  # Django project settings
│   ├── settings/
│   │   ├── base.py          # Shared: installed apps, middleware, DRF, JWT, Celery, Channels, i18n
│   │   ├── dev.py           # DEBUG, console email, CORS allow-all
│   │   └── prod.py          # Secure cookies, SMTP email, whitenoise
│   ├── urls.py              # Root URL conf, API router, schema endpoints
│   ├── asgi.py              # ASGI entrypoint (Django Channels routing)
│   ├── wsgi.py              # WSGI entrypoint (gunicorn)
│   └── celery.py            # Celery app configuration
├── apps/
│   ├── accounts/            # Custom User model (email-based), JWT auth, role management
│   ├── tasks/               # Task CRUD, status workflow, assignment, Kanban WebSocket consumer
│   ├── clients/             # Client directory CRUD
│   ├── comments/            # Comments with @mention parsing, public/private visibility
│   ├── tags/                # Tag model, CRUD API for task categorization
│   ├── attachments/         # File upload with type/size validation
│   ├── notifications/       # In-app notifications, email dispatch, Celery tasks for deadlines
│   ├── reports/             # PDF (WeasyPrint) and Excel (openpyxl) generation
│   └── audit/               # Custom AuditLogEntry model, audit log API
├── locale/                  # ru/LC_MESSAGES, en/LC_MESSAGES (.po/.mo files)
├── manage.py
├── requirements/
│   ├── base.txt             # Django, DRF, Channels, Celery, simplejwt, drf-spectacular, etc.
│   ├── dev.txt              # pytest, ruff, factory-boy, django-debug-toolbar
│   └── prod.txt             # gunicorn, sentry-sdk, whitenoise
├── tests/
│   ├── conftest.py          # Shared fixtures
│   ├── unit/                # Service layer and utility tests
│   ├── integration/         # API endpoint tests
│   └── e2e/                 # Critical flow E2E tests
└── Dockerfile

frontend/
├── src/
│   ├── app/
│   │   ├── core/            # AuthService, JWT interceptor, role guards, error handler
│   │   ├── shared/          # Reusable components, pipes, directives
│   │   ├── features/
│   │   │   ├── dashboard/   # KPI widgets, recent activity
│   │   │   ├── tasks/       # Task list, task detail, Kanban board (drag-and-drop)
│   │   │   ├── clients/     # Client list and detail
│   │   │   ├── calendar/    # FullCalendar-based deadline view
│   │   │   ├── reports/     # Report builder and export UI
│   │   │   ├── admin/       # User management (manager only)
│   │   │   └── portal/      # Read-only client portal
│   │   └── app.config.ts    # Standalone bootstrap, providers, routes
│   ├── assets/
│   ├── environments/        # environment.ts, environment.prod.ts
│   └── i18n/                # ru.json, en.json
├── angular.json
├── package.json
├── proxy.conf.json          # Dev proxy to backend API
└── Dockerfile

podman-compose.yml           # Services: db, redis, backend, frontend, celery-worker, celery-beat
.env.example                 # Environment variable template
```

**Structure Decision**: Web application layout with separate `backend/` and `frontend/` directories. The backend follows Django's app-per-domain pattern with 8 apps mapped to the spec's functional areas. The frontend uses Angular's feature-module structure with lazy-loaded routes.

## Complexity Tracking

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Localization override | Constitution requires Russian + English; spec originally said English-only | Constitution is authoritative; spec assumption updated |
| WebSocket + REST dual protocol | Django Channels for real-time Kanban alongside REST API | Necessary for real-time UX per FR-004; Channels is the standard Django approach |
| Celery for async | Background worker for email notifications and report generation | Required to keep API p95 < 300 ms per constitution; email/PDF generation would block requests |

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | [research.md](research.md) | 10 technology decisions with rationale and alternatives |
| Data Model | [data-model.md](data-model.md) | 8 entities, relationships, indexes, validation rules, state machine |
| API Contracts | [contracts/api-contracts.md](contracts/api-contracts.md) | 35 REST endpoints + 1 WebSocket channel with schemas |
| Quickstart | [quickstart.md](quickstart.md) | Development setup guide with podman-compose |
