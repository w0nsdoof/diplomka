from django.conf import settings
from django.db import models


class Comment(models.Model):
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="comments"
    )
    content = models.TextField()
    is_public = models.BooleanField(default=True)
    mentions = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="mentioned_in_comments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"], name="ix_comment_created_at"),
        ]

    def __str__(self):
        return f"Comment by {self.author} on {self.task}"
