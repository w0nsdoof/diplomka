# API Contracts -- Task Management System

**Version**: 1.0.0
**Date**: 2026-01-31
**Stack**: Django 5 + Django REST Framework, SimpleJWT, Django Channels
**Base URL**: `https://<host>/api/`
**WebSocket URL**: `wss://<host>/ws/`

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication-endpoints)
3. [User Management](#3-user-management)
4. [Tasks](#4-tasks)
5. [Comments](#5-comments)
6. [Attachments](#6-attachments)
7. [Clients](#7-clients)
8. [Tags](#8-tags)
9. [Notifications](#9-notifications)
10. [Reports](#10-reports)
11. [Client Portal](#11-client-portal)
12. [WebSocket -- Kanban Board](#12-websocket--kanban-board)

---

## 1. Conventions

### 1.1 Authentication

All endpoints require a valid JWT access token in the `Authorization` header unless explicitly marked **Public**.

```
Authorization: Bearer <access_token>
```

### 1.2 Roles

| Role       | Code       | Description                          |
|------------|------------|--------------------------------------|
| Manager    | `manager`  | Full CRUD, user management, reports  |
| Engineer   | `engineer` | Work on assigned tasks, comment      |
| Client     | `client`   | View own tickets, public comments    |

### 1.3 Pagination

All list endpoints return paginated responses using the following envelope:

```json
{
  "count": 142,
  "next": "https://host/api/resource/?page=3",
  "previous": "https://host/api/resource/?page=1",
  "results": [ ... ]
}
```

Default page size: **20**. Configurable via `?page_size=` (max 100).

### 1.4 Error Format

```json
{
  "detail": "Human-readable error message.",
  "code": "error_code",
  "errors": {
    "field_name": ["Validation error message."]
  }
}
```

Standard HTTP status codes are used: 200, 201, 204, 400, 401, 403, 404, 409, 422, 500.

### 1.5 Date/Time Format

All datetime fields use ISO 8601: `2026-01-31T14:30:00Z`.

### 1.6 Localization

The `Accept-Language` header (`ru`, `en`) controls the language of error messages and translatable content per the constitution (Russian and English supported from initial release).

---

## 2. Authentication Endpoints

**Prefix**: `/api/auth/`

These endpoints are **Public** (no JWT required).

---

### 2.1 POST `/api/auth/token/`

Obtain a JWT access/refresh token pair.

**Auth**: None (public)
**Roles**: Any registered user

**Request Body**:

| Field      | Type   | Required | Description       |
|------------|--------|----------|-------------------|
| `email`    | string | yes      | User email        |
| `password` | string | yes      | User password     |

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response 200**:

```json
{
  "access": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 401**:

```json
{
  "detail": "No active account found with the given credentials.",
  "code": "authentication_failed"
}
```

---

### 2.2 POST `/api/auth/token/refresh/`

Refresh an expired access token.

**Auth**: None (public)
**Roles**: Any

**Request Body**:

| Field     | Type   | Required | Description    |
|-----------|--------|----------|----------------|
| `refresh` | string | yes      | Refresh token  |

```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200**:

```json
{
  "access": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 401**:

```json
{
  "detail": "Token is invalid or expired.",
  "code": "token_not_valid"
}
```

---

### 2.3 POST `/api/auth/token/verify/`

Verify that a token is still valid.

**Auth**: None (public)
**Roles**: Any

**Request Body**:

| Field   | Type   | Required | Description       |
|---------|--------|----------|-------------------|
| `token` | string | yes      | Access or refresh |

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200**:

```json
{}
```

**Response 401**:

```json
{
  "detail": "Token is invalid or expired.",
  "code": "token_not_valid"
}
```

---

## 3. User Management

**Prefix**: `/api/users/`
**Auth**: JWT required
**Roles**: Manager only (all operations)

---

### 3.1 GET `/api/users/`

List users (paginated).

**Roles**: Manager

**Query Parameters**:

| Param       | Type   | Description                                |
|-------------|--------|--------------------------------------------|
| `page`      | int    | Page number (default: 1)                   |
| `page_size` | int    | Items per page (default: 20, max: 100)     |
| `role`      | string | Filter by role: `manager`, `engineer`, `client` |
| `is_active` | bool   | Filter by active status                    |
| `search`    | string | Full-text search on name, email            |
| `ordering`  | string | Sort field: `email`, `date_joined`, `-date_joined` |

**Response 200**:

```json
{
  "count": 45,
  "next": "https://host/api/users/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "email": "manager@company.com",
      "first_name": "Ivan",
      "last_name": "Petrov",
      "role": "manager",
      "is_active": true,
      "date_joined": "2026-01-15T10:00:00Z",
      "last_login": "2026-01-31T08:30:00Z"
    }
  ]
}
```

---

### 3.2 POST `/api/users/`

Create a new user. No self-registration; only managers can create accounts.

**Roles**: Manager

**Request Body**:

| Field        | Type   | Required | Description                          |
|--------------|--------|----------|--------------------------------------|
| `email`      | string | yes      | Unique email address                 |
| `first_name` | string | yes      | First name                           |
| `last_name`  | string | yes      | Last name                            |
| `role`       | string | yes      | One of: `manager`, `engineer`, `client` |
| `password`   | string | yes      | Min 8 chars, complexity enforced     |
| `client_id`  | int    | no       | Required if role is `client`; links to client org |

```json
{
  "email": "engineer@company.com",
  "first_name": "Alexei",
  "last_name": "Smirnov",
  "role": "engineer",
  "password": "SecurePass!456"
}
```

**Response 201**:

```json
{
  "id": 12,
  "email": "engineer@company.com",
  "first_name": "Alexei",
  "last_name": "Smirnov",
  "role": "engineer",
  "is_active": true,
  "date_joined": "2026-01-31T14:00:00Z",
  "last_login": null
}
```

**Response 400**:

```json
{
  "errors": {
    "email": ["User with this email already exists."],
    "password": ["This password is too common."]
  }
}
```

---

### 3.3 GET `/api/users/{id}/`

Retrieve user details.

**Roles**: Manager

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | User ID     |

**Response 200**:

```json
{
  "id": 12,
  "email": "engineer@company.com",
  "first_name": "Alexei",
  "last_name": "Smirnov",
  "role": "engineer",
  "is_active": true,
  "date_joined": "2026-01-31T14:00:00Z",
  "last_login": "2026-01-31T16:00:00Z",
  "client": null,
  "assigned_tasks_count": 5
}
```

**Response 404**:

```json
{
  "detail": "Not found.",
  "code": "not_found"
}
```

---

### 3.4 PATCH `/api/users/{id}/`

Update user fields. Partial update only.

**Roles**: Manager

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | User ID     |

**Request Body** (all fields optional):

| Field        | Type   | Description                    |
|--------------|--------|--------------------------------|
| `first_name` | string | Updated first name             |
| `last_name`  | string | Updated last name              |
| `role`       | string | Updated role                   |
| `is_active`  | bool   | Activate/deactivate            |
| `password`   | string | New password                   |
| `client_id`  | int    | Updated client org link        |

```json
{
  "first_name": "Alexander",
  "role": "manager"
}
```

**Response 200**: Updated user object (same schema as GET detail).

**Response 400**: Validation errors.

---

### 3.5 DELETE `/api/users/{id}/`

Soft-delete (deactivate) a user. Sets `is_active` to `false`.

**Roles**: Manager

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | User ID     |

**Response 204**: No content.

**Response 404**: User not found.

---

## 4. Tasks

**Prefix**: `/api/tasks/`
**Auth**: JWT required

---

### 4.1 GET `/api/tasks/`

List tasks with filtering, search, and pagination.

**Roles**: Manager -- sees all tasks. Engineer -- sees all tasks (own assignments highlighted). Client -- sees own client's tasks (public info only).

**Query Parameters**:

| Param          | Type   | Description                                              |
|----------------|--------|----------------------------------------------------------|
| `page`         | int    | Page number (default: 1)                                 |
| `page_size`    | int    | Items per page (default: 20, max: 100)                   |
| `status`       | string | Filter: `created`, `in_progress`, `waiting`, `done`, `archived` |
| `priority`     | string | Filter: `low`, `medium`, `high`, `critical`              |
| `deadline_from`| date   | Filter tasks with deadline >= this date (ISO 8601)       |
| `deadline_to`  | date   | Filter tasks with deadline <= this date (ISO 8601)       |
| `assignee`     | int    | Filter by assigned engineer user ID                      |
| `client`       | int    | Filter by client organization ID                         |
| `tags`         | string | Comma-separated tag slugs (e.g., `bug,frontend`)         |
| `search`       | string | Full-text search on title, description                   |
| `ordering`     | string | Sort: `created_at`, `-created_at`, `deadline`, `-deadline`, `priority`, `-priority` |

**Response 200**:

```json
{
  "count": 87,
  "next": "https://host/api/tasks/?page=2",
  "previous": null,
  "results": [
    {
      "id": 42,
      "title": "Fix authentication bug on portal",
      "status": "in_progress",
      "priority": "high",
      "deadline": "2026-02-15T23:59:59Z",
      "created_at": "2026-01-20T09:00:00Z",
      "updated_at": "2026-01-30T14:20:00Z",
      "client": {
        "id": 3,
        "name": "Acme Corp"
      },
      "assignees": [
        {
          "id": 12,
          "first_name": "Alexei",
          "last_name": "Smirnov"
        }
      ],
      "tags": [
        { "id": 1, "name": "bug", "slug": "bug" },
        { "id": 5, "name": "frontend", "slug": "frontend" }
      ],
      "comments_count": 4,
      "attachments_count": 2
    }
  ]
}
```

---

### 4.2 POST `/api/tasks/`

Create a new task.

**Roles**: Manager

**Request Body**:

| Field          | Type     | Required | Description                            |
|----------------|----------|----------|----------------------------------------|
| `title`        | string   | yes      | Task title (max 255 chars)             |
| `description`  | string   | yes      | Detailed description (Markdown)        |
| `priority`     | string   | yes      | `low`, `medium`, `high`, `critical`    |
| `deadline`     | datetime | yes      | Deadline in ISO 8601                   |
| `client_id`    | int      | no       | Client organization ID (optional)      |
| `assignee_ids`| int[]    | no       | Array of engineer user IDs to assign   |
| `tag_ids`      | int[]    | no       | Array of tag IDs                       |

```json
{
  "title": "Implement SSO integration",
  "description": "Integrate SAML-based SSO for the client portal...",
  "priority": "high",
  "deadline": "2026-03-01T23:59:59Z",
  "client_id": 3,
  "assignee_ids": [12, 15],
  "tag_ids": [2, 7]
}
```

**Response 201**:

```json
{
  "id": 88,
  "title": "Implement SSO integration",
  "description": "Integrate SAML-based SSO for the client portal...",
  "status": "created",
  "priority": "high",
  "deadline": "2026-03-01T23:59:59Z",
  "created_at": "2026-01-31T15:00:00Z",
  "updated_at": "2026-01-31T15:00:00Z",
  "created_by": {
    "id": 1,
    "first_name": "Ivan",
    "last_name": "Petrov"
  },
  "client": {
    "id": 3,
    "name": "Acme Corp"
  },
  "assignees": [
    { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" },
    { "id": 15, "first_name": "Maria", "last_name": "Kozlova" }
  ],
  "tags": [
    { "id": 2, "name": "integration", "slug": "integration" },
    { "id": 7, "name": "security", "slug": "security" }
  ],
  "comments_count": 0,
  "attachments_count": 0
}
```

**Response 400**: Validation errors.

---

### 4.3 GET `/api/tasks/{id}/`

Retrieve full task detail including inline comments, attachments list, and recent audit log entries.

**Roles**: Manager -- full access. Engineer -- all tasks (read-only for non-assigned). Client -- if task belongs to their org (public fields only).

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Task ID     |

**Response 200**:

```json
{
  "id": 42,
  "title": "Fix authentication bug on portal",
  "description": "Users report intermittent 401 errors when...",
  "status": "in_progress",
  "priority": "high",
  "deadline": "2026-02-15T23:59:59Z",
  "created_at": "2026-01-20T09:00:00Z",
  "updated_at": "2026-01-30T14:20:00Z",
  "created_by": {
    "id": 1,
    "first_name": "Ivan",
    "last_name": "Petrov"
  },
  "client": {
    "id": 3,
    "name": "Acme Corp"
  },
  "assignees": [
    { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" }
  ],
  "tags": [
    { "id": 1, "name": "bug", "slug": "bug" },
    { "id": 5, "name": "frontend", "slug": "frontend" }
  ],
  "comments": [
    {
      "id": 101,
      "author": { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" },
      "content": "Reproduced the issue. The token refresh endpoint is timing out.",
      "is_public": true,
      "mentions": [1],
      "created_at": "2026-01-25T11:00:00Z"
    }
  ],
  "attachments": [
    {
      "id": 55,
      "filename": "error_screenshot.png",
      "file_size": 245760,
      "content_type": "image/png",
      "uploaded_by": { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" },
      "uploaded_at": "2026-01-25T11:05:00Z",
      "download_url": "/api/tasks/42/attachments/55/"
    }
  ],
  "history": [
    {
      "id": 301,
      "action": "status_change",
      "old_value": "created",
      "new_value": "in_progress",
      "changed_by": { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" },
      "changed_at": "2026-01-22T09:30:00Z"
    }
  ]
}
```

**Response 403**: User does not have access to this task.

**Response 404**: Task not found.

---

### 4.4 PATCH `/api/tasks/{id}/`

Update task fields. Partial update.

**Roles**: Manager only.

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Task ID     |

**Request Body** (all fields optional):

| Field          | Type     | Description                         |
|----------------|----------|-------------------------------------|
| `title`        | string   | Updated title                       |
| `description`  | string   | Updated description                 |
| `priority`     | string   | Updated priority                    |
| `deadline`     | datetime | Updated deadline                    |
| `client_id`    | int      | Updated client org                  |
| `tag_ids`      | int[]    | Replace tags                        |

```json
{
  "priority": "critical",
  "deadline": "2026-02-10T23:59:59Z"
}
```

**Response 200**: Updated task object (same schema as GET detail, without inline comments/attachments/history).

**Response 400**: Validation errors.

**Response 403**: Insufficient permissions.

---

### 4.5 POST `/api/tasks/{id}/status/`

Change task status with transition validation.

**Roles**: Manager -- any valid transition. Engineer -- limited transitions (see below).

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Task ID     |

**Valid Status Transitions**:

| From          | To (allowed)                           |
|---------------|----------------------------------------|
| `created`     | `in_progress`                          |
| `in_progress` | `waiting`, `done`                      |
| `waiting`     | `in_progress`                          |
| `done`        | `in_progress` (reopen), `archived`     |

Engineer-allowed transitions (if assigned): `created` -> `in_progress`, `in_progress` -> `waiting`, `waiting` -> `in_progress`, `in_progress` -> `done`, `done` -> `in_progress`. Only managers can transition `done` -> `archived`.

**Request Body**:

| Field     | Type   | Required | Description                   |
|-----------|--------|----------|-------------------------------|
| `status`  | string | yes      | Target status                 |
| `comment` | string | no       | Reason for status change      |

```json
{
  "status": "done",
  "comment": "Fix implemented and tested locally."
}
```

**Response 200**:

```json
{
  "id": 42,
  "status": "done",
  "previous_status": "in_progress",
  "changed_by": {
    "id": 12,
    "first_name": "Alexei",
    "last_name": "Smirnov"
  },
  "changed_at": "2026-01-31T16:00:00Z",
  "comment": "Fix implemented and tested locally."
}
```

**Response 409**:

```json
{
  "detail": "Invalid status transition from 'created' to 'done'.",
  "code": "invalid_status_transition"
}
```

**Response 403**: User role not allowed this transition.

---

### 4.6 POST `/api/tasks/{id}/assign/`

Assign or reassign engineers to a task.

**Roles**: Manager

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Task ID     |

**Request Body**:

| Field          | Type  | Required | Description                        |
|----------------|-------|----------|------------------------------------|
| `assignee_ids`| int[] | yes      | Array of engineer user IDs         |

```json
{
  "assignee_ids": [12, 15, 22]
}
```

**Response 200**:

```json
{
  "id": 42,
  "assignees": [
    { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" },
    { "id": 15, "first_name": "Maria", "last_name": "Kozlova" },
    { "id": 22, "first_name": "Dmitry", "last_name": "Volkov" }
  ]
}
```

**Response 400**:

```json
{
  "errors": {
    "assignee_ids": ["User with ID 99 does not exist or is not an engineer."]
  }
}
```

---

### 4.7 GET `/api/tasks/{id}/history/`

Retrieve the full audit log for a task.

**Roles**: Manager only

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Task ID     |

**Query Parameters**:

| Param       | Type   | Description                          |
|-------------|--------|--------------------------------------|
| `page`      | int    | Page number (default: 1)             |
| `page_size` | int    | Items per page (default: 20, max: 100) |

**Response 200**:

```json
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 305,
      "action": "field_update",
      "field": "priority",
      "old_value": "high",
      "new_value": "critical",
      "changed_by": {
        "id": 1,
        "first_name": "Ivan",
        "last_name": "Petrov"
      },
      "changed_at": "2026-01-31T14:00:00Z"
    },
    {
      "id": 304,
      "action": "assignment_change",
      "field": "assignees",
      "old_value": null,
      "new_value": "Dmitry Volkov (ID: 22)",
      "changed_by": {
        "id": 1,
        "first_name": "Ivan",
        "last_name": "Petrov"
      },
      "changed_at": "2026-01-31T13:50:00Z"
    },
    {
      "id": 301,
      "action": "status_change",
      "field": "status",
      "old_value": "created",
      "new_value": "in_progress",
      "changed_by": {
        "id": 12,
        "first_name": "Alexei",
        "last_name": "Smirnov"
      },
      "changed_at": "2026-01-22T09:30:00Z"
    }
  ]
}
```

---

## 5. Comments

**Prefix**: `/api/tasks/{task_id}/comments/`
**Auth**: JWT required

---

### 5.1 GET `/api/tasks/{task_id}/comments/`

List comments for a task.

**Roles**: Manager, Engineer -- see all comments. Client -- sees only `is_public: true` comments.

**Path Parameters**:

| Param     | Type | Description |
|-----------|------|-------------|
| `task_id` | int  | Task ID     |

**Query Parameters**:

| Param       | Type   | Description                              |
|-------------|--------|------------------------------------------|
| `page`      | int    | Page number (default: 1)                 |
| `page_size` | int    | Items per page (default: 20, max: 100)   |
| `is_public` | bool   | Filter by visibility (auto-applied for client role) |
| `ordering`  | string | Sort: `created_at`, `-created_at`        |

**Response 200**:

```json
{
  "count": 8,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 101,
      "author": {
        "id": 12,
        "first_name": "Alexei",
        "last_name": "Smirnov",
        "role": "engineer"
      },
      "content": "Reproduced the issue. @Ivan Petrov can you check the logs?",
      "is_public": true,
      "mentions": [
        { "id": 1, "first_name": "Ivan", "last_name": "Petrov" }
      ],
      "created_at": "2026-01-25T11:00:00Z",
      "updated_at": "2026-01-25T11:00:00Z"
    }
  ]
}
```

---

### 5.2 POST `/api/tasks/{task_id}/comments/`

Add a comment to a task. The backend parses `@mentions` from the content field and resolves them to user IDs for notification dispatch.

**Roles**: Manager, Engineer (public or private). Client cannot comment (read-only access per FR-016).

**Path Parameters**:

| Param     | Type | Description |
|-----------|------|-------------|
| `task_id` | int  | Task ID     |

**Request Body**:

| Field       | Type   | Required | Description                                     |
|-------------|--------|----------|-------------------------------------------------|
| `content`   | string | yes      | Comment text; supports `@FirstName LastName` mentions |
| `is_public` | bool   | no       | Default `true`. Managers/engineers can set `false` for internal notes. Clients always `true`. |

```json
{
  "content": "Fixed the timeout issue. @Ivan Petrov please review.",
  "is_public": true
}
```

**Response 201**:

```json
{
  "id": 115,
  "author": {
    "id": 12,
    "first_name": "Alexei",
    "last_name": "Smirnov",
    "role": "engineer"
  },
  "content": "Fixed the timeout issue. @Ivan Petrov please review.",
  "is_public": true,
  "mentions": [
    { "id": 1, "first_name": "Ivan", "last_name": "Petrov" }
  ],
  "created_at": "2026-01-31T16:30:00Z",
  "updated_at": "2026-01-31T16:30:00Z"
}
```

**Response 400**: Validation errors.

**Response 403**: No access to this task.

---

## 6. Attachments

**Prefix**: `/api/tasks/{task_id}/attachments/`
**Auth**: JWT required

---

### 6.1 GET `/api/tasks/{task_id}/attachments/`

List attachments for a task.

**Roles**: Manager, Engineer, Client (own tasks only).

**Path Parameters**:

| Param     | Type | Description |
|-----------|------|-------------|
| `task_id` | int  | Task ID     |

**Query Parameters**:

| Param       | Type | Description                            |
|-------------|------|----------------------------------------|
| `page`      | int  | Page number (default: 1)               |
| `page_size` | int  | Items per page (default: 20, max: 100) |

**Response 200**:

```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 55,
      "filename": "error_screenshot.png",
      "file_size": 245760,
      "content_type": "image/png",
      "uploaded_by": {
        "id": 12,
        "first_name": "Alexei",
        "last_name": "Smirnov"
      },
      "uploaded_at": "2026-01-25T11:05:00Z",
      "download_url": "/api/tasks/42/attachments/55/"
    }
  ]
}
```

---

### 6.2 POST `/api/tasks/{task_id}/attachments/`

Upload a file attachment. Uses `multipart/form-data`.

**Roles**: Manager, Engineer, Client (own tasks only).

**Path Parameters**:

| Param     | Type | Description |
|-----------|------|-------------|
| `task_id` | int  | Task ID     |

**Request Body** (`multipart/form-data`):

| Field  | Type   | Required | Description                    |
|--------|--------|----------|--------------------------------|
| `file` | file   | yes      | The file to upload             |

**File Validation Rules**:

| Rule          | Value                                                                         |
|---------------|-------------------------------------------------------------------------------|
| Max file size | 25 MB (26,214,400 bytes)                                                      |
| Allowed types | `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/csv`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/zip`, `application/x-rar-compressed` |

**Response 201**:

```json
{
  "id": 60,
  "filename": "requirements.pdf",
  "file_size": 1048576,
  "content_type": "application/pdf",
  "uploaded_by": {
    "id": 1,
    "first_name": "Ivan",
    "last_name": "Petrov"
  },
  "uploaded_at": "2026-01-31T17:00:00Z",
  "download_url": "/api/tasks/42/attachments/60/"
}
```

**Response 400**:

```json
{
  "errors": {
    "file": ["File size exceeds 25 MB limit."]
  }
}
```

**Response 422**:

```json
{
  "errors": {
    "file": ["File type 'application/x-executable' is not allowed."]
  }
}
```

---

### 6.3 GET `/api/tasks/{task_id}/attachments/{id}/`

Download an attachment file.

**Roles**: Manager, Engineer, Client (own tasks only).

**Path Parameters**:

| Param     | Type | Description   |
|-----------|------|---------------|
| `task_id` | int  | Task ID       |
| `id`      | int  | Attachment ID |

**Response 200**: Binary file stream with appropriate `Content-Type` and `Content-Disposition` headers.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="requirements.pdf"
```

**Response 404**: Attachment not found.

---

### 6.4 DELETE `/api/tasks/{task_id}/attachments/{id}/`

Delete an attachment.

**Roles**: Manager only.

**Path Parameters**:

| Param     | Type | Description   |
|-----------|------|---------------|
| `task_id` | int  | Task ID       |
| `id`      | int  | Attachment ID |

**Response 204**: No content.

**Response 403**: Only managers can delete attachments.

**Response 404**: Attachment not found.

---

## 7. Clients

**Prefix**: `/api/clients/`
**Auth**: JWT required

---

### 7.1 GET `/api/clients/`

List client organizations.

**Roles**: Manager -- full list. Engineer -- full list (read-only). Client -- own organization only.

**Query Parameters**:

| Param       | Type   | Description                            |
|-------------|--------|----------------------------------------|
| `page`      | int    | Page number (default: 1)               |
| `page_size` | int    | Items per page (default: 20, max: 100) |
| `search`    | string | Search by name, email                  |
| `ordering`  | string | Sort: `name`, `-name`, `created_at`    |

**Response 200**:

```json
{
  "count": 15,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 3,
      "name": "Acme Corp",
      "client_type": "company",
      "phone": "+7-900-123-45-67",
      "email": "contact@acme.com",
      "contact_person": "John Smith",
      "created_at": "2026-01-10T10:00:00Z",
      "tasks_count": 12
    }
  ]
}
```

---

### 7.2 POST `/api/clients/`

Create a new client organization.

**Roles**: Manager

**Request Body**:

| Field            | Type   | Required | Description                              |
|------------------|--------|----------|------------------------------------------|
| `name`           | string | yes      | Organization name (max 255 chars)        |
| `client_type`    | string | yes      | `company` or `individual`                |
| `phone`          | string | no       | Contact phone number                     |
| `email`          | string | no       | Contact email address                    |
| `contact_person` | string | no       | Primary contact name (for companies)     |

```json
{
  "name": "Acme Corp",
  "client_type": "company",
  "phone": "+7-900-123-45-67",
  "email": "contact@acme.com",
  "contact_person": "John Smith"
}
```

**Response 201**:

```json
{
  "id": 16,
  "name": "Acme Corp",
  "client_type": "company",
  "phone": "+7-900-123-45-67",
  "email": "contact@acme.com",
  "contact_person": "John Smith",
  "created_at": "2026-01-31T18:00:00Z",
  "tasks_count": 0
}
```

**Response 400**: Validation errors.

---

### 7.3 GET `/api/clients/{id}/`

Retrieve client detail with task summary.

**Roles**: Manager -- full detail. Engineer -- full detail (read-only). Client -- own org only.

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Client ID   |

**Response 200**:

```json
{
  "id": 3,
  "name": "Acme Corp",
  "client_type": "company",
  "phone": "+7-900-123-45-67",
  "email": "contact@acme.com",
  "contact_person": "John Smith",
  "created_at": "2026-01-10T10:00:00Z",
  "task_summary": {
    "total": 12,
    "created": 3,
    "in_progress": 5,
    "waiting": 2,
    "done": 1,
    "archived": 1
  }
}
```

---

### 7.4 PATCH `/api/clients/{id}/`

Update client organization fields.

**Roles**: Manager

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Client ID   |

**Request Body** (all fields optional):

| Field            | Type   | Description                          |
|------------------|--------|--------------------------------------|
| `name`           | string | Updated name                         |
| `client_type`    | string | Updated type (`company`/`individual`) |
| `phone`          | string | Updated phone                        |
| `email`          | string | Updated email                        |
| `contact_person` | string | Updated contact person               |

**Response 200**: Updated client object (same schema as GET detail).

**Response 400**: Validation errors.

---

### 7.5 GET `/api/clients/{id}/tasks/`

List all tasks for a specific client.

**Roles**: Manager -- full list. Engineer -- full list (read-only). Client -- own org's tasks (public info).

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Client ID   |

**Query Parameters**: Same as GET `/api/tasks/` (status, priority, deadline range, assignee, tags, search, ordering, pagination).

**Response 200**: Paginated task list (same schema as GET `/api/tasks/`).

---

## 8. Tags

**Prefix**: `/api/tags/`
**Auth**: JWT required

---

### 8.1 GET `/api/tags/`

List all available tags.

**Roles**: Manager, Engineer

**Query Parameters**:

| Param       | Type   | Description                            |
|-------------|--------|----------------------------------------|
| `page`      | int    | Page number (default: 1)               |
| `page_size` | int    | Items per page (default: 50, max: 100) |
| `search`    | string | Filter by tag name                     |

**Response 200**:

```json
{
  "count": 18,
  "next": null,
  "previous": null,
  "results": [
    { "id": 1, "name": "bug", "slug": "bug", "color": "#e74c3c" },
    { "id": 2, "name": "integration", "slug": "integration", "color": "#3498db" },
    { "id": 3, "name": "frontend", "slug": "frontend", "color": "#2ecc71" }
  ]
}
```

---

### 8.2 POST `/api/tags/`

Create a new tag.

**Roles**: Manager, Engineer

**Request Body**:

| Field   | Type   | Required | Description                         |
|---------|--------|----------|-------------------------------------|
| `name`  | string | yes      | Tag name (unique, max 50 chars)     |
| `color` | string | no       | Hex color code (default: `#6c757d`) |

```json
{
  "name": "devops",
  "color": "#9b59b6"
}
```

**Response 201**:

```json
{
  "id": 19,
  "name": "devops",
  "slug": "devops",
  "color": "#9b59b6"
}
```

**Response 400**:

```json
{
  "errors": {
    "name": ["Tag with this name already exists."]
  }
}
```

---

### 8.3 DELETE `/api/tags/{id}/`

Delete a tag. Removes it from all associated tasks.

**Roles**: Manager

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Tag ID      |

**Response 204**: No content.

**Response 403**: Only managers can delete tags.

**Response 404**: Tag not found.

---

## 9. Notifications

**Prefix**: `/api/notifications/`
**Auth**: JWT required

---

### 9.1 GET `/api/notifications/`

List notifications for the currently authenticated user.

**Roles**: All authenticated users

**Query Parameters**:

| Param       | Type   | Description                            |
|-------------|--------|----------------------------------------|
| `page`      | int    | Page number (default: 1)               |
| `page_size` | int    | Items per page (default: 20, max: 100) |
| `is_read`   | bool   | Filter: `true` or `false`              |

**Response 200**:

```json
{
  "count": 25,
  "next": "https://host/api/notifications/?page=2",
  "previous": null,
  "results": [
    {
      "id": 501,
      "type": "task_assigned",
      "title": "New task assigned",
      "message": "You have been assigned to task #42: Fix authentication bug on portal",
      "is_read": false,
      "task_id": 42,
      "created_at": "2026-01-31T15:00:00Z"
    },
    {
      "id": 500,
      "type": "mention",
      "title": "You were mentioned",
      "message": "Alexei Smirnov mentioned you in a comment on task #42",
      "is_read": true,
      "task_id": 42,
      "created_at": "2026-01-31T14:30:00Z"
    }
  ]
}
```

**Notification Types**:

| Type              | Description                          |
|-------------------|--------------------------------------|
| `task_assigned`   | User was assigned to a task          |
| `task_unassigned` | User was removed from a task         |
| `status_changed`  | Task status was changed              |
| `comment_added`   | New comment on an assigned task      |
| `mention`         | User was @mentioned in a comment     |
| `deadline_warning`| Task deadline is approaching (24h)   |

---

### 9.2 PATCH `/api/notifications/{id}/read/`

Mark a single notification as read.

**Roles**: All authenticated users (own notifications only)

**Path Parameters**:

| Param | Type | Description     |
|-------|------|-----------------|
| `id`  | int  | Notification ID |

**Request Body**: None.

**Response 200**:

```json
{
  "id": 501,
  "is_read": true
}
```

**Response 404**: Notification not found or does not belong to the current user.

---

### 9.3 POST `/api/notifications/read-all/`

Mark all notifications as read for the current user.

**Roles**: All authenticated users

**Request Body**: None.

**Response 200**:

```json
{
  "updated_count": 12
}
```

---

## 10. Reports

**Prefix**: `/api/reports/`
**Auth**: JWT required
**Roles**: Manager only

---

### 10.1 GET `/api/reports/summary/`

Get aggregated task statistics.

**Roles**: Manager

**Query Parameters**:

| Param       | Type | Description                           |
|-------------|------|---------------------------------------|
| `date_from` | date | Start date for report period (ISO 8601) |
| `date_to`   | date | End date for report period (ISO 8601)   |
| `client_id` | int  | Filter by client organization         |

**Response 200**:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31"
  },
  "tasks": {
    "total": 87,
    "by_status": {
      "created": 15,
      "in_progress": 30,
      "waiting": 12,
      "done": 25,
      "archived": 5
    },
    "by_priority": {
      "low": 10,
      "medium": 35,
      "high": 30,
      "critical": 12
    },
    "created_in_period": 42,
    "closed_in_period": 25,
    "average_resolution_hours": 72.5,
    "overdue": 8
  },
  "by_client": [
    {
      "client_id": 3,
      "client_name": "Acme Corp",
      "total": 12,
      "created": 3,
      "done": 5
    }
  ],
  "by_engineer": [
    {
      "engineer_id": 12,
      "engineer_name": "Alexei Smirnov",
      "assigned": 15,
      "done": 8,
      "average_resolution_hours": 48.2
    }
  ]
}
```

---

### 10.2 GET `/api/reports/export/pdf/`

Export report as a PDF file.

**Roles**: Manager

**Query Parameters**: Same as GET `/api/reports/summary/` (`date_from`, `date_to`, `client_id`).

**Response 200**: Binary PDF stream.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="report_2026-01-01_2026-01-31.pdf"
```

---

### 10.3 GET `/api/reports/export/excel/`

Export report as an Excel file.

**Roles**: Manager

**Query Parameters**: Same as GET `/api/reports/summary/` (`date_from`, `date_to`, `client_id`).

**Response 200**: Binary Excel stream.

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="report_2026-01-01_2026-01-31.xlsx"
```

---

## 11. Client Portal

**Prefix**: `/api/portal/`
**Auth**: JWT required
**Roles**: Client only

---

### 11.1 GET `/api/portal/tickets/`

List tickets (tasks) belonging to the authenticated client's organization.

**Roles**: Client

**Query Parameters**:

| Param       | Type   | Description                            |
|-------------|--------|----------------------------------------|
| `page`      | int    | Page number (default: 1)               |
| `page_size` | int    | Items per page (default: 20, max: 100) |
| `status`    | string | Filter by status: `created`, `in_progress`, `waiting`, `done` |
| `search`    | string | Search by title                        |
| `ordering`  | string | Sort: `created_at`, `-created_at`, `deadline` |

**Response 200**:

```json
{
  "count": 8,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 42,
      "title": "Fix authentication bug on portal",
      "status": "in_progress",
      "priority": "high",
      "deadline": "2026-02-15T23:59:59Z",
      "created_at": "2026-01-20T09:00:00Z",
      "updated_at": "2026-01-30T14:20:00Z",
      "public_comments_count": 3,
      "attachments_count": 2
    }
  ]
}
```

---

### 11.2 GET `/api/portal/tickets/{id}/`

Retrieve ticket detail with public comments only.

**Roles**: Client (own org's tickets only)

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `id`  | int  | Task/Ticket ID |

**Response 200**:

```json
{
  "id": 42,
  "title": "Fix authentication bug on portal",
  "description": "Users report intermittent 401 errors when...",
  "status": "in_progress",
  "priority": "high",
  "deadline": "2026-02-15T23:59:59Z",
  "created_at": "2026-01-20T09:00:00Z",
  "updated_at": "2026-01-30T14:20:00Z",
  "comments": [
    {
      "id": 101,
      "author": {
        "id": 12,
        "first_name": "Alexei",
        "last_name": "Smirnov"
      },
      "content": "Reproduced the issue. We are working on a fix.",
      "created_at": "2026-01-25T11:00:00Z"
    }
  ],
  "attachments": [
    {
      "id": 55,
      "filename": "error_screenshot.png",
      "file_size": 245760,
      "content_type": "image/png",
      "uploaded_at": "2026-01-25T11:05:00Z",
      "download_url": "/api/tasks/42/attachments/55/"
    }
  ]
}
```

**Response 403**: Ticket does not belong to client's organization.

**Response 404**: Ticket not found.

---

## 12. WebSocket -- Kanban Board

**URL**: `wss://<host>/ws/kanban/`
**Protocol**: Django Channels (WebSocket)
**Auth**: JWT token passed as query parameter: `wss://host/ws/kanban/?token=<access_token>`

### 12.1 Connection

The client opens a WebSocket connection with the JWT token. The server authenticates the token and subscribes the user to relevant task updates based on their role:

- **Manager**: Receives updates for all tasks.
- **Engineer**: Receives updates for all tasks.
- **Client**: Receives updates for their organization's tasks.

**Connection success**: The server sends an acknowledgment frame.

```json
{
  "type": "connection_established",
  "user_id": 12,
  "role": "engineer"
}
```

**Connection failure** (invalid/expired token): The server closes the connection with code `4401`.

### 12.2 Server-to-Client Messages

#### Task Status Changed

```json
{
  "type": "task_status_changed",
  "payload": {
    "task_id": 42,
    "title": "Fix authentication bug on portal",
    "previous_status": "in_progress",
    "new_status": "done",
    "changed_by": {
      "id": 12,
      "first_name": "Alexei",
      "last_name": "Smirnov"
    },
    "changed_at": "2026-01-31T16:00:00Z"
  }
}
```

#### Task Created

```json
{
  "type": "task_created",
  "payload": {
    "task_id": 88,
    "title": "Implement SSO integration",
    "status": "created",
    "priority": "high",
    "client": {
      "id": 3,
      "name": "Acme Corp"
    },
    "assignees": [
      { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" }
    ],
    "created_at": "2026-01-31T15:00:00Z"
  }
}
```

#### Task Assigned

```json
{
  "type": "task_assigned",
  "payload": {
    "task_id": 42,
    "title": "Fix authentication bug on portal",
    "assignees": [
      { "id": 12, "first_name": "Alexei", "last_name": "Smirnov" },
      { "id": 15, "first_name": "Maria", "last_name": "Kozlova" }
    ],
    "assigned_by": {
      "id": 1,
      "first_name": "Ivan",
      "last_name": "Petrov"
    },
    "changed_at": "2026-01-31T16:30:00Z"
  }
}
```

#### Task Updated

```json
{
  "type": "task_updated",
  "payload": {
    "task_id": 42,
    "fields_changed": ["priority", "deadline"],
    "task": {
      "id": 42,
      "title": "Fix authentication bug on portal",
      "status": "in_progress",
      "priority": "critical",
      "deadline": "2026-02-10T23:59:59Z"
    },
    "changed_at": "2026-01-31T17:00:00Z"
  }
}
```

#### Task Archived

```json
{
  "type": "task_archived",
  "payload": {
    "task_id": 42,
    "title": "Fix authentication bug on portal",
    "archived_by": {
      "id": 1,
      "first_name": "Ivan",
      "last_name": "Petrov"
    },
    "changed_at": "2026-01-31T17:30:00Z"
  }
}
```

### 12.3 Client-to-Server Messages

#### Subscribe to Specific Client Filter

Allows managers to filter real-time updates to a specific client's tasks.

```json
{
  "type": "subscribe_filter",
  "payload": {
    "client_id": 3
  }
}
```

**Server acknowledgment**:

```json
{
  "type": "filter_applied",
  "payload": {
    "client_id": 3,
    "client_name": "Acme Corp"
  }
}
```

#### Remove Filter

```json
{
  "type": "remove_filter"
}
```

**Server acknowledgment**:

```json
{
  "type": "filter_removed"
}
```

### 12.4 Heartbeat

The server sends a ping every 30 seconds. The client must respond with a pong within 10 seconds or the connection will be closed.

```json
{"type": "ping", "timestamp": "2026-01-31T16:00:30Z"}
```

```json
{"type": "pong"}
```

---

## Appendix A: Status Transition Diagram

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

## Appendix B: Role Permission Matrix

| Endpoint                          | Manager | Engineer       | Client          |
|-----------------------------------|---------|----------------|-----------------|
| POST /auth/token/                 | yes     | yes            | yes             |
| GET /users/                       | yes     | no             | no              |
| POST /users/                      | yes     | no             | no              |
| GET /users/{id}/                  | yes     | no             | no              |
| PATCH /users/{id}/                | yes     | no             | no              |
| DELETE /users/{id}/               | yes     | no             | no              |
| GET /tasks/                       | all     | all            | own org         |
| POST /tasks/                      | yes     | no             | no              |
| GET /tasks/{id}/                  | all     | all            | own org (public)|
| PATCH /tasks/{id}/                | all     | no             | no              |
| POST /tasks/{id}/status/          | all     | limited        | no              |
| POST /tasks/{id}/assign/          | yes     | no             | no              |
| GET /tasks/{id}/history/          | yes     | no             | no              |
| GET /tasks/{id}/comments/         | all     | all            | public only     |
| POST /tasks/{id}/comments/        | yes     | yes            | no              |
| GET /tasks/{id}/attachments/      | all     | all            | own org         |
| POST /tasks/{id}/attachments/     | yes     | yes            | own org         |
| GET /tasks/{id}/attachments/{id}/ | all     | all            | own org         |
| DELETE /tasks/{id}/attachments/{id}/| yes   | no             | no              |
| GET /clients/                     | all     | all            | own org         |
| POST /clients/                    | yes     | no             | no              |
| GET /clients/{id}/                | all     | all            | own org         |
| PATCH /clients/{id}/              | yes     | no             | no              |
| GET /clients/{id}/tasks/          | all     | all            | own org         |
| GET /tags/                        | yes     | yes            | no              |
| POST /tags/                       | yes     | yes            | no              |
| DELETE /tags/{id}/                | yes     | no             | no              |
| GET /notifications/               | own     | own            | own             |
| PATCH /notifications/{id}/read/   | own     | own            | own             |
| POST /notifications/read-all/     | own     | own            | own             |
| GET /reports/summary/             | yes     | no             | no              |
| GET /reports/export/pdf/          | yes     | no             | no              |
| GET /reports/export/excel/        | yes     | no             | no              |
| GET /portal/tickets/              | no      | no             | yes             |
| GET /portal/tickets/{id}/         | no      | no             | own org         |
| WS /ws/kanban/                    | all     | all            | own org         |
