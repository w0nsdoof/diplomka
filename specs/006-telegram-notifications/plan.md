# Implementation Plan: Telegram Notifications

**Branch**: `006-telegram-notifications` | **Date**: 2026-03-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-telegram-notifications/spec.md`

## Summary

Add Telegram Bot integration so managers and engineers can link their platform accounts to Telegram, toggle notifications on/off, and receive real-time task notifications (create, update, status change, comment, mention, assignment) via Telegram messages. Uses a webhook-based Telegram Bot with verification-code linking flow, backed by Celery for async message delivery.

## Technical Context

**Language/Version**: Python 3.11 (Django 4.2+ / DRF), TypeScript (Angular 17+)
**Primary Dependencies**: Django REST Framework, httpx (direct Telegram Bot API calls), Celery + Redis, Angular Material
**Storage**: PostgreSQL 16 (new models: TelegramLink, TelegramVerificationCode)
**Testing**: pytest (backend), Karma (frontend)
**Target Platform**: Linux server (Docker Compose via podman-compose.yml)
**Project Type**: web (backend + frontend)
**Performance Goals**: Telegram message delivery within 30 seconds of triggering event (SC-002)
**Constraints**: Bot token stored as env var (never committed); webhook endpoint must be public (HTTPS via Caddy); one-to-one Telegram-to-user mapping
**Scale/Scope**: Same user base as existing platform (~hundreds of users per organization)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | Python: ruff, TypeScript: ESLint, Angular Style Guide |
| II. Testing Discipline | PASS | Unit tests for services/models, integration tests for bot webhook |
| III. Security | PASS | JWT-protected API endpoints; bot webhook verified via secret token; RBAC (manager/engineer only); bot token in env var |
| IV. Performance | PASS | Telegram sends are async via Celery; no impact on API response times |
| V. Localization | PASS | All new UI strings via ngx-translate (en.json + ru.json); Telegram messages in user's language |
| VI. Database | PASS | PostgreSQL, Django migrations, indexes on foreign keys and unique constraints |
| VII. Documentation | PASS | New endpoints documented via drf-spectacular |
| VIII. UX Consistency | PASS | Angular Material components, snackbar feedback, consistent form layout |

All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/006-telegram-notifications/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── telegram-api.yaml
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   ├── notifications/
│   │   ├── models.py          # Existing — no changes needed
│   │   ├── services.py        # MODIFY — hook Telegram dispatch after notification creation
│   │   └── tasks.py           # MODIFY — add send_telegram_notification Celery task
│   └── telegram/              # NEW Django app
│       ├── __init__.py
│       ├── admin.py
│       ├── apps.py
│       ├── models.py          # TelegramLink, TelegramVerificationCode
│       ├── serializers.py     # Link/unlink/toggle serializers
│       ├── services.py        # Bot message sending, verification logic
│       ├── views.py           # API endpoints + webhook handler
│       ├── urls.py            # URL routing for telegram endpoints
│       ├── bot.py             # Telegram Bot setup, command handlers
│       ├── tasks.py           # Celery tasks (send message, expire codes)
│       └── tests/
│           ├── __init__.py
│           ├── test_models.py
│           ├── test_services.py
│           ├── test_views.py
│           └── test_bot.py
├── config/
│   ├── settings/base.py       # MODIFY — add 'apps.telegram' to INSTALLED_APPS, env vars
│   └── urls.py                # MODIFY — add telegram URL patterns

frontend/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   └── settings/      # NEW — user settings page
│   │   │       ├── settings.routes.ts
│   │   │       └── settings.component.ts  # Telegram link + toggle UI
│   │   ├── core/
│   │   │   └── services/
│   │   │       └── telegram.service.ts    # NEW — API calls for Telegram
│   │   └── app.routes.ts      # MODIFY — add /settings route
│   └── i18n/
│       ├── en.json            # MODIFY — add telegram/settings keys
│       └── ru.json            # MODIFY — add telegram/settings keys
```

**Structure Decision**: Web application layout (backend + frontend). New `telegram` Django app for clean separation. Notifications app modified minimally to dispatch Telegram messages. New frontend `settings` feature for user settings page (currently none exists).

## Complexity Tracking

No violations — no entries needed.
