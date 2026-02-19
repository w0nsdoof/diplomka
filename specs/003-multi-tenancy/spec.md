# Feature Specification: Organization-Based Multi-Tenancy

**Feature Branch**: `003-multi-tenancy`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "Add multi-tenancy so each company is an independent workspace. Every user belongs to exactly one organization. Managers, engineers, and clients within an organization can only see that organization's tasks, comments, reports, and summaries. Managers create and manage users within their own organization only. A platform-level superadmin can create new organizations and assign the first manager. The existing Client entity becomes a sub-entity within an organization (a company's customer), not the tenant itself."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Superadmin Creates an Organization and Its First Manager (Priority: P1)

A platform-level superadmin opens the platform admin area (separate from the org workspace, e.g., `/platform/organizations`) and creates a new organization (e.g., "Acme Corp"). They fill in the organization name and details, then create the first manager user for that organization by providing an email, name, and temporary password. The new manager receives access to their organization workspace and can begin setting up their team.

**Why this priority**: Without the ability to create organizations and seed them with a manager, no other multi-tenancy functionality is usable. This is the foundational bootstrapping flow.

**Independent Test**: Can be fully tested by logging in as superadmin, creating an organization, creating a manager for it, and verifying the new manager can log in and sees an empty workspace scoped to their organization.

**Acceptance Scenarios**:

1. **Given** a superadmin is logged in, **When** they create a new organization named "Acme Corp", **Then** the organization appears in the organization list and has no users or data yet.
2. **Given** a superadmin has created "Acme Corp", **When** they create a manager user assigned to "Acme Corp", **Then** that user can log in and sees only data belonging to "Acme Corp" (initially empty).
3. **Given** an organization named "Acme Corp" already exists, **When** the superadmin tries to create another organization with the same name, **Then** the system rejects it with a clear error message.

---

### User Story 2 - Data Isolation Between Organizations (Priority: P1)

An organization manager at "Acme Corp" creates tasks, assigns engineers, adds comments, and generates reports. Meanwhile, another manager at "Beta Inc" does the same. Neither organization can see, access, or modify the other's data — tasks, comments, attachments, clients, reports, summaries, or user lists.

**Why this priority**: Data isolation is the core security guarantee of multi-tenancy. Without it, the feature has no value and would be a liability.

**Independent Test**: Can be fully tested by creating two organizations with users and data, then logging in as each organization's user and verifying they see only their own data across all screens (tasks, clients, reports, summaries, users).

**Acceptance Scenarios**:

1. **Given** "Acme Corp" has 5 tasks and "Beta Inc" has 3 tasks, **When** an Acme manager views the task list, **Then** they see exactly 5 tasks — none from Beta Inc.
2. **Given** "Acme Corp" has 2 clients and "Beta Inc" has 4 clients, **When** a Beta manager views the client list, **Then** they see exactly 4 clients — none from Acme Corp.
3. **Given** a task belongs to "Acme Corp", **When** a Beta Inc engineer tries to access that task by direct URL or ID, **Then** the system returns a "not found" response (not "forbidden", to avoid leaking existence).
4. **Given** "Acme Corp" has generated weekly summaries, **When** a Beta Inc manager views the summaries page, **Then** they see only Beta Inc's summaries.
5. **Given** a user belongs to "Acme Corp", **When** they search or filter any entity, **Then** results never include data from other organizations.

---

### User Story 3 - Manager Manages Users Within Their Organization (Priority: P2)

An organization manager at "Acme Corp" navigates to user management and creates new users (engineers, clients, or additional managers) for their organization. They can also deactivate or update users within their organization. They cannot see or manage users from other organizations.

**Why this priority**: After the platform is bootstrapped (P1), org managers need to independently onboard and manage their own teams without superadmin involvement.

**Independent Test**: Can be fully tested by logging in as an org manager, creating users of each role, verifying those users are assigned to the same organization, and confirming the manager cannot see users from other organizations.

**Acceptance Scenarios**:

1. **Given** a manager at "Acme Corp" is logged in, **When** they create a new engineer user, **Then** that engineer is automatically assigned to "Acme Corp" and can only see Acme Corp data.
2. **Given** a manager at "Acme Corp" is logged in, **When** they view the user list, **Then** they see only users belonging to "Acme Corp".
3. **Given** a manager at "Acme Corp" is logged in, **When** they try to create a user with an email that already exists in another organization, **Then** the system rejects it with a message indicating the email is already in use.
4. **Given** a manager deactivates an engineer, **When** that engineer tries to log in, **Then** they are denied access.

---

### User Story 4 - Clients Scoped Within an Organization (Priority: P2)

A manager at "Acme Corp" creates client records (representing Acme Corp's customers). These clients are visible only within "Acme Corp". Users with the client role at "Acme Corp" continue to see only their own client's tasks and public comments, same as today, but now also scoped to the organization.

**Why this priority**: The Client entity must be properly scoped to organizations so that different companies' customer lists remain private. This clarifies the relationship: Organization > Client > Tasks.

**Independent Test**: Can be fully tested by creating clients in two different organizations and verifying each org sees only its own clients. A portal user (client role) should see only tasks for their assigned client within their organization.

**Acceptance Scenarios**:

1. **Given** "Acme Corp" has a client "Customer A" and "Beta Inc" has a client "Customer B", **When** an Acme manager views clients, **Then** they see only "Customer A".
2. **Given** two different organizations both create a client named "BigCo", **When** each manager views their client list, **Then** each sees only their own "BigCo" record — duplicate names are allowed across organizations.
3. **Given** a portal user (client role) at "Acme Corp" is assigned to "Customer A", **When** they log in, **Then** they see only tasks associated with "Customer A" within "Acme Corp".

---

### User Story 5 - Organization-Scoped Reports and Summaries (Priority: P3)

AI-generated report summaries (daily, weekly, on-demand) are generated and displayed per organization. A manager at "Acme Corp" generates an on-demand summary, and it includes only Acme Corp's task data. Scheduled summaries run for each organization independently.

**Why this priority**: Reports and summaries already work globally. Scoping them per organization is important for accuracy and privacy, but the system is functional without it if isolation is enforced at the data level.

**Independent Test**: Can be fully tested by generating summaries for two organizations and verifying each summary contains only data from its respective organization.

**Acceptance Scenarios**:

1. **Given** the scheduled daily summary runs, **When** there are 3 organizations with active tasks, **Then** 3 separate daily summaries are generated — one for each organization.
2. **Given** a manager at "Acme Corp" triggers an on-demand summary, **When** the summary is generated, **Then** it includes only Acme Corp's task data.
3. **Given** a manager at "Beta Inc" views the summaries list, **When** they browse summaries, **Then** they see only summaries belonging to Beta Inc.

---

### User Story 6 - Superadmin Oversight (Priority: P3)

A superadmin can view and manage all organizations from a dedicated platform admin area (e.g., `/platform/organizations`), separate from the organization workspace. They can see a list of all organizations, view basic statistics (user count, task count), deactivate an organization, and reassign or create managers for any organization.

**Why this priority**: Superadmin oversight is needed for platform governance but is not on the critical path for day-to-day organization usage.

**Independent Test**: Can be fully tested by logging in as superadmin, viewing the organization list with stats, deactivating an organization, and verifying its users can no longer log in.

**Acceptance Scenarios**:

1. **Given** a superadmin is logged in, **When** they view the organization list, **Then** they see all organizations with user count and task count for each.
2. **Given** a superadmin deactivates an organization, **When** users of that organization try to log in, **Then** they are denied access with a message that their organization is inactive.
3. **Given** a superadmin is logged in, **When** they view any organization's details, **Then** they can see its managers and can add a new manager to it.

---

### Edge Cases

- What happens when a user's organization is deactivated while they are logged in? The user's next API request MUST fail with an authentication error. Since the system uses stateless JWT tokens, invalidation is enforced by checking organization active status on every authenticated request — no separate session revocation mechanism is needed.
- What happens when a superadmin tries to delete an organization that has active data (tasks, clients, users)? Deletion is not allowed — only deactivation. Deactivated organizations retain all data but no users can log in.
- What happens when a manager tries to create a user with an email already used in another organization? The system rejects it — email addresses must be globally unique since they are used for authentication.
- What happens when the last manager in an organization is deactivated? The system warns the manager and prevents the action. Only a superadmin can deactivate the last remaining manager.
- How does the existing data migrate? A default organization is created during migration, and all existing users, clients, tasks, and related data are assigned to it.
- What happens if a scheduled summary generation fails for one organization? It should not block summary generation for other organizations. Each organization's summary is generated independently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support an Organization entity representing an independent workspace (tenant). Each organization has a unique name and an active/inactive status.
- **FR-002**: Every non-superadmin user MUST belong to exactly one organization. A user's organization is set at creation time and cannot be changed. Superadmin users have no organization (null).
- **FR-003**: System MUST enforce data isolation so that users can only access data (tasks, comments, attachments, clients, tags, notifications, audit logs, report summaries) belonging to their own organization.
- **FR-004**: Data isolation MUST be enforced at the data-access level, not just the UI level. Direct access by ID to another organization's data MUST return "not found" (not "forbidden").
- **FR-005**: A new "superadmin" role MUST exist at the platform level, separate from the organization-level "manager" role. Superadmins have no organization assignment (null) and are not scoped to any single organization.
- **FR-006**: Superadmins MUST be able to create new organizations and create the first manager user for each organization.
- **FR-007**: Superadmins MUST be able to view all organizations, deactivate/reactivate organizations, and manage (create/deactivate) managers for any organization. Superadmins MUST NOT have access to an organization's internal data (tasks, clients, comments, summaries, etc.).
- **FR-008**: Organization managers MUST be able to create, update, and deactivate users within their own organization only. Managers MUST NOT see or manage users from other organizations.
- **FR-009**: Organization managers MUST be able to create users with any of the three organization-level roles: manager, engineer, or client.
- **FR-010**: The existing Client entity MUST become scoped to an organization. Clients represent an organization's customers, not the tenant itself.
- **FR-011**: Client names MUST be unique within an organization but MAY be duplicated across organizations.
- **FR-012**: Tags MUST be scoped to an organization. Each organization manages its own set of tags independently.
- **FR-013**: Scheduled report summary generation (daily, weekly) MUST produce separate summaries for each active organization.
- **FR-014**: On-demand summary generation MUST use only the requesting manager's organization data.
- **FR-015**: Notifications MUST remain scoped to the recipient user (as today) and MUST only reference objects within the user's organization.
- **FR-016**: Email addresses MUST remain globally unique across all organizations since they serve as login credentials.
- **FR-017**: System MUST prevent deactivation of the last active manager in an organization. Only a superadmin may perform this action.
- **FR-018**: When an organization is deactivated, all its users MUST be denied access on their next API request. The custom JWT authentication class MUST check `organization.is_active` on every request, ensuring no stale access persists beyond a single request cycle.
- **FR-019**: Organizations MUST NOT be deletable. They can only be deactivated to preserve data integrity and audit trails.
- **FR-020**: A data migration MUST create a default organization and assign all existing users, clients, tasks, and related data to it, ensuring zero disruption for current users.

### Key Entities

- **Organization**: Represents a company/workspace (tenant). Has a unique name, active/inactive status, and creation date. All other entities are scoped under it.
- **User** (modified): Gains a link to an Organization (required for manager/engineer/client roles; null for superadmin). Retains existing roles (manager, engineer, client) which now apply within the organization context. The new "superadmin" role has no organization assignment.
- **Client** (modified): Gains a required link to an Organization. Name uniqueness is now scoped to the organization rather than global. Represents the organization's customer.
- **Task** (modified): Gains a direct link to an Organization, set automatically from the creator's organization at creation time. All associated data (comments, attachments, audit entries) inherits the task's organization scope.
- **Tag** (modified): Gains a required link to an Organization. Name/slug uniqueness is now scoped to the organization.
- **ReportSummary** (modified): Gains a required link to an Organization. Summaries are generated and displayed per organization.

## Clarifications

### Session 2026-02-19

- Q: How should superadmin users relate to the Organization entity, given FR-002 requires org membership but FR-005 says superadmins are unscoped? → A: Superadmins have no organization (null). FR-002 applies only to non-superadmin users.
- Q: Should Task have a direct organization link or derive it from creator/client? → A: Direct organization link on Task, set automatically from the creator's organization at creation time.
- Q: Can superadmins view an organization's internal data (tasks, clients, summaries) or only manage orgs/managers? → A: Management-only. Superadmins manage organizations and managers but cannot browse an organization's internal data.
- Q: Should the superadmin UI be separate routes or extend the existing admin area? → A: Separate routes (e.g., `/platform/organizations`). Superadmins see only their platform admin area, not the org-scoped workspace.

## Assumptions

- The existing single-instance deployment becomes one organization (the "default" organization) after migration. No data loss occurs.
- Superadmins access a dedicated platform admin area at separate routes (e.g., `/platform/organizations`), distinct from the organization workspace. They do not operate within a specific organization context and cannot browse organization-internal data (tasks, clients, summaries). Their scope is limited to platform governance: creating/deactivating organizations and managing managers.
- The existing JWT authentication flow remains unchanged; organization context is derived from the authenticated user's organization membership.
- Performance impact of per-organization filtering is negligible given the expected scale (tens of organizations, not thousands).
- There is no need for users to belong to multiple organizations. If this is needed in the future, it would be a separate feature.
- Organization branding or customization (logos, themes) is out of scope for this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users in one organization can never access or view data from another organization, verified by cross-organization access tests covering all entity types.
- **SC-002**: A superadmin can create a new organization and its first manager in under 2 minutes.
- **SC-003**: An organization manager can onboard a new team member (create user) in under 1 minute without superadmin involvement.
- **SC-004**: Existing users experience zero disruption after the migration — all current data is accessible under the default organization with no workflow changes.
- **SC-005**: Scheduled summary generation completes independently for each organization — a failure in one organization does not delay or prevent generation for others.
- **SC-006**: All existing automated tests continue to pass after migration, confirming backward compatibility.
- **SC-007**: 100% of data-access endpoints enforce organization scoping, with no endpoint allowing cross-tenant data access.
