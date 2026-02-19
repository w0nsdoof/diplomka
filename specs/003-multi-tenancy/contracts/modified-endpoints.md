# Modified Endpoint Contracts

All existing endpoints retain their current request/response schemas. The changes are:

## 1. Authentication

### POST /api/auth/token/ (Login)

**Response change**: Add `organization_id` and handle `superadmin` role.

```json
{
  "access": "eyJ...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "manager",
    "organization_id": 5
  }
}
```

- `organization_id`: integer or null (null for superadmin)
- `role`: now includes `"superadmin"` as possible value

**Behavior change**: If user's organization is inactive, return 401 with `{"detail": "Your organization is currently inactive."}`.

---

## 2. Task Endpoints

### GET /api/tasks/
**Queryset change**: Filtered by `request.user.organization`. No request/response schema change.

### POST /api/tasks/
**Auto-set**: `task.organization = request.user.organization` on creation. No request schema change.

### GET /api/tasks/{id}/
**Queryset change**: Returns 404 if task belongs to different organization. No schema change.

### Nested endpoints (comments, attachments, history)
**Queryset change**: Parent task queryset is organization-scoped. Accessing a task from another org returns 404.

---

## 3. Client Endpoints

### GET /api/clients/
**Queryset change**: Filtered by `request.user.organization`.

### POST /api/clients/
**Auto-set**: `client.organization = request.user.organization`.
**Validation change**: Name uniqueness checked within organization, not globally.

---

## 4. Tag Endpoints

### GET /api/tags/
**Queryset change**: Filtered by `request.user.organization`.

### POST /api/tags/
**Auto-set**: `tag.organization = request.user.organization`.
**Validation change**: Name/slug uniqueness checked within organization.

---

## 5. User Endpoints

### GET /api/users/
**Queryset change**: Managers see only users from their organization. Superadmins cannot access this endpoint (403).

### POST /api/users/
**Auto-set**: `user.organization = request.user.organization`.
**Validation change**: Cannot create superadmin users from this endpoint.

### DELETE /api/users/{id}/ (deactivate)
**New validation**: Cannot deactivate the last active manager in the organization (returns 400).

---

## 6. Summary Endpoints

### GET /api/summaries/
**Queryset change**: Filtered by `request.user.organization`.

### POST /api/summaries/generate/
**Behavior change**: Generates summary using only the requesting user's organization data.

### GET /api/summaries/latest/
**Queryset change**: Returns latest summaries for the user's organization only.

---

## 7. Report Endpoints

### GET /api/reports/summary/
**Queryset change**: `get_report_data()` scoped to user's organization.

### GET /api/reports/export/pdf/ and /api/reports/export/excel/
**Queryset change**: Report data scoped to user's organization.

---

## 8. Notification Endpoints

### GET /api/notifications/
**No change needed**: Already filtered by `recipient=request.user`. Since users are org-scoped, notifications are implicitly org-scoped.

---

## 9. Portal Endpoints

### GET /api/portal/tickets/
**No change needed**: Already filtered by `request.user.client`. Since client users are org-scoped, portal is implicitly org-scoped.

---

## 10. WebSocket

### ws://.../ws/kanban/
**Channel group change**: `kanban_board` → `kanban_board_{organization_id}`
**Connect validation**: Verify user's organization is active. Reject connection if inactive.

---

## Summary of Changes by Type

| Change Type | Affected Endpoints |
|-------------|-------------------|
| Queryset scoping | tasks, clients, tags, users, summaries, reports |
| Auto-set organization | tasks (create), clients (create), tags (create), users (create) |
| Response schema | auth/token (add organization_id) |
| Validation | clients (name per-org), tags (name/slug per-org), users (last manager guard) |
| New behavior | auth (reject inactive org), summaries (per-org generation) |
| No change | notifications, portal (already user-scoped) |
