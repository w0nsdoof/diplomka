# Data Model: Task Management System

**Spec**: 001-task-management
**Created**: 2026-01-31
**Stack**: Django 5 / PostgreSQL 16

---

## Entities

### 1. User

Extends Django `AbstractUser`. Represents all system actors: managers, engineers,
and client-portal users.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `email` | `EmailField(max_length=254)` | `unique`, used as login identifier |
| `first_name` | `CharField(max_length=150)` | required |
| `last_name` | `CharField(max_length=150)` | required |
| `role` | `CharField(max_length=20)` | choices: `manager`, `engineer`, `client`; required; `db_index=True` |
| `is_active` | `BooleanField` | default `True` |
| `client` | `ForeignKey(Client)` | `on_delete=SET_NULL`, null, blank; required if `role='client'`, links portal user to their organization |
| `date_joined` | `DateTimeField` | auto_now_add |

`USERNAME_FIELD = "email"`. The default `username` field from `AbstractUser` is
removed or ignored; authentication is email-based.

Django's built-in password hashing (`AbstractUser.password`) is used for
credentials. JWT tokens are issued via `djangorestframework-simplejwt`.

---

### 2. Client

External company or individual who submits service requests.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `name` | `CharField(max_length=255)` | required |
| `client_type` | `CharField(max_length=20)` | choices: `company`, `individual`; required |
| `phone` | `CharField(max_length=40)` | blank, optional |
| `email` | `EmailField(max_length=254)` | blank, optional |
| `contact_person` | `CharField(max_length=255)` | blank, optional; primary contact name for companies |
| `created_at` | `DateTimeField` | `auto_now_add` |
| `updated_at` | `DateTimeField` | `auto_now` |

A Client has a reverse relation to Task (`client.tasks`) and to
one or more User records with `role='client'` that represent portal accounts
(linked via `User.client` FK).

---

### 3. Task

Central entity representing a work item.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `title` | `CharField(max_length=255)` | required |
| `description` | `TextField` | required |
| `priority` | `CharField(max_length=10)` | choices: `low`, `medium`, `high`, `critical`; required; `db_index=True` |
| `status` | `CharField(max_length=20)` | choices: `created`, `in_progress`, `waiting`, `done`, `archived`; default `created`; `db_index=True` |
| `deadline` | `DateTimeField` | required |
| `client` | `ForeignKey(Client)` | `on_delete=SET_NULL`, null, blank; `db_index=True` |
| `created_by` | `ForeignKey(User)` | `on_delete=PROTECT`, related_name `created_tasks` |
| `created_at` | `DateTimeField` | `auto_now_add` |
| `updated_at` | `DateTimeField` | `auto_now` |
| `version` | `PositiveIntegerField` | default `1`; used for optimistic concurrency control |

**Many-to-many relations** (see Relationships section):

- `assignees` -> User (engineers assigned to the task)
- `tags` -> Tag

---

### 4. Comment

Text entry on a task. Supports `@mention` references and a public/private
visibility flag (clients see only public comments).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `task` | `ForeignKey(Task)` | `on_delete=CASCADE`, related_name `comments` |
| `author` | `ForeignKey(User)` | `on_delete=PROTECT`, related_name `comments` |
| `content` | `TextField` | required, min length 1 |
| `is_public` | `BooleanField` | default `True` |
| `created_at` | `DateTimeField` | `auto_now_add` |

**Many-to-many relations**:

- `mentions` -> User (users referenced via @mention syntax)

---

### 5. Attachment

File linked to a task. Maximum 25 MB per file; allowed types are enforced at
the application layer (see Validation Rules).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `task` | `ForeignKey(Task)` | `on_delete=CASCADE`, related_name `attachments` |
| `file` | `FileField` | upload_to `attachments/%Y/%m/` |
| `original_filename` | `CharField(max_length=255)` | required |
| `file_size` | `PositiveIntegerField` | bytes; required |
| `content_type` | `CharField(max_length=100)` | MIME type; required |
| `uploaded_by` | `ForeignKey(User)` | `on_delete=PROTECT`, related_name `attachments` |
| `uploaded_at` | `DateTimeField` | `auto_now_add` |

---

### 6. Tag

Label for categorising tasks (e.g., "bug", "CRM", "hardware").

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `name` | `CharField(max_length=50)` | `unique`, required |
| `slug` | `SlugField(max_length=60)` | `unique`, auto-generated from `name` |
| `color` | `CharField(max_length=7)` | blank, optional; hex colour code e.g. `#FF5733` |

---

### 7. Notification

System-generated alert delivered to a user when a relevant event occurs.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `recipient` | `ForeignKey(User)` | `on_delete=CASCADE`, related_name `notifications` |
| `event_type` | `CharField(max_length=30)` | choices: `task_assigned`, `task_unassigned`, `mention`, `comment_added`, `status_changed`, `deadline_warning`; required; `db_index=True` |
| `task` | `ForeignKey(Task)` | `on_delete=CASCADE`, related_name `notifications` |
| `message` | `TextField` | required |
| `is_read` | `BooleanField` | default `False`; `db_index=True` |
| `created_at` | `DateTimeField` | `auto_now_add`; `db_index=True` |

---

### 8. AuditLogEntry

Immutable record of every change made to a task. Rows are insert-only; updates
and deletes are prohibited at the application layer.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `BigAutoField` | PK |
| `task` | `ForeignKey(Task)` | `on_delete=CASCADE`, related_name `audit_log` |
| `actor` | `ForeignKey(User)` | `on_delete=SET_NULL`, null; the user who performed the action |
| `action` | `CharField(max_length=30)` | choices: `status_change`, `field_update`, `comment_added`, `file_attached`, `assignment_change`; required |
| `field_name` | `CharField(max_length=100)` | blank, optional; name of the changed field (for `field_update`) |
| `old_value` | `TextField` | blank, optional |
| `new_value` | `TextField` | blank, optional |
| `timestamp` | `DateTimeField` | `auto_now_add`; `db_index=True` |

---

## Relationships

### Foreign Keys

| Source | Field | Target | on_delete | Notes |
|--------|-------|--------|-----------|-------|
| Task | `client` | Client | `SET_NULL` | A task may optionally belong to a client |
| Task | `created_by` | User | `PROTECT` | Creator must not be deleted while tasks exist |
| Comment | `task` | Task | `CASCADE` | Comments are deleted with their task |
| Comment | `author` | User | `PROTECT` | Author reference is preserved |
| Attachment | `task` | Task | `CASCADE` | Attachments are deleted with their task |
| Attachment | `uploaded_by` | User | `PROTECT` | Uploader reference is preserved |
| Notification | `recipient` | User | `CASCADE` | Notifications are deleted if user is removed |
| Notification | `task` | Task | `CASCADE` | Notifications are deleted if task is removed |
| AuditLogEntry | `task` | Task | `CASCADE` | Audit log follows the task lifecycle |
| AuditLogEntry | `actor` | User | `SET_NULL` | Actor preserved as null if user is deleted |

### Many-to-Many

| Relation | From | To | Through Table | Notes |
|----------|------|----|---------------|-------|
| Task assignees | Task | User | `task_assignees` (auto) | Engineers assigned to a task |
| Task tags | Task | Tag | `task_tags` (auto) | Tags applied to a task |
| Comment mentions | Comment | User | `comment_mentions` (auto) | Users @mentioned in a comment |

Django generates the join tables automatically. No extra fields are required on
the through tables, so explicit through models are not needed.

**Implicit join tables created by Django**:

```
task_assignees
  - id          BigAutoField  PK
  - task_id     BigInt        FK -> Task
  - user_id     BigInt        FK -> User
  UNIQUE (task_id, user_id)

task_tags
  - id          BigAutoField  PK
  - task_id     BigInt        FK -> Task
  - tag_id      BigInt        FK -> Tag
  UNIQUE (task_id, tag_id)

comment_mentions
  - id          BigAutoField  PK
  - comment_id  BigInt        FK -> Comment
  - user_id     BigInt        FK -> User
  UNIQUE (comment_id, user_id)
```

---

## Indexes

Per constitution principle VI, indexes MUST be created for columns used in
filtering, sorting, and foreign key lookups. The following indexes are required
beyond the default PK and FK indexes that Django creates automatically.

### Task

| Index Name | Columns | Type | Rationale |
|------------|---------|------|-----------|
| `ix_task_status` | `status` | B-tree | Kanban board grouping, status filter |
| `ix_task_priority` | `priority` | B-tree | Priority filter and sort |
| `ix_task_deadline` | `deadline` | B-tree | Deadline sort, overdue query, calendar view |
| `ix_task_created_at` | `created_at` | B-tree | Default sort order |
| `ix_task_client` | `client_id` | B-tree | Client filter (auto from FK) |
| `ix_task_status_priority` | `status`, `priority` | B-tree (composite) | Combined filter on task lists |
| `ix_task_status_deadline` | `status`, `deadline` | B-tree (composite) | Overdue tasks per status |
| `ix_task_search` | `title`, `description` | GIN (`pg_trgm`) | Full-text / trigram search (FR-008) |

Full-text search implementation: create a `SearchVectorField` or use a GIN
index with `pg_trgm` extension on `title` and `description` for trigram-based
search. Client name search is handled via a JOIN to the Client table.

### Notification

| Index Name | Columns | Type | Rationale |
|------------|---------|------|-----------|
| `ix_notification_recipient_unread` | `recipient_id`, `is_read` | B-tree (composite) | Unread notifications per user |
| `ix_notification_created_at` | `created_at` | B-tree | Sort by recency |

### AuditLogEntry

| Index Name | Columns | Type | Rationale |
|------------|---------|------|-----------|
| `ix_audit_task` | `task_id` | B-tree | Task history lookup (auto from FK) |
| `ix_audit_timestamp` | `timestamp` | B-tree | Chronological sort |
| `ix_audit_task_timestamp` | `task_id`, `timestamp` | B-tree (composite) | Task history sorted by time |

### Comment

| Index Name | Columns | Type | Rationale |
|------------|---------|------|-----------|
| `ix_comment_task` | `task_id` | B-tree | Comments per task (auto from FK) |
| `ix_comment_created_at` | `created_at` | B-tree | Chronological sort |

### Tag

| Index Name | Columns | Type | Rationale |
|------------|---------|------|-----------|
| `ix_tag_slug` | `slug` | B-tree (unique) | Lookup by slug (auto from unique) |

### User

| Index Name | Columns | Type | Rationale |
|------------|---------|------|-----------|
| `ix_user_role` | `role` | B-tree | Filter users by role |
| `ix_user_email` | `email` | B-tree (unique) | Login lookup (auto from unique) |

---

## Validation Rules

### Task

| Rule | Enforcement | Reference |
|------|-------------|-----------|
| `title` is required, max 255 chars | Model + serializer | FR-001 |
| `description` is required | Model + serializer | FR-001 |
| `priority` must be one of `low`, `medium`, `high`, `critical` | Model choices | FR-001 |
| `deadline` is required and must be a valid datetime | Model + serializer | FR-001 |
| `deadline` in the past triggers a warning but does not block creation | Serializer (non-blocking warning) | Edge case |
| `status` transitions must follow the state machine (see below) | Service layer | FR-003 |
| `version` must match the current DB value on update (optimistic lock) | Service layer: `filter(id=pk, version=expected).update(version=F('version')+1)` returns 0 rows on conflict | FR-021 |
| Only managers can create tasks | Permission class | FR-016 |
| Only managers can archive tasks | Permission class | FR-018 |
| Engineers can change status only on tasks where they are in `assignees` | Permission class | FR-016 |
| Tasks cannot be deleted; archive only | Permission class (no `destroy` action) | FR-018 |

### Attachment

| Rule | Enforcement | Reference |
|------|-------------|-----------|
| `file_size` <= 25 MB (26,214,400 bytes) | Serializer + upload handler | FR-005 |
| `content_type` must match allowlist | Serializer | FR-005 |
| Allowed MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`, `text/csv`, `application/zip`, `application/x-rar-compressed` | Constant list | FR-005 |

### Comment

| Rule | Enforcement | Reference |
|------|-------------|-----------|
| `content` must not be empty | Serializer | FR-007 |
| `mentions` must reference existing, active users | Serializer | FR-007 |
| Client-role users see only comments with `is_public=True` | QuerySet filter in view | FR-020 |

### User

| Rule | Enforcement | Reference |
|------|-------------|-----------|
| `email` must be unique and valid | Model `unique=True` + `EmailField` | FR-017 |
| `role` must be one of `manager`, `engineer`, `client` | Model choices | FR-016 |
| Only managers can create user accounts | Permission class | FR-022 |
| No self-registration | Endpoint not exposed publicly | FR-022 |

### Client

| Rule | Enforcement | Reference |
|------|-------------|-----------|
| `name` is required | Model + serializer | FR-011 |
| `client_type` must be `company` or `individual` | Model choices | FR-011 |
| At least one contact method (`phone` or `email`) should be provided | Serializer warning (soft validation) | FR-011 |

### Tag

| Rule | Enforcement | Reference |
|------|-------------|-----------|
| `name` must be unique (case-insensitive) | Model `unique=True` + save-time normalization | FR-010 |
| `slug` is auto-generated from `name` via `slugify` | Model `save()` override | FR-010 |
| `color`, if provided, must be a valid 7-char hex code (`#RRGGBB`) | Serializer regex validator | FR-010 |

---

## State Machine: Task Status

```
                    +-----------+
                    |  Created  |
                    +-----+-----+
                          |
                          v
                  +-------+--------+
          +------>|  In Progress   |<------+
          |       +---+--------+---+       |
          |           |        |           |
          |           v        v           |
          |    +------+-+  +---+------+    |
          |    | Waiting |  |   Done   |   |
          |    +------+--+  +--+----+--+   |
          |           |        |    |      |
          |           +--------+    |      |
          |        (back to IP)     |      |
          |                         |      |
          +-------------------------+      |
              (reopen: Done->IP)           |
                                           v
                                    +------+-----+
                                    |  Archived  |
                                    +------------+
                                     (terminal)
```

### Transition Table

| From | To | Allowed Roles | Notes |
|------|----|---------------|-------|
| `created` | `in_progress` | Manager, Engineer (if assigned) | Engineer starts work |
| `in_progress` | `waiting` | Manager, Engineer (if assigned) | Blocked on external input |
| `waiting` | `in_progress` | Manager, Engineer (if assigned) | Blocker resolved |
| `in_progress` | `done` | Manager, Engineer (if assigned) | Work completed |
| `done` | `in_progress` | Manager, Engineer (if assigned) | Reopen |
| `done` | `archived` | Manager only | Terminal state |

Any transition not listed above MUST be rejected with a `400 Bad Request`
and a message describing the valid transitions from the current status.

Every successful transition MUST create an `AuditLogEntry` with
`action='status_change'`, `field_name='status'`, `old_value`, and `new_value`.

---

## Role-Based Access Control Summary

| Resource | Manager | Engineer | Client |
|----------|---------|----------|--------|
| Task - create | Yes | No | No |
| Task - read (all) | Yes | Yes | Own tickets only |
| Task - update fields | Yes | No | No |
| Task - change status | Yes | Assigned tasks only | No |
| Task - archive | Yes | No | No |
| Comment - create | Yes | Yes (all tasks) | No (read-only per FR-016) |
| Comment - read | All | All | Public only |
| Attachment - upload | Yes | Yes (all tasks) | No |
| Attachment - read | Yes | All | Own tickets only |
| Client - CRUD | Yes | No | No |
| Tag - create/edit | Yes | Yes | No |
| User - create | Yes | No | No |
| Notification - read | Own | Own | Own |
| Audit Log - read | Yes | No (manager only) | No |

---

## Optimistic Concurrency Control

The `Task.version` field prevents lost updates when two users edit the same task
concurrently (FR-021).

**Protocol**:

1. Client reads a task and receives `version=N` in the response.
2. Client sends an update request including `version=N`.
3. Server executes:
   ```python
   rows = Task.objects.filter(pk=task_id, version=N).update(
       version=F('version') + 1,
       **validated_fields,
   )
   ```
4. If `rows == 0`, the task was modified by another user since it was read.
   Return `409 Conflict` with the current task state so the client can retry.
5. If `rows == 1`, the update succeeded.

This approach uses a single atomic SQL statement and avoids explicit locking.

---

## Notes on Django Implementation

- **AbstractUser**: Subclass with `USERNAME_FIELD = "email"` and custom manager
  that uses `email` instead of `username` for `create_user` / `create_superuser`.
- **Choices**: Define as `TextChoices` enums (e.g., `class Role(models.TextChoices)`).
- **Soft delete**: Tasks are never deleted; `archived` status serves this purpose.
  `AuditLogEntry` rows are never deleted or modified.
- **select_related / prefetch_related**: All list views must use these to avoid
  N+1 queries (constitution principle IV). Key prefetches: `Task.assignees`,
  `Task.tags`, `Task.client`, `Comment.mentions`.
- **Migrations**: All schema changes via Django migrations; no manual DDL
  (constitution principle VI).
- **pg_trgm**: Requires `CREATE EXTENSION IF NOT EXISTS pg_trgm;` in a RunSQL
  migration before the trigram index migration.
