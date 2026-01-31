# Research: Task Management System

**Feature**: 001-task-management
**Date**: 2026-01-31

## Decision Log

### 1. Full-Text Search

**Decision**: PostgreSQL built-in full-text search using `django.contrib.postgres.search` (`SearchVector`, `SearchQuery`, `SearchRank`).

**Rationale**: At the expected scale of ~10,000 tasks, PostgreSQL's native full-text search delivers sub-100 ms query times with proper GIN indexing, well within the constitution's 300 ms p95 requirement. It requires no additional infrastructure, keeps the deployment simple (single database), and integrates natively with Django ORM and DRF filtering. Trigram similarity (`pg_trgm`) can be added later for fuzzy/typo-tolerant matching at zero extra cost.

**Alternatives considered**:
- **django-haystack + Whoosh/Solr**: Adds an abstraction layer and a separate search engine process. Whoosh is pure-Python and slower under concurrency; Solr requires JVM infrastructure. Unnecessary complexity for this dataset size.
- **Elasticsearch / OpenSearch**: Industry-standard for millions of documents, but introduces a separate JVM-based service, index synchronization logic, and operational overhead. Significantly over-engineered for 10,000 tasks. Could be reconsidered if the dataset grows beyond 500,000 records or complex faceted search is needed.

---

### 2. Real-Time Updates (WebSocket Kanban)

**Decision**: Django Channels with a Redis channel layer (`channels_redis`) for WebSocket-based real-time Kanban board updates.

**Rationale**: Django Channels is the canonical async extension for Django, supports WebSocket and background workers natively, and keeps the entire backend in one framework. Redis as the channel layer provides fast pub/sub message brokering and is already needed for Celery (see Decision 4), so it introduces no additional infrastructure. JWT authentication can be verified during the WebSocket handshake via custom middleware.

**Alternatives considered**:
- **Server-Sent Events (SSE)**: Simpler to implement and sufficient for one-way server-to-client push, but Kanban boards benefit from bidirectional communication (drag-and-drop emits events, server broadcasts updates). SSE also lacks native Django framework support, requiring manual async views.
- **Third-party push services (Pusher, Ably)**: Offloads WebSocket infrastructure but introduces external dependency, potential latency, recurring cost, and data-sovereignty concerns for an outsourcing team managing client data.
- **Polling (short/long)**: Adds unnecessary load on the API at scale and introduces visible update latency (seconds), degrading the Kanban UX.

---

### 3. PDF and Excel Export

**Decision**: WeasyPrint for PDF generation; openpyxl for Excel (.xlsx) export.

**Rationale**: WeasyPrint renders HTML/CSS templates to PDF, allowing reuse of Django's template engine and straightforward styling of reports, headers, and tables. This keeps report layouts maintainable by developers familiar with HTML/CSS rather than requiring knowledge of a low-level drawing API. openpyxl is the de facto standard for .xlsx generation in Python, is actively maintained, and supports styling, formulas, and large datasets via write-only mode.

**Alternatives considered**:
- **ReportLab**: Powerful low-level PDF toolkit, but requires imperative canvas-drawing code for layout. More effort to build and maintain tabular task reports compared to WeasyPrint's declarative HTML/CSS approach. ReportLab's free version lacks some advanced features (e.g., paragraph flowing); the commercial version (ReportLab PLUS) has licensing costs.
- **xhtml2pdf**: Simpler than ReportLab but relies on an outdated HTML/CSS rendering engine with poor CSS3 support, leading to layout inconsistencies.
- **pandas + xlsxwriter**: Viable for Excel, but openpyxl is sufficient and avoids pulling in the entire pandas dependency for simple tabular exports.

---

### 4. Email Notifications

**Decision**: Django's built-in email framework (`django.core.mail`) with Celery and Redis as the message broker for asynchronous delivery.

**Rationale**: Django's email backend abstracts SMTP/provider details and integrates with the template engine for HTML emails. Celery offloads email sending to background workers, preventing notification dispatch from blocking API responses and keeping p95 latency under 300 ms. Redis is already deployed for Django Channels (Decision 2), so it doubles as the Celery broker with no extra infrastructure.

**Alternatives considered**:
- **Synchronous email in request/response cycle**: Blocks the HTTP response for 200-500 ms per SMTP call, violating the performance constitution principle. Unacceptable for endpoints that trigger multiple notifications.
- **Django Channels workers for email**: Possible but unconventional; Celery is the established Django ecosystem tool for background tasks, with mature retry logic, rate limiting, and monitoring (Flower).
- **Third-party transactional email APIs (SendGrid, Mailgun)**: Can be used as the Django email backend if needed in production, but the core architecture (Celery + Django mail) remains the same regardless of the underlying provider. This decision does not preclude switching the backend later.

---

### 5. File Storage (Attachments)

**Decision**: Local filesystem storage via Django's `MEDIA_ROOT` with `FileSystemStorage` for development and initial deployment; storage backend is abstracted via Django's `DEFAULT_FILE_STORAGE` setting to allow future migration to S3-compatible storage.

**Rationale**: For a team-internal outsourcing tool, local storage is the simplest option that avoids external service dependencies and keeps data on-premise. Django's storage API provides a clean abstraction, so switching to `django-storages` with an S3-compatible backend (e.g., MinIO for self-hosted, or AWS S3) requires only a settings change, no code modifications. File uploads are constrained to 25 MB with server-side allowlisted MIME types, enforced at both the serializer and web server levels.

**Alternatives considered**:
- **S3-compatible from day one (AWS S3, MinIO)**: Adds infrastructure complexity (bucket provisioning, IAM credentials, network configuration) that is unnecessary at initial scale. Will be adopted when horizontal scaling or multi-server deployment requires shared storage.
- **Django database-backed storage (django-db-file-storage)**: Stores BLOBs in PostgreSQL, which degrades database performance and complicates backups. Not suitable for file attachments.

---

### 6. Audit Logging

**Decision**: `django-simple-history` for model-level change tracking on critical models (Task, Project, User roles, Comments).

**Rationale**: `django-simple-history` creates a parallel history table for each tracked model, recording every insert, update, and delete with the responsible user, timestamp, and full field snapshot. This provides a complete audit trail queryable via the Django ORM, with minimal integration effort (a single `HistoryField` mixin per model). It also supports reverting to previous versions, which is useful for accidental edits.

**Alternatives considered**:
- **django-auditlog**: Stores changes as JSON diffs in a single shared table. More storage-efficient but harder to query for full-state-at-point-in-time reconstruction. Less ergonomic Django admin integration compared to `django-simple-history`.
- **Custom implementation (signals + log table)**: Maximum flexibility but significant development and maintenance effort to replicate what established libraries already provide. Risk of missing edge cases (bulk updates, raw SQL, migrations). Not justified given available mature packages.
- **PostgreSQL triggers**: Database-level triggers capture all changes regardless of application layer, but are harder to maintain (manual DDL violates the constitution's migration-only schema rule), cannot easily capture the acting user, and are invisible to Django's ORM.

---

### 7. Concurrent Edit Handling

**Decision**: Optimistic concurrency control using an integer `version` field on the Task model, enforced at the serializer and view level.

**Rationale**: Optimistic concurrency fits the typical usage pattern where concurrent edits to the same task are infrequent. The client reads a task (including its `version`), submits an update with the version, and the server atomically checks `WHERE id=X AND version=Y` before applying the update. On conflict, the server returns HTTP 409 Conflict, and the frontend prompts the user to reload and retry. This avoids database-level locking overhead and keeps the API stateless.

**Alternatives considered**:
- **Pessimistic locking (`SELECT ... FOR UPDATE`)**: Holds row-level locks during edits, which can cause deadlocks and degraded performance under concurrency. Requires tracking lock ownership and expiry, adding significant complexity. Not warranted for this scale.
- **Last-write-wins (no conflict detection)**: Simplest approach but silently discards edits, leading to data loss. Unacceptable for a task management system where status transitions and assignment changes are critical.
- **Operational Transform / CRDT**: Designed for real-time collaborative text editing (e.g., Google Docs). Massive over-engineering for structured task field updates.

---

### 8. Calendar Integration

**Decision**: Backend exposes date-filtered REST endpoints (tasks by `due_date` range, milestones, deadlines) using DRF query parameter filters. Frontend uses FullCalendar (Angular wrapper: `@fullcalendar/angular`) for calendar visualization.

**Rationale**: Separating the concern cleanly — the backend provides data via standard paginated, filterable endpoints and the frontend handles all calendar rendering — follows REST principles and keeps the backend calendar-agnostic. FullCalendar is the most mature, feature-rich JavaScript calendar library, supporting day/week/month views, drag-and-drop event rescheduling, and extensive customization. Its Angular wrapper is officially maintained and compatible with Angular 17.

**Alternatives considered**:
- **angular-calendar**: A lighter-weight Angular-native calendar component. Fewer features (no built-in drag-and-drop between date cells, limited timeline views) and a smaller community. Sufficient for simple date display but lacking for interactive task rescheduling.
- **Custom calendar component**: Full control but substantial development effort to handle edge cases (timezone handling, recurring events, responsive layout). Not justified when FullCalendar covers all requirements out of the box.
- **Backend-rendered iCal/.ics feeds**: Useful as an addition for external calendar app integration (Outlook, Google Calendar) but not a substitute for an in-app interactive calendar UI.

---

### 9. Localization (Russian / English)

**Decision**: Django `gettext` (`.po`/`.mo` files) for backend string translation; Angular built-in `i18n` with `@angular/localize` for frontend translation. Language preference stored per user in the database and sent via `Accept-Language` header.

**Rationale**: Both frameworks have first-class, battle-tested localization systems that the constitution explicitly mandates (Principle V). Django's `gettext` integrates with `makemessages`/`compilemessages` management commands for maintainable translation workflows. Angular's `i18n` supports compile-time translation with separate bundles per locale, delivering optimal runtime performance. Date and number formatting uses each framework's locale-aware formatters (`django.utils.formats`, Angular `DatePipe`/`DecimalPipe` with locale).

**Alternatives considered**:
- **Angular runtime i18n (ngx-translate / transloco)**: Enables language switching without page reload, but adds a third-party dependency and loads translations at runtime (slightly larger bundle, flash of untranslated content). Could be reconsidered if runtime language switching becomes a hard requirement; for now, per-build localization is simpler and performant.
- **Backend-only localization (server-rendered translations for frontend)**: Would couple frontend rendering to API calls for every translatable string. Defeats the purpose of a single-page Angular application.

---

### 10. API Documentation

**Decision**: `drf-spectacular` for automatic OpenAPI 3.0 schema generation with Swagger UI and ReDoc viewers.

**Rationale**: The constitution (Principle VII) mandates OpenAPI/Swagger documentation auto-generated from code annotations. `drf-spectacular` is the actively maintained successor to `drf-yasg`, produces OpenAPI 3.0 (not the older Swagger 2.0), and integrates with DRF serializers, viewsets, and permissions to generate accurate schemas with minimal manual annotation. It supports `@extend_schema` decorators for fine-grained control over request/response examples and error codes.

**Alternatives considered**:
- **drf-yasg**: Generates Swagger 2.0 (OpenAPI 2.0) only, which is an older specification. The project is in maintenance mode with infrequent updates. `drf-spectacular` is its recommended replacement.
- **Manual OpenAPI YAML/JSON files**: Prohibited by the constitution ("manual schema files are prohibited unless generated tooling cannot cover a case"). Also error-prone and quickly drifts from the actual implementation.
- **FastAPI-style auto-docs**: Would require abandoning Django REST Framework entirely. Not applicable to the chosen tech stack.

---

## Infrastructure Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | PostgreSQL 16 | Primary data store, full-text search |
| Cache / Broker | Redis | Channels layer, Celery broker |
| Task Queue | Celery | Async email, background jobs |
| WebSocket | Django Channels | Real-time Kanban updates |
| Search | PostgreSQL FTS + GIN index | Task search |
| File Storage | Local (MEDIA_ROOT), abstractable to S3 | Attachments |
| PDF Export | WeasyPrint | Report generation |
| Excel Export | openpyxl | Spreadsheet export |
| Audit Trail | django-simple-history | Change tracking |
| API Docs | drf-spectacular | OpenAPI 3.0 |
| Calendar UI | FullCalendar (@fullcalendar/angular) | Task calendar view |
| Containerization | Podman + podman-compose | Development environment |

## Open Questions

1. **Redis high availability**: Single Redis instance is sufficient for development. Evaluate Redis Sentinel or a managed Redis service for production deployment.
2. **Celery monitoring**: Consider deploying Flower or integrating with an observability stack (Prometheus + Grafana) for production task queue monitoring.
3. **S3 migration trigger**: Define the threshold (number of files, total storage size, multi-server deployment) at which local file storage should be migrated to S3-compatible storage.
4. **Runtime language switching**: If stakeholders require instant language switching without reload, re-evaluate `ngx-translate` or `transloco` for the Angular frontend.
