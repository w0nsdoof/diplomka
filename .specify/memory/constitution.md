<!--
Sync Impact Report
===================
- Version change: 1.0.0 → 1.1.0
- Modified principles: None
- Added sections:
  - Principle VIII. UX Consistency (new)
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no updates needed (generic template)
  - .specify/templates/spec-template.md ✅ no updates needed (generic template)
  - .specify/templates/tasks-template.md ✅ no updates needed (generic template)
  - .specify/templates/commands/ — no command files found
- Follow-up TODOs: None
-->

# IT Outsourcing Task Management System Constitution

## Core Principles

### I. Code Quality

All Python code MUST follow PEP 8 and Django best practices.
All Angular frontend code MUST follow the
[Angular Style Guide](https://angular.dev/style-guide).
Linting and formatting tools (flake8/ruff for Python, ESLint/Prettier
for TypeScript) MUST be configured in the project.
No code MUST be merged without passing all linter checks.

### II. Testing Discipline

Minimum 70% code coverage MUST be maintained across the project.
Every service layer class and utility module MUST have unit tests.
Critical user flows (authentication, task creation, task assignment,
status transitions) MUST have end-to-end tests.
Tests MUST pass before merge; CI automation is recommended but not required for initial release.

### III. Security

All API endpoints MUST require JWT-based authentication unless
explicitly marked as public.
Role-based access control (RBAC) MUST be enforced: users MUST only
access resources permitted by their assigned role.
All endpoint inputs MUST be validated and sanitized on the server side.
Secrets and credentials MUST NOT be committed to version control.
OWASP Top 10 vulnerabilities MUST be mitigated by design.

### IV. Performance

API responses MUST complete within 300 ms (p95) under normal load.
All list endpoints MUST support pagination (page-based or cursor-based).
Database queries MUST be optimized: N+1 queries are prohibited;
`select_related`/`prefetch_related` MUST be used where applicable.
Slow queries (>100 ms) MUST be identified and indexed appropriately.

### V. Localization

Russian and English MUST be supported from the initial release.
All user-facing strings MUST use Django's `gettext` / Angular's `i18n`
translation infrastructure — no hardcoded display text.
Locale-specific formatting (dates, numbers) MUST respect the active
language setting.

### VI. Database

PostgreSQL MUST be the primary database engine.
All schema changes MUST be managed via Django migrations; manual DDL
is prohibited.
Indexes MUST be created for columns used in filtering, sorting, and
foreign key lookups.
Migrations MUST be reviewed for backward compatibility before merge.

### VII. Documentation

All API endpoints MUST be documented via OpenAPI/Swagger (drf-spectacular
or equivalent).
The OpenAPI schema MUST be auto-generated from code annotations — manual
schema files are prohibited unless generated tooling cannot cover a case.
Each endpoint's documentation MUST include request/response examples and
error codes.

### VIII. UX Consistency

All UI components MUST use Angular Material as the sole component
library — mixing component libraries is prohibited.
A shared design-token file (colors, typography, spacing, elevation)
MUST be defined and every component MUST reference these tokens
instead of hardcoded values.
Navigation patterns (sidebar, breadcrumbs, back-navigation) MUST be
uniform across all application modules; no module may introduce a
custom navigation scheme without an approved exception.
Interactive feedback MUST follow a single convention: loading spinners
for async operations, snackbar notifications for success/error
outcomes, and inline validation messages for form fields.
All form layouts MUST use a consistent structure: label placement,
field ordering (primary fields first), required-field indicators,
and error-message positioning MUST be identical across every form.
Responsive breakpoints MUST be defined once in a shared stylesheet
and applied consistently; each breakpoint MUST map to a documented
layout adaptation.
Iconography MUST use a single icon set (Material Symbols) with
consistent sizing and weight; ad-hoc icon assets are prohibited.

## Technology Stack & Constraints

- **Backend**: Python 3.11+, Django 4.2+ with Django REST Framework
- **Frontend**: Angular 17+ with TypeScript
- **Database**: PostgreSQL 15+
- **Authentication**: JWT (djangorestframework-simplejwt or equivalent)
- **API Documentation**: drf-spectacular (OpenAPI 3.0)
- **UI Component Library**: Angular Material (sole permitted library)
- **CI/CD**: Linting, tests, and coverage checks SHOULD gate merges when CI is configured
- **Version Control**: Git; feature branches with pull request workflow

## Development Workflow & Quality Gates

- Every feature MUST be developed on a dedicated branch and merged via
  pull request.
- Pull requests MUST pass: linter checks, unit tests, coverage threshold
  (>=70%), and at least one code review approval.
- Database migrations MUST be included in the same PR as the model
  changes they support.
- Localization files MUST be updated when user-facing strings are added
  or changed.
- API documentation MUST be regenerated and verified when endpoints
  change.
- UI changes MUST be reviewed for compliance with Principle VIII
  (UX Consistency) before merge.

## Governance

This constitution is the authoritative source of project standards.
All pull requests and code reviews MUST verify compliance with the
principles defined above.

**Amendment procedure**: Any change to this constitution MUST be
proposed via pull request, reviewed by at least one team lead, and
documented with a version bump following semantic versioning:
- MAJOR: Removal or incompatible redefinition of a principle.
- MINOR: Addition of a new principle or material expansion of guidance.
- PATCH: Clarifications, wording fixes, non-semantic refinements.

**Compliance review**: Principles MUST be revisited at minimum once per
quarter to assess relevance and adherence.

**Version**: 1.1.0 | **Ratified**: 2026-01-31 | **Last Amended**: 2026-01-31
