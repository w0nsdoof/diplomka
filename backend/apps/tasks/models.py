from django.conf import settings
from django.db import models


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
    priority = models.CharField(max_length=10, choices=Priority.choices, blank=True, default="medium", db_index=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True
    )
    deadline = models.DateTimeField(null=True, blank=True)
    epic = models.ForeignKey(
        "projects.Epic",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        db_index=True,
    )
    parent_task = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subtasks",
        db_index=True,
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_tasks",
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="assigned_tasks"
    )
    tags = models.ManyToManyField("tags.Tag", blank=True, related_name="tasks")
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    estimated_hours = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True,
        help_text="AI or manual time estimate in hours",
    )
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="ix_task_status"),
            models.Index(fields=["priority"], name="ix_task_priority"),
            models.Index(fields=["deadline"], name="ix_task_deadline"),
            models.Index(fields=["created_at"], name="ix_task_created_at"),
            models.Index(fields=["status", "priority"], name="ix_task_status_priority"),
            models.Index(fields=["status", "deadline"], name="ix_task_status_deadline"),
            models.Index(fields=["organization", "epic"], name="ix_task_org_epic"),
            models.Index(fields=["organization", "parent_task"], name="ix_task_org_parent"),
        ]

    @property
    def entity_type(self) -> str:
        return "subtask" if self.parent_task_id else "task"

    def __str__(self):
        return self.title
