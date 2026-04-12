# Code Snippets for Diploma Thesis

Representative excerpts from the IT Outsourcing Task Management System.

---

## 1. Task Model with Status Machine and Optimistic Locking

Demonstrates a finite-state machine for task lifecycle, composite database
indexes for common query patterns, and a `version` field used for
optimistic concurrency control.

```python
# backend/apps/tasks/models.py

class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        IN_PROGRESS = "in_progress", "In Progress"
        WAITING = "waiting", "Waiting"
        DONE = "done", "Done"
        ARCHIVED = "archived", "Archived"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default="medium", db_index=True,
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True,
    )
    deadline = models.DateTimeField(null=True, blank=True)
    epic = models.ForeignKey("projects.Epic", on_delete=models.SET_NULL,
                             null=True, blank=True, related_name="tasks")
    parent_task = models.ForeignKey("self", on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name="subtasks")
    assignees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True,
                                       related_name="assigned_tasks")
    organization = models.ForeignKey("organizations.Organization",
                                     on_delete=models.CASCADE, related_name="tasks")
    version = models.PositiveIntegerField(default=1)  # optimistic locking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="ix_task_status"),
            models.Index(fields=["status", "priority"], name="ix_task_status_priority"),
            models.Index(fields=["status", "deadline"], name="ix_task_status_deadline"),
            models.Index(fields=["organization", "epic"], name="ix_task_org_epic"),
        ]
```

### Status Transition Service with Optimistic Locking

The transition map defines allowed state changes. The `apply_status_change`
function uses a filtered `UPDATE ... WHERE version = N` query (via Django's
`F` expression) to implement optimistic locking: if a concurrent write
incremented the version first, zero rows match and the caller gets a conflict
error instead of a silent overwrite.

```python
# backend/apps/tasks/services.py

VALID_TRANSITIONS = {
    Task.Status.CREATED:     [Task.Status.IN_PROGRESS],
    Task.Status.IN_PROGRESS: [Task.Status.WAITING, Task.Status.DONE],
    Task.Status.WAITING:     [Task.Status.IN_PROGRESS],
    Task.Status.DONE:        [Task.Status.IN_PROGRESS, Task.Status.ARCHIVED],
}

MANAGER_ONLY_TRANSITIONS = {
    (Task.Status.DONE, Task.Status.ARCHIVED),
}


def validate_transition(current_status, new_status):
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        return False, f"Invalid transition from '{current_status}' to '{new_status}'."
    return True, None


def apply_status_change(task, new_status, actor, comment=None):
    old_status = task.status
    valid, error = validate_transition(old_status, new_status)
    if not valid:
        return False, error, None

    # Atomic compare-and-swap via filtered UPDATE
    rows = Task.objects.filter(pk=task.pk, version=task.version).update(
        status=new_status,
        version=F("version") + 1,
    )
    if rows == 0:
        return False, "Conflict: task was modified by another user.", None

    task.refresh_from_db()

    # Audit trail
    AuditLogEntry.objects.create(
        task=task, actor=actor,
        action=AuditLogEntry.Action.STATUS_CHANGE,
        field_name="status",
        old_value=old_status, new_value=new_status,
    )

    # Notify assignees and broadcast to Kanban board via WebSocket
    for assignee in task.assignees.all():
        if assignee != actor:
            create_notification(
                recipient=assignee, event_type="status_changed", task=task,
                message=f"Task '{task.title}' changed from {old_status} to {new_status}",
                actor=actor,
            )

    _broadcast_task_event("task_status_changed", task)
    return True, None, task
```

---

## 2. Role-Based Access Control (RBAC) Permission Classes

DRF permission classes that enforce role-based access at the view layer.
The system uses three roles -- manager, engineer, client -- checked against
a `role` field on the User model.

```python
# backend/apps/accounts/permissions.py

class IsManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "manager"


class IsAssignedEngineer(BasePermission):
    """Object-level check: engineer must be in the task's assignees list."""
    def has_object_permission(self, request, view, obj):
        return (
            request.user.is_authenticated
            and request.user.role == "engineer"
            and obj.assignees.filter(pk=request.user.pk).exists()
        )


class IsManagerOrEngineer(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ("manager", "engineer")
        )


class IsManagerOrReadOnly(BasePermission):
    """Authenticated users can read; only managers can write."""
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role == "manager"
```

### Dynamic Permission Assignment per ViewSet Action

```python
# backend/apps/tasks/views.py  (TaskViewSet)

def get_permissions(self):
    if self.action in ("assign", "destroy"):
        return [IsManager()]
    if self.action in ("create", "partial_update", "update", "change_status"):
        return [IsManagerOrEngineer()]
    return [IsManagerOrReadOnly()]
```

---

## 3. Celery Task for AI Summary Generation with Redis Distributed Lock

A Celery shared task that generates AI-powered report summaries. Uses a
Redis distributed lock to prevent duplicate generation for the same period,
and delegates the actual LLM orchestration to a service function.

```python
# backend/apps/ai_summaries/tasks.py

LOCK_TTL = 300  # 5 minutes

@shared_task
def generate_summary(period_type, period_start, period_end, requested_by_id=None,
                     prev_metrics=None, summary_id=None, organization_id=None,
                     model_override=None):
    """Acquire Redis lock, create/reuse ReportSummary row, generate content."""
    from apps.ai_summaries.models import ReportSummary
    from apps.ai_summaries.services import generate_summary_for_period

    lock_key = f"summary:{period_type}:{period_start}:{period_end}:{organization_id or 'global'}"
    redis = Redis.from_url(settings.CELERY_BROKER_URL)
    lock = redis.lock(lock_key, timeout=LOCK_TTL)

    if not lock.acquire(blocking=False):
        logger.info("Lock contention for %s, skipping", lock_key)
        return None

    try:
        if summary_id:
            summary = ReportSummary.objects.get(pk=summary_id)
        else:
            summary = ReportSummary.objects.create(
                organization_id=organization_id,
                period_type=period_type,
                period_start=period_start,
                period_end=period_end,
                status=ReportSummary.Status.PENDING,
            )

        generate_summary_for_period(
            summary.id, prev_metrics=prev_metrics, model_override=model_override,
        )
        return summary.id
    finally:
        try:
            lock.release()
        except Exception:
            logger.warning("Failed to release Redis lock %s", lock_key)
```

### Scheduled Tasks (Celery Beat)

```python
# backend/apps/ai_summaries/tasks.py

@shared_task
def generate_daily_summary():
    """Run daily at 00:05 UTC. Generates yesterday's summary for each organization."""
    yesterday = date.today() - timedelta(days=1)
    for org in Organization.objects.filter(is_active=True):
        existing = ReportSummary.objects.filter(
            organization=org,
            period_type=ReportSummary.PeriodType.DAILY,
            period_start=yesterday, period_end=yesterday,
            status=ReportSummary.Status.COMPLETED,
        ).exists()
        if not existing:
            generate_summary.delay("daily", str(yesterday), str(yesterday),
                                   organization_id=org.id)
```

---

## 4. WebSocket Consumer for Real-Time Kanban Board Updates

Django Channels async consumer that authenticates via JWT token in the
query string, joins an organization-scoped channel group, and pushes task
events to connected clients. Supports client-side filtering so each user
only receives events relevant to their current view.

```python
# backend/apps/tasks/consumers.py

class KanbanConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        token = self.scope["query_string"].decode().split("token=")[-1] \
            if b"token=" in self.scope["query_string"] else None
        if not token:
            await self.close(code=4401)
            return

        user = await self.authenticate(token)
        if not user:
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = f"kanban_board_{user.organization_id}"
        self.client_filter = None

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            "type": "connection_established",
            "user_id": user.id,
            "role": user.role,
        })

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get("type")
        if msg_type == "subscribe_filter":
            self.client_filter = content.get("payload", {}).get("client_id")
            await self.send_json({
                "type": "filter_applied",
                "payload": {"client_id": self.client_filter},
            })

    async def task_event(self, event):
        """Handler for group_send messages -- filters by client if active."""
        payload = event.get("payload", {})
        if self.client_filter:
            task_client = payload.get("client_id")
            if task_client and task_client != self.client_filter:
                return
        await self.send_json({
            "type": event.get("event_type", "task_updated"),
            "payload": payload,
        })

    @database_sync_to_async
    def authenticate(self, token_str):
        try:
            access_token = AccessToken(token_str)
            return User.objects.get(pk=access_token["user_id"], is_active=True)
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None
```

---

## 5. LLM-Powered Summary Generation via LiteLLM

### Provider-Agnostic LLM Call

A thin wrapper around LiteLLM that supports any backend (OpenAI, Groq,
Anthropic, etc.) via a unified interface. Model resolution follows a
priority chain: explicit override > organization default > system default >
environment variable.

```python
# backend/apps/ai_summaries/services.py

def resolve_llm_model(organization=None, explicit_model_id=None):
    """Priority: explicit > org default > system default > settings.LLM_MODEL"""
    if explicit_model_id:
        return explicit_model_id
    if organization and organization.default_llm_model_id:
        return organization.default_llm_model.model_id
    system_default = LLMModel.objects.filter(is_default=True, is_active=True).first()
    if system_default:
        return system_default.model_id
    return settings.LLM_MODEL


def call_llm(system_prompt, user_prompt, temperature=None, model=None):
    """Call LLM via LiteLLM. Returns (text, model, prompt_tokens, completion_tokens)."""
    import litellm

    litellm.num_retries = 0
    litellm.request_timeout = 110

    kwargs = {
        "model": model or settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": settings.LLM_MAX_TOKENS,
        "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
    }
    if settings.LLM_API_KEY:
        kwargs["api_key"] = settings.LLM_API_KEY
    if settings.LLM_API_BASE:
        kwargs["api_base"] = settings.LLM_API_BASE

    response = litellm.completion(**kwargs)
    text = response.choices[0].message.content
    return text, response.model, response.usage.prompt_tokens, response.usage.completion_tokens
```

### System Prompt (excerpt -- anti-hallucination constraints)

```python
# backend/apps/ai_summaries/prompts.py

SYSTEM_PROMPT = """\
You are a project management analyst for an IT outsourcing company.
You write concise, factual summaries of task management metrics for a manager.

# Hard rules
- Only reference numbers that appear verbatim in the metrics tables.
  Never invent counts, names, or dates.
- If a metric is N/A or zero, do not pad -- say it briefly and move on.
- Quote concrete task titles, client names, and engineer names from the tables.
- When "new overdue" and "inherited overdue" are given, always distinguish them.

# Anti-patterns -- never do these
- Do NOT use filler phrases: "overall", "in conclusion", "it is worth noting".
- Do NOT restate the section header inside the section.
- Do NOT invent recommendations when there is no signal.
- Do NOT speculate about causes you cannot see in the data.
...
"""
```

### User Prompt Template (daily)

```python
# backend/apps/ai_summaries/prompts.py

DAILY_USER_PROMPT = """\
Write a daily summary for {period_start}.

# Metrics
{metrics_markdown}

# Required sections (in order)
## Overview
If created and closed are both 0 and no status transitions occurred,
write exactly one sentence ("No task activity on [date].") and move on.
Otherwise 2-4 sentences: created vs closed, completion rate, overdue posture.

## Watchlist
2-4 sentences. Name any approaching-deadline tasks first. Then the longest-stuck
task by title. Mention unassigned count and critical-priority work.
If nothing is noteworthy, write "Nothing to flag today."
"""
```

### Orchestrator with Fallback

```python
# backend/apps/ai_summaries/services.py  (simplified)

def generate_summary_for_period(summary_id, prev_metrics=None, model_override=None):
    """Collect metrics -> build prompt -> call LLM -> parse sections -> save."""
    summary = ReportSummary.objects.get(pk=summary_id)
    summary.status = ReportSummary.Status.GENERATING
    summary.save(update_fields=["status"])

    # 1. Collect metrics from the reports service
    metrics_data = collect_metrics(summary.period_start, summary.period_end,
                                   organization=summary.organization)
    summary.raw_data = metrics_data
    summary.save(update_fields=["raw_data"])

    # 2. Build prompt from metrics + period type
    user_prompt = _build_user_prompt(
        summary.period_type, summary.period_start, summary.period_end,
        metrics_data, prev_metrics, summary=summary,
    )

    # 3. Call LLM with fallback to template on failure
    llm_model = resolve_llm_model(organization=summary.organization,
                                   explicit_model_id=model_override)
    try:
        text, model, prompt_tokens, completion_tokens = call_llm(
            SYSTEM_PROMPT, user_prompt, model=llm_model,
        )
        summary.sections = parse_sections(text)
        summary.generation_method = ReportSummary.GenerationMethod.AI
    except Exception:
        text = generate_fallback_summary(summary.period_type, metrics_data)
        summary.sections = parse_sections(text)
        summary.generation_method = ReportSummary.GenerationMethod.FALLBACK

    summary.summary_text = text
    summary.status = ReportSummary.Status.COMPLETED
    summary.save()
    notify_managers_of_summary(summary)
    return summary
```

---

## 6. Nested Serializer: Task Detail with Hierarchy

Demonstrates multi-level nesting in DRF serializers: a task embeds its
epic (which itself embeds the project), its subtasks (each with assignees),
and computed annotation fields from the queryset.

```python
# backend/apps/tasks/serializers.py

class ProjectBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()


class EpicDetailBriefSerializer(serializers.ModelSerializer):
    """Epic -> Project nesting for task detail view."""
    project = ProjectBriefSerializer(read_only=True)

    class Meta:
        model = Epic
        fields = ["id", "title", "project"]


class AssigneeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name"]


class SubtaskSummarySerializer(serializers.ModelSerializer):
    assignees = AssigneeSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = ["id", "title", "status", "priority", "deadline", "assignees"]


class TaskDetailSerializer(serializers.ModelSerializer):
    """Full task representation with nested hierarchy relationships."""
    client = ClientBriefSerializer(read_only=True)
    assignees = AssigneeSerializer(many=True, read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    created_by = AssigneeSerializer(read_only=True)
    comments_count = serializers.IntegerField(read_only=True, default=0)
    attachments_count = serializers.IntegerField(read_only=True, default=0)
    entity_type = serializers.SerializerMethodField()
    epic = EpicDetailBriefSerializer(read_only=True)          # Epic -> Project
    parent_task = ParentTaskBriefSerializer(read_only=True)
    subtasks = SubtaskSummarySerializer(many=True, read_only=True)  # Subtask -> Assignees

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "status", "priority", "deadline",
            "created_at", "updated_at", "created_by", "client", "assignees",
            "tags", "comments_count", "attachments_count", "version",
            "entity_type", "epic", "parent_task", "subtasks",
        ]

    def get_entity_type(self, obj):
        return obj.entity_type
```

### Example JSON Response

```json
{
  "id": 42,
  "title": "Implement SSO integration",
  "status": "in_progress",
  "version": 3,
  "epic": {
    "id": 5,
    "title": "Authentication Overhaul",
    "project": { "id": 1, "title": "Platform v2" }
  },
  "assignees": [
    { "id": 7, "first_name": "Alice", "last_name": "Chen" }
  ],
  "subtasks": [
    {
      "id": 43,
      "title": "Add SAML provider config",
      "status": "created",
      "priority": "high",
      "deadline": null,
      "assignees": []
    }
  ],
  "comments_count": 5,
  "attachments_count": 1,
  "entity_type": "task"
}
```
