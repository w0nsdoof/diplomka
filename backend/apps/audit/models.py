from django.conf import settings
from django.db import models


class AuditLogEntry(models.Model):
    class Action(models.TextChoices):
        STATUS_CHANGE = "status_change", "Status Change"
        FIELD_UPDATE = "field_update", "Field Update"
        COMMENT_ADDED = "comment_added", "Comment Added"
        FILE_ATTACHED = "file_attached", "File Attached"
        ASSIGNMENT_CHANGE = "assignment_change", "Assignment Change"

    task = models.ForeignKey(
        "tasks.Task", on_delete=models.CASCADE, related_name="audit_log"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_actions",
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    field_name = models.CharField(max_length=100, blank=True, default="")
    old_value = models.TextField(blank=True, default="")
    new_value = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(
                fields=["task", "timestamp"], name="ix_audit_task_timestamp"
            ),
        ]

    def __str__(self):
        return f"{self.action} on {self.task} by {self.actor}"
