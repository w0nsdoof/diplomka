from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _


class Organization(models.Model):
    name = models.CharField(_("name"), max_length=255, unique=True)
    slug = models.SlugField(_("slug"), max_length=255, unique=True)
    is_active = models.BooleanField(_("active"), default=True, db_index=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("organization")
        verbose_name_plural = _("organizations")

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        # Ensure slug uniqueness
        original_slug = self.slug
        counter = 1
        while Organization.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
            self.slug = f"{original_slug}-{counter}"
            counter += 1
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
