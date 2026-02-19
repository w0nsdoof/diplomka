# Data Model: Organization-Based Multi-Tenancy

**Feature Branch**: `003-multi-tenancy`
**Date**: 2026-02-19

## New Entity

### Organization

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | AutoField (PK) | | |
| name | CharField(255) | unique, not blank | Organization display name |
| slug | SlugField(255) | unique, auto from name | URL-safe identifier |
| is_active | BooleanField | default=True, db_index | Deactivated orgs deny all user access |
| created_at | DateTimeField | auto_now_add | |
| updated_at | DateTimeField | auto_now | |

**Indexes**: `name` (unique), `slug` (unique), `is_active`
**Relationships**: One-to-many with User, Client, Task, Tag, ReportSummary

---

## Modified Entities

### User (accounts.User)

| Change | Field | Type | Constraints | Notes |
|--------|-------|------|-------------|-------|
| ADD | organization | ForeignKey(Organization) | nullable, on_delete=PROTECT, db_index | Null only for superadmin |
| MODIFY | role | CharField choices | Add `superadmin` choice | Choices: superadmin, manager, engineer, client |

**New choices**: `SUPERADMIN = "superadmin"` added to `ROLE_CHOICES`
**New property**: `is_superadmin` → `self.role == self.SUPERADMIN`
**Validation**: Non-superadmin users MUST have organization set. Superadmins MUST have organization=None.
**Constraint**: `email` remains globally unique (FR-016)

---

### Client (clients.Client)

| Change | Field | Type | Constraints | Notes |
|--------|-------|------|-------------|-------|
| ADD | organization | ForeignKey(Organization) | not null, on_delete=CASCADE, db_index | Required |
| MODIFY | name | CharField(255) | unique_together with organization (was globally unique) | Duplicates allowed across orgs |

**Removed constraints**: `unique=True` on `name`
**Added constraints**: `unique_together = [("name", "organization")]`

---

### Task (tasks.Task)

| Change | Field | Type | Constraints | Notes |
|--------|-------|------|-------------|-------|
| ADD | organization | ForeignKey(Organization) | not null, on_delete=CASCADE, db_index | Auto-set from creator's org |

**Auto-set logic**: `task.organization = request.user.organization` on creation
**Indexes**: Add `organization` to existing composite indexes where beneficial

---

### Tag (tags.Tag)

| Change | Field | Type | Constraints | Notes |
|--------|-------|------|-------------|-------|
| ADD | organization | ForeignKey(Organization) | not null, on_delete=CASCADE, db_index | Required |
| MODIFY | name | CharField(50) | unique_together with organization (was globally unique) | |
| MODIFY | slug | SlugField(60) | unique_together with organization (was globally unique) | |

**Removed constraints**: `unique=True` on `name`, `unique=True` on `slug`
**Added constraints**: `unique_together = [("name", "organization"), ("slug", "organization")]`

---

### ReportSummary (ai_summaries.ReportSummary)

| Change | Field | Type | Constraints | Notes |
|--------|-------|------|-------------|-------|
| ADD | organization | ForeignKey(Organization) | not null, on_delete=CASCADE, db_index | Required |

**Indexes**: Update composite index `(period_type, period_start, period_end)` to include `organization`

---

### Unchanged Entities (Scoped Through Parent)

| Entity | Scoping Strategy | Reason |
|--------|-----------------|--------|
| Comment | Via `comment.task.organization` | Always accessed through task; task queryset is already scoped |
| Attachment | Via `attachment.task.organization` | Same as Comment |
| AuditLogEntry | Via `entry.task.organization` | Same as Comment |
| Notification | Via `notification.recipient` (user is org-scoped) | Already filtered by recipient user |

These entities do NOT get a direct organization FK. They are implicitly scoped through their parent relationships.

---

## State Transitions

### Organization Lifecycle

```
Active (default) ──deactivate──► Inactive
       ▲                              │
       └──────reactivate──────────────┘
```

- **Active → Inactive**: Superadmin deactivates. All org users denied access on next API request (JWT auth class checks `organization.is_active` on every request).
- **Inactive → Active**: Superadmin reactivates. Users can log in again.
- **No deletion**: Organizations are never deleted (FR-019).

### Manager Deactivation Guard

```
Manager deactivation request
    │
    ├── Other active managers exist in org? → Allow deactivation
    │
    └── Last active manager? → Block with error (FR-017)
         └── Only superadmin can override
```

---

## Validation Rules

| Rule | Entity | Condition |
|------|--------|-----------|
| Organization name unique | Organization | `name` is globally unique |
| Email globally unique | User | `email` is unique across all orgs (FR-016) |
| Non-superadmin requires org | User | `role != superadmin` → `organization IS NOT NULL` |
| Superadmin has no org | User | `role == superadmin` → `organization IS NULL` |
| Client name unique per org | Client | `(name, organization)` unique together |
| Tag name unique per org | Tag | `(name, organization)` unique together |
| Tag slug unique per org | Tag | `(slug, organization)` unique together |
| Task org from creator | Task | `organization = created_by.organization` on create |
| Summary org required | ReportSummary | `organization IS NOT NULL` |
| Last manager protection | User | Cannot deactivate last active manager in org (non-superadmin) |

---

## Migration Plan

### Step 1: Create Organization Model
```
apps/organizations/migrations/0001_initial.py
- Create Organization table (name, slug, is_active, created_at, updated_at)
```

### Step 2: Add Nullable FKs
```
accounts/migrations/XXXX_add_organization_fk.py
- Add User.organization (nullable FK)
- Add 'superadmin' to role choices

clients/migrations/XXXX_add_organization_fk.py
- Add Client.organization (nullable FK)

tasks/migrations/XXXX_add_organization_fk.py
- Add Task.organization (nullable FK)

tags/migrations/XXXX_add_organization_fk.py
- Add Tag.organization (nullable FK)

ai_summaries/migrations/XXXX_add_organization_fk.py
- Add ReportSummary.organization (nullable FK)
```

### Step 3: Data Migration
```
organizations/migrations/0002_backfill_default_organization.py (RunPython)
- Create "Default Organization" (slug: "default")
- Set all User.organization = default (except superusers)
- Set all Client.organization = default
- Set all Task.organization = default
- Set all Tag.organization = default
- Set all ReportSummary.organization = default
- Convert existing is_superuser users to role=superadmin, organization=null
```

### Step 4: Enforce Constraints
```
Per-app migrations:
- User.organization: keep nullable (superadmin)
- Client.organization: NOT NULL, unique_together(name, organization), drop name unique
- Task.organization: NOT NULL
- Tag.organization: NOT NULL, unique_together(name, org), unique_together(slug, org), drop name unique, drop slug unique
- ReportSummary.organization: NOT NULL
- Add indexes on organization FKs
```

---

## ER Diagram (Text)

```
Organization (1) ─────┬──── (N) User
                       │         ├── role: superadmin|manager|engineer|client
                       │         └── client FK (for portal users)
                       │
                       ├──── (N) Client
                       │         └── tasks (reverse FK from Task)
                       │
                       ├──── (N) Task
                       │         ├── created_by (User FK)
                       │         ├── assignees (M2M User)
                       │         ├── tags (M2M Tag)
                       │         ├── client (Client FK)
                       │         ├── comments (Comment 1:N)
                       │         ├── attachments (Attachment 1:N)
                       │         └── audit_log (AuditLogEntry 1:N)
                       │
                       ├──── (N) Tag
                       │
                       └──── (N) ReportSummary
                                  └── requested_by (User FK)
```
