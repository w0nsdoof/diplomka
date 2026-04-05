# Feature Specification: AI Auto-Generation of Tasks from Epic

**Feature Branch**: `008-ai-epic-tasks`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "AI auto creation of tasks from Epic. Taking into context for better assignees tasks done (via tags) and users info. Manager should be able to click a button which creates needed tasks/subtasks with assigned engineers for it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Tasks from Epic (Priority: P1)

A manager opens an Epic detail page and clicks "Generate Tasks with AI." The system analyzes the Epic's title, description, priority, deadline, and tags, along with the project team members' profiles and past work history. It then generates a set of tasks with titles, descriptions, priorities, and suggested assignees. The manager reviews the generated tasks and confirms creation.

**Why this priority**: This is the core feature — without it, nothing else matters. It delivers the primary value of reducing manual task breakdown effort for managers.

**Independent Test**: Can be fully tested by creating an Epic with a description, clicking "Generate Tasks," and verifying that relevant tasks are created under the Epic with appropriate assignees.

**Acceptance Scenarios**:

1. **Given** an Epic with a title, description, and at least one tag, **When** a manager clicks "Generate Tasks with AI," **Then** the system generates a list of tasks with titles, descriptions, priorities, and suggested assignees.
2. **Given** the system has generated a list of tasks, **When** the manager reviews and confirms, **Then** all tasks are created under the Epic with the specified fields populated.
3. **Given** a generated task list, **When** the manager removes or edits individual tasks before confirming, **Then** only the approved tasks are created with the manager's modifications applied.
4. **Given** the Epic belongs to a project with assigned team members, **When** tasks are generated, **Then** suggested assignees are chosen only from the project's team members.
5. **Given** the Epic has no tags and no project, **When** a manager clicks "Generate Tasks," **Then** the system generates tasks based on the Epic description alone, without assignee suggestions.

---

### User Story 2 - Smart Assignee Suggestion via Tag-Based History (Priority: P1)

When generating tasks, the system looks at each team member's completed task history filtered by the Epic's tags. Team members who have completed more tasks matching the Epic's tags are prioritized for assignment to related generated tasks. The system also considers each team member's job title and skills as secondary signals.

**Why this priority**: Assignee suggestions are the key differentiator of this feature over simple task decomposition. Without smart assignment, a manager would still need to manually assign every generated task.

**Independent Test**: Can be tested by setting up team members with varying task histories (tagged tasks), generating tasks for an Epic with matching tags, and verifying that assignees are suggested based on tag-matched completed work.

**Acceptance Scenarios**:

1. **Given** a team member has completed 10 tasks tagged "backend" and the Epic is tagged "backend," **When** tasks are generated, **Then** that team member is suggested as assignee for backend-related tasks.
2. **Given** two team members both have "backend" tagged completed tasks but one has 15 and the other has 3, **When** a backend task is generated, **Then** the member with more relevant completed tasks is suggested first.
3. **Given** a team member has no completed tasks matching the Epic's tags but their profile lists relevant skills and a matching job title, **When** tasks are generated, **Then** that member may still be suggested as a secondary candidate based on profile data.
4. **Given** no team members have relevant tag-matched history or matching skills, **When** tasks are generated, **Then** tasks are created without assignee suggestions (left unassigned).

---

### User Story 3 - Preview and Edit Before Creation (Priority: P2)

After the AI generates a task list, the manager sees a preview screen showing all proposed tasks. The manager can edit any task's title, description, priority, or assignee, remove tasks they don't want, and then confirm the final set for creation.

**Why this priority**: Managers need control over AI output. Blindly creating tasks without review would erode trust in the feature and create cleanup work.

**Independent Test**: Can be tested by generating tasks and verifying the preview allows editing, removing, and confirming individual tasks before any are persisted.

**Acceptance Scenarios**:

1. **Given** the AI has returned a list of generated tasks, **When** the manager views the preview, **Then** each task displays its title, description, priority, and suggested assignee in an editable format.
2. **Given** the preview is displayed, **When** the manager edits a task's title and changes its assignee, **Then** the task is created with the manager's modifications, not the AI's original suggestion.
3. **Given** the preview is displayed, **When** the manager removes two tasks from the list and confirms, **Then** only the remaining tasks are created.
4. **Given** the preview is displayed, **When** the manager clicks "Cancel," **Then** no tasks are created and the Epic remains unchanged.

---

### User Story 4 - Asynchronous Generation with Progress Feedback (Priority: P2)

Since AI generation may take several seconds, the system processes the request asynchronously. The manager sees a loading indicator after clicking "Generate Tasks." Once generation is complete, the preview appears automatically.

**Why this priority**: A blocking request would cause poor user experience with timeouts and frozen UI. The existing AI summaries feature already uses this async pattern.

**Independent Test**: Can be tested by triggering generation, verifying a loading state is shown, and confirming the preview appears when processing completes.

**Acceptance Scenarios**:

1. **Given** a manager clicks "Generate Tasks with AI," **When** the request is submitted, **Then** a loading indicator is displayed immediately.
2. **Given** the generation is in progress, **When** it completes successfully, **Then** the preview appears automatically without the manager needing to refresh.
3. **Given** the generation is in progress, **When** the AI service fails, **Then** the manager sees an error message and can retry or create tasks manually.
4. **Given** a generation is already in progress for this Epic, **When** the manager clicks "Generate Tasks" again, **Then** the system prevents duplicate generation and informs the manager that generation is already running.

---

### User Story 5 - Notifications for Generated Tasks (Priority: P3)

When generated tasks are confirmed and created, assignees receive notifications (in-app and Telegram if configured) about their new assignments, consistent with existing task creation notification behavior.

**Why this priority**: Notifications are important but the existing notification infrastructure already handles task creation events. This story ensures the AI-generated tasks trigger the same notification flow.

**Independent Test**: Can be tested by generating and confirming tasks, then verifying that each assigned team member receives appropriate notifications.

**Acceptance Scenarios**:

1. **Given** a generated task is confirmed with an assignee, **When** the task is created, **Then** the assignee receives the same notification as for any manually created task.
2. **Given** multiple tasks are confirmed at once, **When** they are created, **Then** each assignee receives individual notifications for each task assigned to them.

---

### Edge Cases

- What happens when the Epic has an empty description? The system should require at least a title and description before allowing generation.
- What happens when the project has no team members? The system generates tasks without assignee suggestions.
- What happens when the AI returns malformed or unparseable output? The system shows an error and allows the manager to retry.
- What happens when the AI suggests an assignee ID that doesn't belong to the project team? The system silently drops the invalid assignee (task created unassigned).
- What happens when the Epic already has tasks? The system provides the list of existing task titles to the AI to avoid generating duplicates.
- What happens when the AI service is unavailable or times out? The manager sees a clear error message with the option to retry or create tasks manually. Hard timeout is 60 seconds.

## Clarifications

### Session 2026-04-05

- Q: Should the AI-generated task preview be persisted in the database or kept ephemeral? → A: Ephemeral — preview lives only in the frontend; lost on navigation, re-generate if needed.
- Q: Where should generated task tags come from? → A: AI-suggested — AI picks tags from the organization's existing tag set per task.
- Q: What should happen if AI generation exceeds the target time? → A: Hard timeout at 60 seconds — abort, show error, allow retry.
- Q: How should the backend deliver the generated task list to the frontend? → A: Polling — frontend gets a Celery task ID, polls a status endpoint until result is ready.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow managers to trigger AI task generation from an Epic detail page via a clearly labeled action button.
- **FR-002**: System MUST collect Epic context (title, description, priority, deadline, tags) as input for the AI generation.
- **FR-003**: System MUST collect project context (title, description) when the Epic is linked to a project.
- **FR-004**: System MUST collect team member profiles (name, role, job title, skills) from the project's team roster as input for assignee suggestion.
- **FR-005**: System MUST filter each team member's completed task history by matching the Epic's tags to determine relevant past work.
- **FR-006**: If the Epic has no tags but belongs to a project that has tags, the system MUST fall back to the project's tags for filtering task history.
- **FR-007**: System MUST only consider top-level tasks (not subtasks) in completed status when building a team member's track record.
- **FR-008**: System MUST limit track record to a maximum of 5 most recent relevant tasks per team member to keep AI input concise.
- **FR-009**: System MUST send the list of existing task titles under the Epic to the AI to avoid duplicate generation.
- **FR-010**: System MUST process generation asynchronously via a Celery task. The API returns a task ID; the frontend polls a status endpoint until the result is ready, showing a loading state in the meantime.
- **FR-011**: System MUST prevent concurrent generation requests for the same Epic.
- **FR-012**: System MUST present a preview of generated tasks before creating them, allowing the manager to edit, remove, or confirm each task.
- **FR-013**: System MUST validate AI-suggested assignees against the project team roster; invalid suggestions are silently dropped (task left unassigned).
- **FR-014**: System MUST create confirmed tasks with all standard task fields (title, description, priority, epic link, assignee, tags) and trigger existing notification flows.
- **FR-018**: System MUST provide the organization's existing tag set to the AI so it can suggest appropriate tags per generated task. The AI MUST only suggest tags from the existing set (no invented tags).
- **FR-015**: System MUST restrict the "Generate Tasks" action to users with the manager role.
- **FR-016**: System MUST display an error message and offer retry when AI generation fails, without creating any tasks.
- **FR-017**: System MUST require the Epic to have at least a title and non-empty description before allowing generation.

### Key Entities

- **Epic**: The parent entity from which tasks are generated. Provides title, description, priority, deadline, tags, project link, and client as context for the AI.
- **Task**: The output entity created by this feature. Each generated task has a title, description, priority, suggested assignee, and is linked to the originating Epic.
- **User (Team Member)**: Project team members whose profiles (job title, skills, role) and tag-filtered completed task history inform assignee suggestions.
- **Tag**: The primary mechanism for matching team members' past work to the current Epic's domain. Tags on the Epic are compared against tags on team members' completed tasks.
- **Project**: Optional parent of the Epic. Provides team roster and fallback tags when the Epic itself has no tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Managers can generate a set of tasks from an Epic in under 30 seconds (from button click to preview displayed). Hard timeout at 60 seconds — if exceeded, the system aborts and shows an error with retry option.
- **SC-002**: At least 70% of AI-suggested assignees are accepted by the manager without modification during the preview step.
- **SC-003**: At least 80% of generated task titles and descriptions are accepted by the manager with no or minor edits.
- **SC-004**: Time to create a structured set of tasks for an Epic is reduced by at least 60% compared to manual creation.
- **SC-005**: Zero tasks are created without explicit manager confirmation (preview-then-confirm flow is enforced).
- **SC-006**: System handles AI service unavailability gracefully — managers always have the option to create tasks manually.

## Assumptions

- The AI-generated task preview is ephemeral — it lives only in the frontend state and is not persisted to the database. If the manager navigates away, they re-generate.
- Generation uses a Celery task with polling (not WebSocket/SSE). The frontend receives a task ID and polls a status endpoint for the result.
- The existing LLM integration (LiteLLM) used by AI Summaries will be reused for this feature.
- Team members' `job_title` and `skills` profile fields are reasonably populated; the quality of assignee suggestions depends on this data.
- Tags are the primary classifier for domain relevance. Organizations are expected to use tags consistently on both Epics and tasks for optimal results.
- The AI generates only top-level tasks under the Epic, not subtasks. Subtask generation may be considered in a future iteration.
- The generation limit is capped at a reasonable number of tasks per request (e.g., up to 15) to prevent runaway output.
- Existing notification infrastructure (in-app + Telegram) handles task creation events and requires no modification — generated tasks simply use the standard creation flow.

## Scope Boundaries

### In Scope

- AI task generation triggered from Epic detail page (manager only)
- Context collection: Epic fields, project fields, team profiles, tag-filtered task history
- Asynchronous processing with loading feedback
- Preview/edit/confirm flow before task creation
- Smart assignee suggestion based on tag-matched history + user profile
- Error handling and retry for AI failures
- Duplicate prevention (Redis lock per Epic)

### Out of Scope

- AI generation of subtasks (future iteration)
- AI-assisted Epic description writing (future iteration)
- Bulk generation across multiple Epics
- Automatic generation without manager trigger (no scheduled/automated generation)
- Custom prompt editing by the manager
- AI model selection or configuration by the user
