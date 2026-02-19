# Implementation Plan: Organization-Based Multi-Tenancy

**Branch**: `003-multi-tenancy` | **Date**: 2026-02-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-multi-tenancy/spec.md`

## Summary

Add organization-based multi-tenancy so each company operates as an independent workspace. Every non-superadmin user belongs to exactly one organization. All data (tasks, clients, tags, comments, attachments, reports, summaries) is isolated per organization. A platform-level superadmin creates organizations and seeds them with managers. Implementation uses a shared-database pattern with organization foreign keys and a view-level queryset mixin for scoping enforcement.

## Technical Context

**Language/Version**: Python 3.11+ (Django 4.2+ / DRF), Angular 17+ (TypeScript)
**Primary Dependencies**: Django REST Framework, djangorestframework-simplejwt, LiteLLM, Django Channels, Angular Material, factory-boy
**Storage**: PostgreSQL 16 (shared database, organization FK discriminator), Redis 7 (Celery broker, cache, channel layer)
**Testing**: pytest (backend), Karma + Jasmine (frontend)
**Target Platform**: Linux server (Docker Compose), Web browser
**Project Type**: Web application (backend + frontend)
**Performance Goals**: API responses < 300ms p95; organization FK indexed for efficient filtering
**Constraints**: Zero downtime migration; existing tests must pass unchanged; no cross-tenant data leakage
**Scale/Scope**: Tens of organizations (not thousands); ~20 modified endpoints, ~6 new endpoints, 2 new Angular pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | Python: ruff enforced. Angular: style guide followed. All new code follows existing patterns. |
| II. Testing Discipline | PASS | New backend tests for org scoping, platform API, migration. Frontend tests for new components. Coverage >= 70%. |
| III. Security | PASS | Core of this feature: JWT auth unchanged, RBAC extended with superadmin role, organization scoping at data-access level (not just UI). FR-004 enforced via queryset filtering (404, not 403). |
| IV. Performance | PASS | Organization FK indexed. Queryset `.filter(organization=X)` adds one indexed condition. No N+1 queries. Pagination on all list endpoints. |
| V. Localization | PASS | New user-facing strings (org names, error messages, nav labels) use Django gettext / Angular i18n. |
| VI. Database | PASS | PostgreSQL. All changes via Django migrations. Indexes on new FKs. Migration reviewed for backward compatibility (multi-step with nullable → backfill → enforce). |
| VII. Documentation | PASS | New endpoints documented via drf-spectacular serializers. OpenAPI contract in `contracts/platform-api.yaml`. |
| VIII. UX Consistency | PASS | Angular Material only. Platform admin pages follow existing patterns (mat-table, mat-card, mat-form-field). Nav items use Material Symbols. Snackbar for feedback. |

**Post-Phase-1 Re-check**: All principles remain PASS. The shared-database approach with view-level mixin keeps the architecture simple and auditable.

## Project Structure

### Documentation (this feature)

```text
specs/003-multi-tenancy/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 research decisions
├── data-model.md        # Phase 1 output — entity changes and migration plan
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/
│   ├── platform-api.yaml       # OpenAPI 3.0 for new platform endpoints
│   └── modified-endpoints.md   # Changes to existing endpoint contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   ├── organizations/              # NEW app
│   │   ├── models.py               # Organization model
│   │   ├── admin.py                # Django admin registration
│   │   ├── mixins.py               # OrganizationQuerySetMixin
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py     # Create Organization table
│   │   │   └── 0002_backfill_default_org.py  # Data migration
│   │   └── management/
│   │       └── commands/
│   │           └── createsuperadmin.py  # Management command
│   │
│   ├── platform/                   # NEW app — superadmin API
│   │   ├── views.py                # OrganizationViewSet
│   │   ├── serializers.py          # Org + Manager serializers
│   │   ├── urls.py                 # /api/platform/ routes
│   │   └── permissions.py          # IsSuperadmin
│   │
│   ├── accounts/                   # MODIFIED
│   │   ├── models.py               # + organization FK, superadmin role
│   │   ├── permissions.py          # + IsSuperadmin, updated IsManager
│   │   ├── serializers.py          # + organization_id in token/user
│   │   └── migrations/             # + FK migration
│   │
│   ├── clients/                    # MODIFIED
│   │   ├── models.py               # + organization FK, scoped uniqueness
│   │   ├── views.py                # + OrganizationQuerySetMixin
│   │   └── migrations/             # + FK migration
│   │
│   ├── tasks/                      # MODIFIED
│   │   ├── models.py               # + organization FK
│   │   ├── views.py                # + OrganizationQuerySetMixin
│   │   ├── services.py             # + org-scoped broadcast
│   │   └── migrations/             # + FK migration
│   │
│   ├── tags/                       # MODIFIED
│   │   ├── models.py               # + organization FK, scoped uniqueness
│   │   ├── views.py                # + OrganizationQuerySetMixin
│   │   └── migrations/             # + FK migration
│   │
│   ├── ai_summaries/               # MODIFIED
│   │   ├── models.py               # + organization FK
│   │   ├── views.py                # + OrganizationQuerySetMixin
│   │   ├── services.py             # + org parameter in metrics collection
│   │   ├── tasks.py                # + per-org scheduled generation
│   │   └── migrations/             # + FK migration
│   │
│   ├── reports/                    # MODIFIED
│   │   ├── views.py                # + org-scoped report data
│   │   └── services.py             # + org parameter in get_report_data()
│   │
│   └── notifications/              # MINIMAL CHANGE
│       └── (no model change; already user-scoped)
│
├── config/
│   ├── authentication.py           # NEW — custom JWT auth checking org.is_active
│   ├── settings/base.py            # + organizations and platform in INSTALLED_APPS
│   └── urls.py                     # + /api/platform/ include
│
└── tests/
    ├── unit/
    │   ├── test_organization_model.py     # NEW
    │   └── test_organization_mixin.py     # NEW
    ├── integration/
    │   ├── test_platform_api.py           # NEW — superadmin org/manager CRUD
    │   ├── test_data_isolation.py         # NEW — cross-org access tests
    │   └── test_migration.py              # NEW — verify default org backfill
    └── factories.py                       # + OrganizationFactory, updated existing factories

frontend/
├── src/app/
│   ├── app.routes.ts                      # + /platform routes
│   ├── core/
│   │   ├── guards/auth.guard.ts           # + superadminGuard
│   │   ├── services/
│   │   │   ├── auth.service.ts            # + organization_id, superadmin handling
│   │   │   └── organization.service.ts    # NEW — platform API calls
│   │   └── components/
│   │       ├── layout/layout.component.ts # + superadmin nav items
│   │       └── login/login.component.ts   # + superadmin redirect
│   │
│   └── features/
│       └── platform/                      # NEW feature module
│           ├── platform.routes.ts
│           ├── components/
│           │   ├── organization-list/     # Org table with stats
│           │   ├── organization-detail/   # Org detail + manager management
│           │   └── organization-form/     # Create org dialog/form
│           └── services/ (uses organization.service.ts from core)
```

**Structure Decision**: Web application with existing `backend/` + `frontend/` layout. Two new Django apps (`organizations` for the model/mixin, `platform` for the superadmin API). One new Angular feature module (`platform/`). All existing apps modified to add organization FK and scoping mixin.

## Complexity Tracking

No constitution violations to justify. The implementation follows established patterns:
- Organization FK is a standard Django foreign key
- OrganizationQuerySetMixin is a simple mixin (no metaclass magic, no middleware)
- Superadmin is a role choice on the existing User model (no separate model)
- Migration uses standard Django RunPython for backfill
