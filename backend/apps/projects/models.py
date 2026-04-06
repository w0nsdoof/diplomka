from django.conf import settings
from django.db import models


class Project(models.Model):
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
        max_length=20, choices=Priority.choices, blank=True, null=True, db_index=True
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True
    )
    deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_projects",
        db_index=True,
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
        db_index=True,
    )
    tags = models.ManyToManyField("tags.Tag", blank=True, related_name="projects")
    team = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="project_teams",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_projects",
    )
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"], name="ix_project_org_status"),
            models.Index(fields=["organization", "created_at"], name="ix_project_org_created"),
        ]

    def __str__(self):
        return self.title


class Epic(models.Model):
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
        max_length=20, choices=Priority.choices, blank=True, null=True, db_index=True
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True
    )
    deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="epics",
        db_index=True,
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_epics",
        db_index=True,
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="epics",
        db_index=True,
    )
    tags = models.ManyToManyField("tags.Tag", blank=True, related_name="epics")
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="epics",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_epics",
    )
    last_generation = models.JSONField(
        null=True, blank=True, default=None,
        help_text="Raw AI generation output for audit (model, tokens, raw tasks, timestamp)",
    )
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"], name="ix_epic_org_status"),
            models.Index(fields=["organization", "project"], name="ix_epic_org_project"),
            models.Index(fields=["organization", "created_at"], name="ix_epic_org_created"),
        ]

    def __str__(self):
        return self.title
