# Research: Organization-Based Multi-Tenancy

**Feature Branch**: `003-multi-tenancy`
**Date**: 2026-02-19

## R1. Multi-Tenancy Architecture Pattern

**Decision**: Shared database with organization foreign key (discriminator column)

**Rationale**:
- The spec targets tens of organizations, not thousands. Schema-per-tenant or database-per-tenant adds operational complexity (migrations, connections) with no benefit at this scale.
- Django's ORM natively supports FK-based filtering. Every queryset can chain `.filter(organization=user.organization)`.
- A shared database keeps existing migrations, fixtures, and test infrastructure intact.
- All existing data migrates to a single "default" organization with one data migration.

**Alternatives considered**:
- **Schema-per-tenant** (e.g., django-tenants): Powerful isolation but requires PostgreSQL schema management, complicates migrations, and is overkill for <100 tenants. Also adds a hard dependency on a third-party library.
- **Database-per-tenant**: Maximum isolation but multiplies infrastructure (connection pooling, backups, migration orchestration). Not viable for a single-server deployment.

---

## R2. Organization Scoping Enforcement

**Decision**: View-level mixin (`OrganizationQuerySetMixin`) that overrides `get_queryset()` in DRF ViewSets

**Rationale**:
- Explicit and auditable: every ViewSet that inherits the mixin is visibly scoped.
- DRF-idiomatic: `get_queryset()` is the standard extension point. When the queryset excludes other orgs, DRF naturally returns 404 (not 403) for cross-tenant access, satisfying FR-004.
- Testable: unit tests can verify that a viewset's queryset is filtered correctly.
- No global magic: middleware-based or model manager approaches hide behavior and risk accidental bypass.

**Implementation**:
```python
class OrganizationQuerySetMixin:
    """Mixin for DRF viewsets that scopes querysets to the requesting user's organization."""

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superadmin:
            return qs.none()  # Superadmins don't access org-scoped data
        return qs.filter(organization=user.organization)
```

**Alternatives considered**:
- **Custom model manager**: `OrganizationManager` that always requires an org parameter. Risk: easy to accidentally call `Model.objects.all()` bypassing the filter. Also complicates admin, shell, and migration code.
- **Middleware setting `request.organization`**: Implicit; easy to miss in new views. Harder to test.
- **django-cte or RLS (Row-Level Security)**: PostgreSQL RLS is powerful but opaque to Django ORM, complicates testing, and doesn't work with Django admin or management commands.

---

## R3. Session Invalidation on Organization Deactivation

**Decision**: Check `user.organization.is_active` during JWT authentication (custom authentication backend)

**Rationale**:
- JWT tokens are stateless; we can't revoke them without a blacklist. But we can reject them at validation time.
- Extending `JWTAuthentication.authenticate()` to check organization status adds one DB query (cacheable) per request.
- This is simpler than maintaining a token blacklist and covers all endpoints uniformly.
- Access tokens have a 30-minute lifetime, so the worst-case delay is 30 minutes (acceptable per spec).

**Implementation**:
- Override `JWTAuthentication.authenticate()` to call `super()`, then check `user.organization.is_active` (for non-superadmin users). Raise `AuthenticationFailed` if inactive.
- Cache the org status check in Redis with a short TTL (60s) to avoid per-request DB hits.

**Alternatives considered**:
- **Token blacklist** (djangorestframework-simplejwt blacklist app): Requires a database table for blacklisted tokens, periodic cleanup, and explicit blacklisting when org is deactivated. More moving parts.
- **Short-lived tokens only**: Already using 30-min access tokens. Could reduce to 5 min, but that increases refresh frequency and doesn't guarantee immediate cutoff.

---

## R4. Superadmin Role Design

**Decision**: Add `superadmin` as a fourth role choice on the existing User model

**Rationale**:
- The existing `role` CharField with choices (manager, engineer, client) is the established pattern. Adding `superadmin` as a choice keeps the pattern consistent.
- `organization` FK will be nullable; superadmin users have `organization=None`.
- Permissions can check `user.role == 'superadmin'` or a helper property `user.is_superadmin`.
- No need for a separate model or table; the superadmin is still a User with JWT auth.

**Implementation**:
- Add `SUPERADMIN = "superadmin"` to role choices.
- Add property `is_superadmin` on User model.
- Superadmins bypass organization scoping (they don't have an org).
- Superadmins have their own routes (`/platform/`) and cannot access org-scoped endpoints.

**Alternatives considered**:
- **Separate SuperadminProfile model**: Over-engineering; the superadmin is just a user with elevated permissions, not a different entity.
- **Use Django's `is_superuser` flag**: Conflates Django admin access with platform admin. Our superadmin is a business role, not a Django admin role. Better to keep them separate.

---

## R5. Migration Strategy

**Decision**: Multi-step migration with zero downtime

**Rationale**:
- Adding a non-nullable FK to existing tables with data requires a staged approach.
- Step 1: Add nullable FK + create Organization model.
- Step 2: Data migration creates default org and backfills all FKs.
- Step 3: Alter FK to non-nullable (except User.organization which stays nullable for superadmin).
- This is the standard Django pattern for adding required FKs to populated tables.

**Migration sequence**:
1. `0001_create_organization_model.py` - Creates Organization table
2. `0002_add_organization_fk_nullable.py` - Adds nullable organization FK to User, Client, Task, Tag, ReportSummary
3. `0003_backfill_default_organization.py` - RunPython: creates "Default Organization", backfills all rows
4. `0004_enforce_organization_constraints.py` - Makes FKs non-nullable (except User), adds unique_together constraints, adds indexes

**Alternatives considered**:
- **Single migration**: Risky; if backfill fails, rollback is complex.
- **Squashed migration**: Could be done post-development but staged approach is safer during development.

---

## R6. Frontend Routing for Superadmin

**Decision**: Separate route tree under `/platform/` with dedicated guard and layout

**Rationale**:
- Spec explicitly requires superadmin UI to be separate from org workspace (FR-007, Clarification session).
- A separate route tree avoids polluting existing org-scoped routes with superadmin logic.
- Superadmins see a different nav (organizations list) instead of the org workspace nav.
- The existing LayoutComponent can conditionally render different nav items based on role, or a separate PlatformLayoutComponent can be used.

**Implementation**:
- Add `/platform` route tree with `superadminGuard`
- Reuse LayoutComponent with role-based nav filtering (already has `roles` array on nav items)
- Add nav items: "Organizations" for superadmin role
- Login redirects superadmin to `/platform/organizations`

**Alternatives considered**:
- **Separate Angular app**: Massive overhead for a few CRUD screens. Not justified.
- **Django admin for superadmin**: Breaks the SPA experience and requires separate auth. The spec wants it in the same app.

---

## R7. WebSocket Scoping

**Decision**: Add organization filtering to the Kanban WebSocket consumer

**Rationale**:
- Currently, the kanban WebSocket broadcasts all task changes to a single `kanban_board` group.
- With multi-tenancy, each organization needs its own group: `kanban_board_{org_id}`.
- The consumer must validate the user's organization on connect and join only their org's group.

**Implementation**:
- Change channel group name to `kanban_board_{organization_id}`
- Validate user's org on WebSocket connect
- Broadcast to org-specific group in `_broadcast_task_event()`

---

## R8. Celery Scheduled Tasks Scoping

**Decision**: Iterate over active organizations in scheduled tasks

**Rationale**:
- Daily and weekly summary tasks currently generate a single summary.
- With multi-tenancy, they must generate one summary per active organization.
- Each organization's summary generation is independent; failures don't block others (FR-013, SC-005).

**Implementation**:
```python
def generate_daily_summary():
    for org in Organization.objects.filter(is_active=True):
        generate_summary.delay(period_type="daily", ..., organization_id=org.id)
```
- Redis lock key changes from `summary:{type}:{date}` to `summary:{type}:{date}:{org_id}`
- `collect_metrics()` gets an `organization_id` parameter to scope queries

---

## R9. Client Name Uniqueness Scoping

**Decision**: Change `name` unique constraint from global to `unique_together = ("name", "organization")`

**Rationale**:
- FR-011 requires client names to be unique within an organization but allows duplicates across organizations.
- This is a standard Django constraint change.
- The existing global uniqueness will be replaced in the migration.

---

## R10. Tag Name/Slug Uniqueness Scoping

**Decision**: Change `name` and `slug` unique constraints from global to `unique_together` with organization

**Rationale**:
- FR-012 requires tags to be scoped to an organization.
- Same pattern as Client name uniqueness.
- `unique_together = [("name", "organization"), ("slug", "organization")]`
