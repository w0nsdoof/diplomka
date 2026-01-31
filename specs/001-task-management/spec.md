# Feature Specification: Task Management System for IT Outsourcing Teams

**Feature Branch**: `001-task-management`
**Created**: 2026-01-31
**Status**: Draft
**Input**: User description: "Build a task management web system for IT outsourcing teams"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manager Creates and Assigns a Task (Priority: P1)

A manager receives a client request (via phone, WhatsApp, or Telegram) and needs to log it as a task in the system. The manager opens the task creation form, fills in the title, description, selects priority, sets a deadline, assigns an engineer, links it to a client, and adds relevant tags. The assigned engineer receives a notification about the new task.

**Why this priority**: This is the core value proposition — capturing client requests that currently get lost in chat messages and calls. Without task creation and assignment, the system has no purpose.

**Independent Test**: Can be fully tested by creating a task with all fields, assigning it to an engineer, and verifying the engineer sees it in their task list with a notification.

**Acceptance Scenarios**:

1. **Given** the manager is logged in, **When** they fill in all required fields (title, description, priority, deadline) and assign an engineer, **Then** the task is created with status "Created" and the engineer receives a notification.
2. **Given** the manager is creating a task, **When** they attach files (screenshots, documents), **Then** the files are stored and visible on the task detail page.
3. **Given** the manager is creating a task, **When** they select a client from the directory and add tags, **Then** the task is linked to that client and tagged for categorization.
4. **Given** the manager is creating a task, **When** they omit the title or description, **Then** the system prevents submission and shows a validation message.

---

### User Story 2 - Engineer Works on an Assigned Task (Priority: P1)

An engineer logs in and sees their assigned tasks. They pick a task, change its status to "In Progress", add comments with progress updates, attach relevant files, and eventually mark it as "Done". Each status change and comment is recorded in the audit log.

**Why this priority**: Engineers are the primary daily users. If they cannot efficiently view, update, and complete tasks, the system fails its accountability purpose.

**Independent Test**: Can be tested by logging in as an engineer, viewing assigned tasks, changing status through the workflow, adding comments and files, and verifying the audit trail.

**Acceptance Scenarios**:

1. **Given** an engineer is logged in, **When** they view their task list, **Then** they see all tasks in the system (with their assigned tasks highlighted), sorted by priority and deadline.
2. **Given** an engineer opens a task with status "Created", **When** they change the status to "In Progress", **Then** the status updates and the change is recorded in the audit log with timestamp and user.
3. **Given** an engineer is viewing a task, **When** they add a comment with @mention of another user, **Then** the comment is saved and the mentioned user receives a notification.
4. **Given** an engineer is working on a task, **When** they need to wait on external input, **Then** they can set the status to "Waiting" with an explanation comment.

---

### User Story 3 - Manager Uses Kanban Board for Team Overview (Priority: P2)

A manager opens the Kanban board to see all tasks organized by status columns (Created, In Progress, Waiting, Done). They drag a task card from one column to another to update its status. The board provides a visual overview of the team's workload.

**Why this priority**: The Kanban board provides the visual oversight that managers need to identify bottlenecks and distribute workload, but the core task management works without it.

**Independent Test**: Can be tested by viewing the Kanban board with tasks in various statuses, dragging cards between columns, and verifying status updates persist.

**Acceptance Scenarios**:

1. **Given** the manager opens the Kanban board, **When** tasks exist in various statuses, **Then** tasks appear in the correct status columns with title, priority indicator, assignee, and deadline visible.
2. **Given** the manager is viewing the Kanban board, **When** they drag a task from "In Progress" to "Done", **Then** the task status updates, the change is logged, and the card moves to the new column.
3. **Given** the manager is viewing the Kanban board, **When** they apply filters (by performer, client, priority), **Then** only matching tasks are displayed.

---

### User Story 4 - Manager Searches and Filters Tasks (Priority: P2)

A manager needs to find specific tasks across the system. They use the search bar to find tasks by title, description, or client name. They apply filters to narrow results by status, priority, deadline range, performer, client, or tags.

**Why this priority**: As the task volume grows, findability becomes essential for daily operations, but teams can initially browse tasks manually.

**Independent Test**: Can be tested by creating multiple tasks with varied attributes, then searching and filtering to verify correct results are returned.

**Acceptance Scenarios**:

1. **Given** multiple tasks exist, **When** the manager searches for a keyword in the search bar, **Then** tasks matching by title, description, or client name are returned.
2. **Given** the manager is viewing tasks, **When** they filter by status "In Progress" and priority "Critical", **Then** only tasks matching both criteria are shown.
3. **Given** the manager applies a deadline filter, **When** they select "overdue tasks", **Then** only tasks past their deadline are displayed.

---

### User Story 5 - Manager Manages Client Directory (Priority: P2)

A manager maintains a directory of clients and their contacts. When creating a task, they link it to a client from this directory. The directory allows viewing all tasks associated with a specific client.

**Why this priority**: Client tracking is essential for an outsourcing team to maintain accountability per client, but tasks can initially be created without client linkage.

**Independent Test**: Can be tested by adding clients to the directory, linking tasks to clients, and verifying all tasks for a client can be viewed together.

**Acceptance Scenarios**:

1. **Given** the manager is in the client directory, **When** they add a new client with name and contact details, **Then** the client appears in the directory and is available for task linking.
2. **Given** a client has linked tasks, **When** the manager views the client profile, **Then** all tasks for that client are listed with current status.
3. **Given** the manager is creating a task, **When** they search for a client by name, **Then** matching clients are suggested for selection.

---

### User Story 6 - Manager Views Calendar and Deadline Overview (Priority: P3)

A manager opens the calendar view to see all task deadlines plotted on a monthly/weekly calendar. This helps identify overloaded periods and upcoming deadlines. The system also sends notifications when deadlines are approaching.

**Why this priority**: Calendar view provides proactive planning capability, but teams can track deadlines through the task list and Kanban board initially.

**Independent Test**: Can be tested by creating tasks with various deadlines, opening the calendar view, and verifying tasks appear on the correct dates.

**Acceptance Scenarios**:

1. **Given** tasks have deadlines set, **When** the manager opens the calendar view, **Then** tasks appear on their deadline dates with priority color coding.
2. **Given** a task deadline is within 24 hours, **When** the notification check runs, **Then** the assigned engineer and manager receive a deadline approaching notification.
3. **Given** the manager is viewing the calendar, **When** they click on a date with tasks, **Then** a summary of tasks due on that date is shown.

---

### User Story 7 - Manager Generates Reports (Priority: P3)

A manager generates reports on team performance, task completion rates, and client-specific activity. Reports can be exported as PDF or Excel files for sharing with stakeholders or clients.

**Why this priority**: Reporting provides business intelligence but is not needed for day-to-day task operations.

**Independent Test**: Can be tested by generating reports with date range filters and verifying accurate data in the exported PDF/Excel files.

**Acceptance Scenarios**:

1. **Given** the manager selects a date range, **When** they generate a task completion report, **Then** the report shows tasks created, completed, and overdue within that period grouped by performer and client.
2. **Given** a report is generated, **When** the manager exports it as PDF, **Then** a properly formatted PDF file is downloaded.
3. **Given** a report is generated, **When** the manager exports it as Excel, **Then** a spreadsheet with structured data columns is downloaded.

---

### User Story 8 - Client Views Ticket Status (Priority: P3)

An external client accesses a read-only portal to check the status of their submitted requests. They see their tickets with current status, latest comments marked as public, and expected completion dates.

**Why this priority**: Client self-service reduces status inquiry calls and improves transparency, but is optional and the team can manually update clients initially.

**Independent Test**: Can be tested by logging in as a client, viewing only their tickets, and verifying read-only access with no ability to modify tasks.

**Acceptance Scenarios**:

1. **Given** a client is logged into the portal, **When** they view their tickets, **Then** they see only tickets linked to their account with current status and deadline.
2. **Given** a client is viewing a ticket, **When** they look at the comments, **Then** they see only comments marked as public by the team.
3. **Given** a client is logged in, **When** they attempt to modify any data, **Then** the system does not provide any edit functionality.

---

### Edge Cases

- What happens when a task is reassigned to a different engineer? Both the previous and new assignee should be notified, and the change should be recorded in the audit log.
- How does the system handle a task with a deadline in the past at creation time? The system should warn the manager but still allow creation.
- What happens when a user tries to delete a task? Tasks should not be permanently deleted; they can be archived, and only managers can archive tasks.
- How does the system handle file upload failures? The user should see a clear error message, and any successfully uploaded files should be preserved.
- What happens when two users simultaneously change the same task's status? The system should prevent conflicts by accepting the first change and notifying the second user of the updated status.
- What happens when a mentioned user in a comment no longer exists in the system? The @mention should still display the name but not generate a notification.
- How does the system handle very large file attachments? A maximum file size limit should be enforced with a clear message indicating the limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow managers to create tasks with title, description, priority (low/medium/high/critical), and deadline as required fields.
- **FR-002**: System MUST allow managers to assign tasks to one or more engineers.
- **FR-003**: System MUST enforce the status workflow with these valid transitions: Created -> In Progress, In Progress -> Waiting, Waiting -> In Progress, In Progress -> Done, Done -> In Progress (reopen), Done -> Archived. Archived is terminal and cannot transition to any other status.
- **FR-004**: System MUST provide a Kanban board view with drag-and-drop functionality to change task status.
- **FR-005**: System MUST support file attachments on tasks, with a maximum file size of 25 MB per file. Allowed file types: images (PNG, JPG, GIF, WEBP), documents (PDF, DOC/DOCX, XLS/XLSX, TXT, CSV), and archives (ZIP, RAR). All other file types MUST be rejected with a clear error message.
- **FR-006**: System MUST record an audit log entry for every task change, including who made the change, what changed, and when.
- **FR-007**: System MUST support comments on tasks with @mention functionality that triggers notifications to mentioned users.
- **FR-008**: System MUST provide full-text search across task titles, descriptions, and client names.
- **FR-009**: System MUST support filtering tasks by status, priority, deadline range, performer, client, and tags.
- **FR-010**: System MUST support tagging tasks with user-defined tags for categorization.
- **FR-011**: System MUST provide a client and contact directory where managers can add, edit, and view clients.
- **FR-012**: System MUST link tasks to clients from the directory.
- **FR-013**: System MUST display a calendar view showing tasks plotted on their deadline dates.
- **FR-014**: System MUST send notifications for: new task assignment, new comments with @mentions, and deadlines approaching within 24 hours. Additionally, client portal users MUST receive email notifications when their ticket status changes.
- **FR-015**: System MUST allow managers to generate reports filtered by date range and export them as PDF and Excel files.
- **FR-016**: System MUST provide role-based access: managers have full access; engineers can view and comment on all tasks but can only change status on tasks assigned to them; clients have read-only access to their tickets.
- **FR-017**: System MUST support user authentication with secure email/password login for all user roles.
- **FR-022**: System MUST restrict account creation to managers only — no self-registration is allowed for any role.
- **FR-018**: System MUST prevent task deletion; tasks can only be archived by managers.
- **FR-019**: System MUST display notifications within the application interface with read/unread status.
- **FR-020**: System MUST provide an optional read-only client portal showing ticket status and public comments.
- **FR-021**: System MUST handle concurrent edits gracefully by preventing conflicting status changes.

### Key Entities

- **Task**: The central entity representing a work item. Key attributes: title, description, priority, deadline, status, assigned engineer(s), linked client, tags, file attachments, comments, audit history.
- **User**: A person who uses the system. Has a role (Manager, Engineer, Client), name, email, and credentials.
- **Client**: An external company or individual who submits requests. Key attributes: name, contact information (phone, email), associated tasks.
- **Comment**: A text entry on a task with author, timestamp, content, @mentions, and public/private visibility flag.
- **Attachment**: A file linked to a task with filename, size, upload date, and uploader.
- **Tag**: A label for categorizing tasks (e.g., bug, urgent, CRM, hardware). Can be created and applied by managers and engineers.
- **Notification**: A system-generated alert tied to an event (assignment, mention, deadline). Has read/unread status.
- **Audit Log Entry**: An immutable record of a change to a task, including actor, timestamp, field changed, old value, and new value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Managers can create and assign a task in under 2 minutes, including client linking and file attachment.
- **SC-002**: Engineers can find and begin working on their highest-priority assigned task within 30 seconds of logging in.
- **SC-003**: Any task's full change history is retrievable in under 5 seconds.
- **SC-004**: Search results return within 2 seconds for repositories of up to 10,000 tasks.
- **SC-005**: 100% of status changes, assignments, and comment additions are captured in the audit log with no gaps.
- **SC-006**: Deadline notifications are delivered to users before the deadline passes.
- **SC-007**: Managers can generate and export a filtered report within 1 minute.
- **SC-008**: The system supports at least 50 concurrent users without noticeable performance degradation.
- **SC-009**: Client portal users can check ticket status without contacting the support team, reducing status inquiry calls by at least 30%.
- **SC-010**: Zero tasks are lost or unaccounted for once entered into the system — every task has a clear owner, status, and history.

## Clarifications

### Session 2026-01-31

- Q: What status transitions are valid beyond the linear sequence? → A: Forward + backward: allow In Progress <-> Waiting, and Done -> In Progress (reopen), but Archived is terminal.
- Q: Who creates user accounts? → A: Manager creates all accounts (Manager, Engineer, Client) — no self-registration.
- Q: How are client portal users notified of ticket changes? → A: Email notifications when ticket status changes.
- Q: Which file types are allowed for attachments? → A: Allowlist only — images (PNG, JPG, GIF, WEBP), documents (PDF, DOC/DOCX, XLS/XLSX, TXT, CSV), and archives (ZIP, RAR).
- Q: What is the engineer visibility scope? → A: Engineers can view and comment on all tasks, but can only change status on their own assigned tasks.

## Assumptions

- Users have modern web browsers (latest two versions of Chrome, Firefox, Edge, or Safari).
- The system is accessed via web browser on desktop; mobile-responsive design is desirable but not a primary requirement.
- The team size is small-to-medium (up to 50 users across all roles).
- Email is the primary channel for external notifications; in-app notifications are the primary channel for internal alerts.
- File attachment size limit is 25 MB per file, which covers most screenshots and documents.
- The system MUST support Russian and English from the initial release per project constitution (Principle V). All user-facing strings must use translation infrastructure.
- Authentication uses standard email/password with session management; SSO integration is out of scope for the initial release.
- The "Archived" status is terminal — archived tasks cannot be reactivated.
- Reports cover standard metrics (task counts, completion rates, overdue rates by performer and client); custom report building is out of scope.
- Deadline approaching notifications trigger at 24 hours before the deadline.
