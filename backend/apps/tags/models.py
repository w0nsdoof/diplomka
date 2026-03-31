from django.db import models


class Tag(models.Model):
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, blank=True, default="#6c757d")
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="tags",
    )

    class Meta:
        unique_together = [("name", "organization")]

    def __str__(self):
        return self.name
