from django.db import models
from django.utils.text import slugify


class Tag(models.Model):
    name = models.CharField(max_length=50)
    slug = models.SlugField(max_length=60)
    color = models.CharField(max_length=7, blank=True, default="#6c757d")
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="tags",
    )

    class Meta:
        unique_together = [("name", "organization"), ("slug", "organization")]
        indexes = [
            models.Index(fields=["slug"], name="ix_tag_slug"),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
