# Business Logic Overview

## What Is This System?

A **task management platform for IT outsourcing companies**. An IT services company (e.g. "DataSoft Solutions") uses the system to track work it performs for its customers. The platform provides:

- Task tracking with priorities, deadlines, and status workflows
- Team coordination: managers assign tasks to engineers
- Client transparency: customers get portal access to monitor their tickets
- Reporting: AI-generated summaries and exportable PDF/Excel reports
- Real-time updates via WebSockets (kanban board, notifications)
- Full audit trail of every change

## Core Concepts

### Organization (Tenant)

The company that **uses** the system. Each organization is a completely isolated workspace — its users, clients, tasks, tags, and reports are invisible to other organizations.

Example: "DataSoft Solutions" is an organization. All of DataSoft's staff, customers, and work items live inside this tenant.

### Client (Customer of the Organization)

A customer that the organization **does work for**. Clients exist inside an organization and have contact information (name, email, phone, type). Tasks are linked to clients to track which customer the work is being done for.

Example: DataSoft does work for "Kaspersky", "Ozon", and "Sberbank" — each is a Client record inside the DataSoft organization.

### Task

A unit of work. Every task belongs to one organization and optionally links to one client. Tasks have:

- **Priority**: low, medium, high, critical
- **Status**: created, in_progress, waiting, done, archived
- **Deadline**: when the work must be completed
- **Assignees**: one or more engineers responsible for the work
- **Tags**: labels for categorization (e.g. "backend", "urgent", "bug")
- **Attachments**: uploaded files
- **Comments**: discussion thread with @mention support

### Status Workflow

Tasks follow a strict state machine:

```
created  -->  in_progress  -->  done  -->  archived
                  |    ^
                  v    |
               waiting
```

- `done -> archived` is restricted to managers only
- Engineers can only change status on tasks they are assigned to

### Optimistic Locking

Each task has a `version` field. When two people try to update the same task simultaneously, the second update receives a `409 Conflict` error, preventing silent data loss.

## Roles

### Superadmin

**Platform operator**. Exists outside of any organization.

- Manages the platform itself (creating organizations, etc.)
- Has no org-scoped data — cannot see tasks, clients, or reports
- Not involved in day-to-day task management

### Manager

**Team lead / project manager** within an organization. Has full control over the workspace.

| Area | Capabilities |
|------|-------------|
| **Tasks** | Create, update all fields, change any status, assign engineers |
| **Users** | Create, edit, deactivate users in the organization |
| **Clients** | Create, edit, delete client records |
| **Comments** | Create comments (public or internal), view all comments |
| **Attachments** | Upload and delete files |
| **Reports** | Generate PDF/Excel reports, view AI summaries |
| **Audit** | View full change history of any task |
| **Kanban** | Full access to the kanban board |
| **Calendar** | View task deadlines on the calendar |

Typical workflow:
1. Receive a request from a client
2. Create a task, set priority and deadline, link it to the client
3. Assign one or more engineers
4. Monitor progress on the kanban board
5. Review completed work, archive finished tasks
6. Generate weekly/monthly reports for stakeholders

### Engineer

**Technical specialist** who executes the work. Has limited, focused access.

| Area | Capabilities |
|------|-------------|
| **Tasks** | View all tasks in the organization (list + detail) |
| **Status** | Change status only on tasks assigned to them (except done -> archived) |
| **Comments** | Create comments (public or internal), view all comments |
| **Attachments** | Upload files |
| **Kanban** | View and drag tasks on the kanban board |

Cannot: create tasks, edit task fields (title, description, priority, deadline), assign/unassign people, delete attachments, manage users/clients, view reports, or access audit history.

Typical workflow:
1. See assigned tasks on the kanban board
2. Move a task to "in_progress" and start working
3. Add comments with progress updates, attach deliverables
4. Move the task to "done" when finished

### Client (Portal User)

**Customer representative** who monitors work done for their company. Has read-only portal access.

| Area | Capabilities |
|------|-------------|
| **Portal** | View tickets linked to their client company |
| **Comments** | Read public comments only (cannot write) |
| **Attachments** | Download files attached to their tickets |

Cannot: see internal comments, create/edit tasks, change statuses, access kanban/calendar/reports, or see other clients' tickets. Archived tasks are hidden from the portal.

Typical workflow:
1. Log into the portal
2. Check the status of submitted tickets
3. Read public comments from the team
4. Download delivered files

## Comment Visibility

Comments have a `is_public` flag:

- **Public comments** — visible to everyone, including client portal users. Used for customer-facing communication.
- **Internal comments** — visible only to managers and engineers. Used for technical discussion, internal notes, and coordination.

## Notifications

Users receive in-app notifications for:

- Being assigned to / unassigned from a task
- Being @mentioned in a comment
- A new comment on a task they're involved in
- A task status change
- Deadline approaching (hourly check, deduplicated per 24h)
- AI summary report ready

Notifications are delivered in real-time via WebSocket and stored for later viewing.

## AI Summaries

The system automatically generates report summaries using an LLM (via LiteLLM):

- **Daily summary**: generated at 00:05 UTC, covers the previous day
- **Weekly summary**: generated Monday at 06:00 UTC, covers the previous week
- **On-demand**: managers can request a summary for any period

If the LLM is unavailable, the system falls back to a template-based summary. Redis locks prevent duplicate generation for the same period.

## Audit Trail

Every task change is recorded in an immutable audit log:

- Status changes
- Field updates (title, description, priority, deadline, etc.)
- Comments added
- Files attached
- Assignment changes

Only managers can view the audit history. Entries are never deleted or modified.

## Multi-Tenancy Model

Data isolation is enforced at the application level using an `organization` foreign key on all major models:

```
Organization
├── Users (manager, engineer, client)
├── Clients
│   └── Portal Users (client-role users linked to a specific client)
├── Tasks
│   ├── Comments
│   ├── Attachments
│   └── Audit Log Entries
├── Tags
└── Report Summaries
```

Every API query is automatically filtered by the requesting user's organization. A user in Organization A can never see or modify data belonging to Organization B.
