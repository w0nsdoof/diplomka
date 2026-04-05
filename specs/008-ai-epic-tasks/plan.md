# Implementation Plan: AI Auto-Generation of Tasks from Epic

**Branch**: `008-ai-epic-tasks` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-ai-epic-tasks/spec.md`

## Summary

Managers can trigger AI-powered task generation from an Epic detail page. The system collects Epic context (title, description, priority, deadline, tags), project context, and team member profiles with tag-filtered completed task history, then sends this to an LLM (via the existing LiteLLM integration) to generate a set of tasks with smart assignee suggestions. Generation runs asynchronously via Celery with frontend polling. The manager previews, edits, and confirms tasks before creation. Existing notification flows handle assignment alerts.

## Technical Context

**Language/Version**: Python 3.13 (Django 6.0 / DRF 3.16), TypeScript 5.8 (Angular 19)
**Primary Dependencies**: LiteLLM (existing), Celery 5.6+ (existing), Redis 7 (existing), Angular Material 19 (existing), drf-spectacular (existing)
**Storage**: PostgreSQL 16 (no new models needed — uses existing Task, Epic, User, Tag, Project models)
**Testing**: pytest (backend), Karma/Jasmine (frontend)
**Target Platform**: Web application (Django backend + Angular SPA frontend)
**Project Type**: Web (backend + frontend)
**Performance Goals**: Task generation completes in <30s (hard timeout 60s); preview display is instant once data arrives
**Constraints**: LLM response parsing must be robust; max 15 tasks per generation; Redis lock prevents concurrent generation per Epic
**Scale/Scope**: Single Epic at a time; project teams typically 2-15 members; organization tag sets typically 10-50 tags

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Code Quality | PASS | Python: PEP 8 + ruff. TypeScript: Angular style guide + ESLint. All new code follows existing patterns. |
| II | Testing Discipline | PASS | New Celery task + service functions will have unit tests. E2E test for generate-preview-confirm flow. Target >=70% coverage. |
| III | Security | PASS | JWT auth on all endpoints. Manager-only permission via `IsManager`. Validate assignee IDs against project team. Sanitize LLM output server-side. No secrets in code. |
| IV | Performance | PASS | Async via Celery avoids blocking. DB queries use `select_related`/`prefetch_related` for team+history. Tag-history query is bounded (max 5 tasks per member). API responses (non-LLM) under 300ms. |
| V | Localization | PASS | All new UI strings via `@ngx-translate`. Backend error messages use standard DRF patterns. LLM prompt in English (output is structural, not user-facing text beyond task titles/descriptions). |
| VI | Database | PASS | No new models or migrations. Uses existing Task model via standard ORM create. No manual DDL. |
| VII | Documentation | PASS | New endpoints documented via drf-spectacular `@extend_schema` decorators. Request/response examples included. |
| VIII | UX Consistency | PASS | Angular Material only. "Generate Tasks" button follows existing action button patterns. Loading spinner for async. Snackbar for success/error. Preview dialog uses existing dialog patterns (MatDialog, 800px width). Editable form fields consistent with existing task creation forms. |

**Gate Result: ALL PASS** — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/008-ai-epic-tasks/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI contract for new endpoints
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   ├── projects/
│   │   ├── views.py             # New: generate_epic_tasks action on EpicViewSet
│   │   ├── serializers.py       # New: EpicGenerateTasksSerializer, GeneratedTaskPreviewSerializer
│   │   ├── urls_epics.py        # No change needed — @action endpoints auto-routed by DefaultRouter
│   │   └── services/
│   │       └── ai_tasks.py      # New: LLM prompt building, context collection, response parsing
│   ├── tasks/
│   │   ├── serializers.py       # Reuse: TaskCreateSerializer for bulk creation
│   │   └── views.py             # Existing: task creation + notifications
│   ├── ai_summaries/
│   │   ├── tasks.py             # Reference: Celery + Redis lock pattern
│   │   └── services.py          # Reference: call_llm() function (reusable)
│   └── notifications/
│       └── services.py          # Reuse: create_notification()
└── tests/
    ├── unit/
    │   └── test_ai_tasks_service.py    # New: prompt building, response parsing, assignee matching
    └── integration/
        └── test_ai_epic_tasks.py       # New: full API flow tests

frontend/
├── src/app/
│   ├── features/projects/components/
│   │   ├── epic-detail/
│   │   │   └── epic-detail.component.ts/.html  # Modified: add "Generate Tasks" button
│   │   └── ai-task-preview/
│   │       └── ai-task-preview-dialog.component.ts/.html/.scss  # New: preview/edit/confirm dialog
│   └── core/services/
│       └── project.service.ts           # Modified: add generateTasks() and pollTaskGeneration() methods
```

**Structure Decision**: Web application (Option 2). New backend code lives in `apps/projects/` since task generation is an Epic action. The AI service module (`services/ai_tasks.py`) is placed under projects to keep domain logic co-located. The `call_llm()` utility from `ai_summaries` is imported directly (not duplicated). Frontend adds a new dialog component and extends the existing project service.

## Complexity Tracking

> No constitution violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
