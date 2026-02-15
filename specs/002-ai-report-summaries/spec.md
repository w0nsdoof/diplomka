# Feature Specification: AI-Generated Report Summaries

**Feature Branch**: `002-ai-report-summaries`
**Created**: 2026-02-14
**Status**: Draft
**Input**: User description: "Add AI Generated Report summaries, which would automatically run on reporting period end (Daily,Weekly) and provide human-readable summary using LLM."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Daily AI Summary (Priority: P1)

A manager opens the reports page and sees today's automatically generated summary — a short, human-readable narrative that interprets the previous day's task metrics. Instead of reading raw numbers, the manager reads a paragraph like: "Yesterday, 12 new tasks were created and 8 were completed. The engineering team closed 3 critical tickets. Client Acme Corp has 2 overdue tasks that need attention." The summary highlights notable trends, anomalies, and items requiring action.

**Why this priority**: This is the core value proposition — transforming raw metrics into actionable insights without manual effort.

**Independent Test**: Can be tested by triggering a daily summary generation and verifying a readable narrative appears on the reports page that accurately reflects the underlying task data.

**Acceptance Scenarios**:

1. **Given** a manager is logged in and a daily summary has been generated, **When** they navigate to the reports page, **Then** they see the latest AI-generated summary displayed prominently with the period it covers and the time it was generated.
2. **Given** a daily summary has been generated, **When** the manager reads the summary, **Then** it contains narrative text covering: task volume (created/closed), overdue items, priority distribution highlights, and notable client or engineer activity.
3. **Given** no tasks were active in the reporting period, **When** the summary is generated, **Then** it produces a brief message indicating no significant activity occurred.

---

### User Story 2 - View Weekly AI Summary (Priority: P1)

A manager views a weekly summary every Monday morning that covers the previous full week (Monday–Sunday). The weekly summary provides a higher-level perspective: week-over-week trends, team productivity patterns, client workload distribution, and any persistent overdue items. It helps the manager prepare for the week ahead.

**Why this priority**: Weekly summaries provide strategic value alongside the daily tactical view. Both periods were explicitly requested.

**Independent Test**: Can be tested by triggering a weekly summary generation and verifying it covers a full 7-day period with trend comparisons.

**Acceptance Scenarios**:

1. **Given** it is Monday morning and the weekly summary has been generated, **When** a manager views it, **Then** the summary covers the previous Monday through Sunday and includes week-level trends.
2. **Given** the weekly summary is generated, **When** the manager reads it, **Then** it includes: total tasks created vs. completed for the week, comparison to the prior week (e.g., "Task volume increased by 15%"), top active clients, team member workload highlights, and persistent overdue items.
3. **Given** the system has fewer than two weeks of historical data, **When** the weekly summary is generated, **Then** it still produces a valid summary but omits week-over-week comparisons and indicates insufficient history.

---

### User Story 3 - Browse Summary History (Priority: P2)

A manager wants to review past summaries to track how the team's performance has evolved over time. They can browse a chronological list of previously generated summaries (both daily and weekly), filter by period type, and open any past summary to read it in full.

**Why this priority**: Historical access adds significant value but is not required for the core daily/weekly generation to function.

**Independent Test**: Can be tested by generating several summaries over multiple days and verifying they appear in a browsable, filterable list.

**Acceptance Scenarios**:

1. **Given** multiple summaries have been generated, **When** the manager navigates to the summary history, **Then** they see a chronological list showing date, period type (daily/weekly), and a preview snippet.
2. **Given** the summary history is displayed, **When** the manager filters by "weekly" only, **Then** only weekly summaries are shown.
3. **Given** the manager clicks on a past summary, **When** the detail view opens, **Then** the full summary text is displayed along with the period it covers and generation timestamp.

---

### User Story 4 - Generate On-Demand Summary (Priority: P2)

A manager needs an AI summary for a specific date range — for example, to prepare for a client meeting or a sprint retrospective. From the reports page, they select a custom start and end date and trigger summary generation. The system produces a narrative summary covering that exact period, using the same AI-powered analysis as the automated summaries.

**Why this priority**: Extends the core AI summary capability to ad-hoc use cases, giving managers flexibility beyond the fixed daily/weekly schedule.

**Independent Test**: Can be tested by selecting a custom date range, triggering generation, and verifying the resulting summary covers exactly the requested period.

**Acceptance Scenarios**:

1. **Given** a manager is on the reports page, **When** they select a custom date range and trigger summary generation, **Then** the system generates an AI summary covering exactly that period and displays it.
2. **Given** a manager triggers an on-demand summary, **When** generation completes, **Then** the summary is stored in the summary history alongside automated summaries, marked as "on-demand".
3. **Given** a manager selects a date range with no task activity, **When** they trigger generation, **Then** a brief "no activity" summary is produced.

---

### User Story 5 - Receive Summary Notifications (Priority: P3)

A manager receives an in-app notification when a new AI summary is ready. This ensures managers are promptly informed when fresh insights are available without needing to check the reports page manually.

**Why this priority**: Notification delivery is a convenience enhancement; managers can always check reports manually.

**Independent Test**: Can be tested by generating a summary and verifying a notification appears for all users with manager role.

**Acceptance Scenarios**:

1. **Given** a daily or weekly summary has just been generated, **When** the manager is logged in, **Then** they receive an in-app notification indicating a new summary is available.
2. **Given** the manager clicks the notification, **When** the notification action is triggered, **Then** they are navigated to the summary detail view.

---

### Edge Cases

- What happens when the LLM service is unavailable during scheduled generation? The system retries up to 3 times with increasing delays. If all retries fail, a fallback plain-text summary is generated from the raw metrics using a predefined template (no AI), and the failure is logged for administrator review.
- What happens when the reporting period has zero tasks? A brief "no activity" summary is generated rather than skipping generation entirely, so the historical record remains complete.
- What happens when the LLM produces an unusually long or nonsensical response? The system enforces a maximum summary length (approximately 2000 words). If the response exceeds this or fails a basic coherence check, it falls back to the template-based summary.
- What happens if a summary is generated while another is already in progress for the same period? The system prevents duplicate generation for the same period type and date range.
- What happens on the very first run with no prior summaries? The system generates a summary using whatever data is available without trend comparisons, clearly stating this is the first report.
- What happens when a manager regenerates a summary? A new version is created and becomes the default view. The previous version(s) remain accessible via a version history control on the summary detail view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically generate a daily summary at the end of each day covering that day's task activity.
- **FR-002**: System MUST automatically generate a weekly summary at the start of each week (Monday) covering the previous full week (Monday–Sunday).
- **FR-003**: System MUST use a large language model to produce human-readable narrative summaries from the raw report metrics.
- **FR-004**: Each summary MUST include: task volume (created, completed, overdue), priority distribution highlights, notable client activity, and engineer workload observations.
- **FR-005**: Weekly summaries MUST include week-over-week trend comparisons when sufficient historical data exists (at least two weeks).
- **FR-006**: System MUST store all generated summaries persistently with their period type, date range, generation timestamp, and full text.
- **FR-007**: System MUST provide a fallback summary generation mechanism (template-based, no AI) when the LLM service is unavailable after retries.
- **FR-008**: System MUST prevent duplicate summary generation for the same period type and date range.
- **FR-009**: Only users with the manager role MUST be able to view AI-generated summaries, consistent with existing report access controls.
- **FR-010**: System MUST notify managers via in-app notification when a new summary is available.
- **FR-011**: System MUST allow managers to browse and filter the history of past summaries by period type (daily/weekly).
- **FR-012**: System MUST enforce a maximum summary length to prevent excessively long outputs.
- **FR-013**: System MUST log all summary generation attempts, including successes, failures, and fallback activations.
- **FR-014**: System MUST allow managers to manually trigger an AI summary generation for any custom date range on demand.
- **FR-015**: On-demand summaries MUST be stored in the same summary history as automated summaries, distinguished by a period type of "on-demand".
- **FR-016**: Managers MUST be able to regenerate any summary. The new version is created alongside the original; all previous versions remain accessible.
- **FR-017**: When multiple versions of a summary exist, the most recent version MUST be displayed by default, with an option to view prior versions.

### Key Entities

- **Report Summary**: A generated narrative text covering a specific reporting period. Key attributes: period type (daily, weekly, or on-demand), period start date, period end date, summary text, generation timestamp, generation method (AI or fallback template), status (success or fallback), and version number. Multiple versions may exist for the same period; the latest version is displayed by default.
- **Summary Schedule**: The configuration defining when summaries are generated. Attributes: period type, scheduled time, active/inactive status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Daily summaries are generated automatically within 30 minutes of the configured end-of-day time, every day, without manual intervention.
- **SC-002**: Weekly summaries are generated automatically every Monday morning before business hours begin.
- **SC-003**: Generated summaries accurately reflect the underlying task data — all key metrics mentioned in the summary are verifiable against the raw report data with no factual errors.
- **SC-004**: Managers can read and understand a summary in under 2 minutes, compared to 5+ minutes of manual analysis of raw metric tables.
- **SC-005**: When the LLM service is unavailable, a fallback summary is produced within 1 minute, ensuring no reporting gap.
- **SC-006**: 100% of generated summaries (both daily and weekly) are persisted and accessible through summary history for at least 90 days.
- **SC-007**: Managers are notified of new summaries within 5 minutes of generation completing.

## Clarifications

### Session 2026-02-14

- Q: Should client/engineer names be sent to the external LLM or anonymized? → A: Send real names directly to the LLM for more natural, readable summaries. No anonymization required.
- Q: Should managers be able to manually trigger summaries for custom date ranges? → A: Yes, managers can generate an AI summary on-demand for any custom date range in addition to the automated daily/weekly schedule.
- Q: Can summaries be regenerated if found inaccurate? → A: Yes, regenerate and keep history — a new version is created while the old one remains accessible.

## Assumptions

- The existing report data service (which aggregates task metrics by status, priority, client, and engineer) will serve as the data source for summaries. No new data collection is required.
- The LLM service will be accessed via an external API. The specific provider and model are implementation decisions. Real client and engineer names are sent to the LLM to produce natural, human-readable summaries (no anonymization).
- "End of day" for daily summaries defaults to midnight (server time). The exact time is configurable.
- Summaries are written in English.
- The existing notification system (used for deadline warnings) can be extended to deliver summary notifications.
- Summary retention follows the same data retention policy as other system data (assumed 90 days minimum).
- The system currently serves a single timezone; multi-timezone support is not in scope.
