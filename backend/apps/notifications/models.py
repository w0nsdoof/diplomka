from django.conf import settings
from django.db import models


class Notification(models.Model):
    class EventType(models.TextChoices):
        TASK_ASSIGNED = "task_assigned", "Task Assigned"
        TASK_UNASSIGNED = "task_unassigned", "Task Unassigned"
        MENTION = "mention", "Mention"
        COMMENT_ADDED = "comment_added", "Comment Added"
        STATUS_CHANGED = "status_changed", "Status Changed"
        DEADLINE_WARNING = "deadline_warning", "Deadline Warning"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    event_type = models.CharField(
        max_length=30, choices=EventType.choices, db_index=True
    )
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["recipient", "is_read"], name="ix_notif_recip_unread"
            ),
        ]

    def __str__(self):
        return f"{self.event_type} for {self.recipient}"
