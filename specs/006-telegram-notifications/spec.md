# Feature Specification: Telegram Notifications

**Feature Branch**: `006-telegram-notifications`
**Created**: 2026-03-12
**Status**: Draft
**Input**: User description: "Integration with Telegram. Users should be able to bind their user accounts on our platform to Telegram Bot. Also a setting that they can toggle to turn on/off notifications on Telegram. Notifications of Tasks (New, or updated) that involves that user."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Link Telegram Account (Priority: P1)

A user wants to connect their platform account to Telegram so they can receive task notifications on their phone. The user navigates to their account settings, finds a "Link Telegram" option, and initiates the linking process. The system provides a unique verification code that the user sends to the platform's Telegram Bot. Once the bot receives the code, it confirms the link and the user's account is now connected to their Telegram chat.

**Why this priority**: Without linking, no other Telegram feature works. This is the foundational capability that enables all notification delivery.

**Independent Test**: Can be fully tested by having a user go through the linking flow and verifying the platform recognizes the Telegram connection. Delivers value by establishing the communication channel.

**Acceptance Scenarios**:

1. **Given** a logged-in user with no Telegram link, **When** they navigate to account settings and initiate Telegram linking, **Then** the system displays a unique verification code and a link/button to open the Telegram Bot.
2. **Given** a user has copied the verification code, **When** they send it to the Telegram Bot, **Then** the bot confirms the link and the platform settings show "Telegram: Connected" with the linked Telegram username.
3. **Given** a user already has a linked Telegram account, **When** they view their account settings, **Then** they see their linked Telegram username and an option to unlink.
4. **Given** a user wants to unlink, **When** they click "Unlink Telegram", **Then** the connection is removed and no further notifications are sent to Telegram.
5. **Given** a verification code has been generated, **When** more than 10 minutes pass without the user completing the link, **Then** the code expires and the user must generate a new one.

---

### User Story 2 - Toggle Telegram Notifications (Priority: P2)

A user who has linked their Telegram account wants to control whether they receive notifications via Telegram. In their account settings, they find a toggle switch for Telegram notifications. When enabled, they receive task-related notifications through the Telegram Bot. When disabled, notifications stop without unlinking their Telegram account.

**Why this priority**: Users need control over notification delivery. This respects user preferences and prevents notification fatigue while keeping the account link intact for future use.

**Independent Test**: Can be tested by toggling the setting on/off and verifying notification behavior changes accordingly. Delivers value by giving users control over their notification experience.

**Acceptance Scenarios**:

1. **Given** a user with a linked Telegram account, **When** they view notification settings, **Then** they see a "Telegram Notifications" toggle (default: enabled upon linking).
2. **Given** Telegram notifications are enabled, **When** the user toggles them off, **Then** the system stops sending Telegram notifications immediately, and the setting persists across sessions.
3. **Given** Telegram notifications are disabled, **When** the user toggles them on, **Then** the system resumes sending Telegram notifications for subsequent events.
4. **Given** a user without a linked Telegram account, **When** they view notification settings, **Then** the Telegram notification toggle is not visible or is disabled with a prompt to link Telegram first.

---

### User Story 3 - Receive Task Notifications via Telegram (Priority: P3)

A user with Telegram linked and notifications enabled receives a Telegram message whenever a task involving them is created or updated. The notification includes key details about the task so the user can quickly understand what changed without opening the platform.

**Why this priority**: This is the core value delivery — the actual notifications. It depends on P1 (linking) and P2 (toggle) being in place, but it is what makes the entire feature useful day-to-day.

**Independent Test**: Can be tested by creating or updating a task that involves a linked user and verifying they receive a Telegram message with correct task details. Delivers value by keeping users informed in real-time outside the platform.

**Acceptance Scenarios**:

1. **Given** a user with Telegram linked and notifications enabled, **When** a new task is created where they are the assignee, **Then** they receive a Telegram message with the task title, priority, and who created it.
2. **Given** a user with Telegram linked and notifications enabled, **When** a task assigned to them is updated (status change, priority change, new comment, reassignment), **Then** they receive a Telegram message describing what changed.
3. **Given** a user with Telegram linked but notifications disabled, **When** a task involving them is created or updated, **Then** they do NOT receive a Telegram message.
4. **Given** multiple users are involved in a task (e.g., assignee and creator), **When** the task is updated, **Then** each involved user with Telegram enabled receives their own notification.
5. **Given** a user with Telegram linked and notifications enabled, **When** they themselves update a task, **Then** they do NOT receive a notification for their own action.

---

### Edge Cases

- What happens when the Telegram Bot is unreachable or Telegram's service is down? Notifications are queued and retried; the user's in-app experience is not affected.
- What happens when a user blocks the Telegram Bot after linking? The system detects the delivery failure and marks the link as inactive, displaying a warning in account settings.
- What happens when a user links a new Telegram account while one is already linked? The old link is replaced with the new one.
- What happens when a task is bulk-updated (e.g., status change on multiple tasks)? Each task generates its own notification, but the system may batch them into a single Telegram message to avoid spam.
- What happens when the verification code is used by a different platform user? The code is bound to the user who generated it; another user sending it receives an error message from the bot.
- What happens when a user tries to link a Telegram account already linked to another platform user? The system rejects the link and informs the user that the Telegram account is already in use.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Telegram Bot that users can interact with to link their accounts.
- **FR-002**: System MUST generate a unique, time-limited verification code for each linking request.
- **FR-003**: System MUST verify the code sent to the Telegram Bot and establish a link between the platform user and the Telegram chat.
- **FR-004**: System MUST allow users to unlink their Telegram account from their platform account at any time.
- **FR-005**: System MUST provide a toggle in user settings to enable or disable Telegram notifications independently of the account link.
- **FR-006**: System MUST send a Telegram notification when a new task is created that involves the user (as assignee).
- **FR-007**: System MUST send a Telegram notification when a task involving the user is updated (status, priority, comments, reassignment).
- **FR-008**: System MUST NOT send a Telegram notification to the user who performed the action.
- **FR-009**: System MUST include task title, the change description, and the actor in each notification message.
- **FR-010**: System MUST handle Telegram delivery failures gracefully without affecting platform functionality.
- **FR-011**: System MUST expire unused verification codes after 10 minutes.
- **FR-012**: System MUST detect when a user has blocked the bot and update the link status accordingly.
- **FR-013**: System MUST restrict Telegram linking and notifications to users with manager or engineer roles only; client/portal users are excluded.
- **FR-014**: System MUST enforce a one-to-one relationship between Telegram accounts and platform users; a Telegram account already linked to another user cannot be linked again until unlinked.

### Key Entities

- **Telegram Link**: Represents the connection between a platform user and a Telegram chat. Key attributes: user reference, Telegram chat identifier (unique — one-to-one with platform user), Telegram username, link status (active/inactive), linked date.
- **Notification Preference**: Represents a user's choice to receive or not receive Telegram notifications. Key attributes: user reference, Telegram notifications enabled flag.
- **Verification Code**: A temporary token used during the linking process. Key attributes: code value, associated user, creation time, expiration time, used status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the Telegram account linking process in under 2 minutes from initiating to confirmation.
- **SC-002**: Telegram notifications are delivered within 30 seconds of the triggering event (task creation or update) under normal conditions.
- **SC-003**: 95% of users who initiate the linking process successfully complete it on the first attempt.
- **SC-004**: Users can toggle Telegram notifications on/off and see the change reflected immediately (no further notifications sent within 5 seconds of disabling).
- **SC-005**: Notification delivery failures do not impact platform response times or user experience within the application.
- **SC-006**: Users who enable Telegram notifications report improved awareness of task changes without needing to check the platform manually.

## Clarifications

### Session 2026-03-12

- Q: Which user roles can link Telegram and receive notifications? → A: Managers and engineers only; client/portal users are excluded.
- Q: Can one Telegram account be linked to multiple platform users? → A: One-to-one; each Telegram account can only be linked to one platform user at a time.
- Q: Should users be able to choose which task changes trigger notifications? → A: All-or-nothing; single on/off toggle for all task notifications, no granular filtering.

## Assumptions

- The platform will create and operate its own Telegram Bot (via Telegram's BotFather).
- Users are expected to have an existing Telegram account; the platform does not assist with Telegram account creation.
- "Involves the user" means the user is the assignee of the task. Creators are notified only when someone else modifies their created task.
- Notification content is plain text with basic formatting (bold, links); rich media (images, files) is not included.
- The toggle defaults to enabled when a user first links their Telegram account.
- Bulk operations may result in batched notifications to prevent message flooding.
