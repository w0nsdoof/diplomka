# Implementation Plan: AI-Generated Report Summaries

**Branch**: `002-ai-report-summaries` | **Date**: 2026-02-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-ai-report-summaries/spec.md`

## Summary

Add AI-powered report summaries that automatically run on reporting period end (daily at midnight, weekly on Monday) and produce human-readable narrative summaries using an LLM via LiteLLM as the gateway. Summaries are generated asynchronously via Celery tasks, stored persistently, and exposed to managers through a new reports section. Managers can also trigger on-demand summaries for custom date ranges, regenerate existing summaries (with version history), and browse past summaries. When the LLM is unavailable, a template-based fallback produces a basic summary to ensure no reporting gaps.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: Django 5, DRF, Celery, LiteLLM (new), drf-spectacular; Angular 17, Angular Material
**Storage**: PostgreSQL 16 (summaries table), Redis 7 (Celery broker + task locks)
**Testing**: pytest (backend), Karma + Jasmine (frontend)
**Target Platform**: Linux server (Docker containers)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: API list/detail endpoints < 300ms p95; summary generation is async (no latency requirement on generation itself, but target < 60s)
**Constraints**: LLM API calls are external and may fail; fallback mechanism required; max summary length ~2000 words
**Scale/Scope**: Single-tenant system; ~2 summaries/day (1 daily + ~0.14 weekly avg); summary history retained 90+ days

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | New `ai_summaries` Django app follows PEP 8 / Angular Style Guide |
| II. Testing Discipline | PASS | Unit + integration tests for services, tasks, views; 70%+ coverage target |
| III. Security | PASS | All endpoints require JWT + `IsManager` permission; LLM API key stored in env var only |
| IV. Performance | PASS | Summary generation is async (Celery); list/detail endpoints paginated with indexes |
| V. Localization | JUSTIFIED VIOLATION | AI-generated narrative content is English-only per spec. UI chrome (labels, buttons, headers) will use `gettext`/`i18n`. Generating summaries in multiple languages would require separate LLM calls per language, significantly increasing cost and complexity. Can be extended later by passing locale to the prompt. |
| VI. Database | PASS | PostgreSQL, Django migrations, proper indexes on filter/sort columns |
| VII. Documentation | PASS | New endpoints documented via drf-spectacular with request/response examples |
| VIII. UX Consistency | PASS | Angular Material only; snackbar for feedback; consistent form/list patterns |

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-report-summaries/
├── plan.md              # This file
├── research.md          # Phase 0 output - technology research
├── data-model.md        # Phase 1 output - entity design
├── quickstart.md        # Phase 1 output - developer setup guide
├── contracts/           # Phase 1 output - API contracts
│   └── summaries-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   └── ai_summaries/              # NEW Django app
│       ├── __init__.py
│       ├── admin.py               # Admin registration for ReportSummary
│       ├── apps.py                # AppConfig
│       ├── models.py              # ReportSummary model
│       ├── serializers.py         # DRF serializers (list, detail, generate request)
│       ├── services.py            # LLM integration, metrics collection, summary generation
│       ├── prompts.py             # LLM prompt templates (daily, weekly, on-demand)
│       ├── tasks.py               # Celery tasks (generate_daily, generate_weekly, generate_summary)
│       ├── views.py               # API views (list, detail, versions, generate, regenerate)
│       ├── urls.py                # URL routing
│       └── migrations/
├── config/
│   └── settings/
│       └── base.py                # MODIFIED: add ai_summaries to INSTALLED_APPS, LLM settings, Celery beat schedule
└── tests/
    ├── unit/
    │   └── test_ai_summaries_services.py   # Service layer tests
    └── integration/
        ├── test_ai_summaries_api.py        # API endpoint tests
        └── test_ai_summaries_tasks.py      # Celery task tests

frontend/
└── src/app/
    ├── core/services/
    │   └── summary.service.ts              # NEW: Summary API service
    └── features/reports/
        ├── reports.component.ts            # MODIFIED: integrate summary section
        ├── summary-list/                   # NEW: summary history browser
        │   └── summary-list.component.ts
        └── summary-detail/                 # NEW: full summary view with version history
            └── summary-detail.component.ts
```

**Structure Decision**: Web application structure following the existing pattern. New `ai_summaries` app is a standalone Django app within `backend/apps/`, consistent with the existing app organization (accounts, tasks, reports, notifications, etc.). Frontend components are added under the existing `features/reports/` module since summaries are an extension of the reports feature.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| English-only AI summaries (Principle V) | LLM-generated content is inherently language-specific. Generating in both Russian and English would double LLM API costs and require maintaining prompts in two languages. | Could translate after generation, but machine-translated summaries may lose nuance and accuracy. Deferred to future iteration with locale-aware prompts. |
