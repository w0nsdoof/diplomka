from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class LLMModel(models.Model):
    """Available LLM models managed by superadmin, selectable by org managers."""

    model_id = models.CharField(
        max_length=200,
        unique=True,
        help_text="LiteLLM model identifier, e.g. openrouter/google/gemini-2.5-flash",
    )
    display_name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(
        default=False,
        help_text="System-wide default model. Only one model should have this set.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_name"]
        verbose_name = "LLM Model"
        verbose_name_plural = "LLM Models"

    def __str__(self):
        return f"{self.display_name} ({self.model_id})"

    def save(self, *args, **kwargs):
        if self.is_default:
            LLMModel.objects.filter(is_default=True).exclude(pk=self.pk).update(
                is_default=False
            )
        super().save(*args, **kwargs)


class ReportSummary(models.Model):
    class PeriodType(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        ON_DEMAND = "on_demand", "On-demand"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        GENERATING = "generating", "Generating"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class GenerationMethod(models.TextChoices):
        AI = "ai", "AI"
        FALLBACK = "fallback", "Fallback template"

    period_type = models.CharField(
        max_length=20, choices=PeriodType.choices, db_index=True
    )
    period_start = models.DateField(db_index=True)
    period_end = models.DateField(db_index=True)
    summary_text = models.TextField(blank=True, default="")
    generation_method = models.CharField(
        max_length=20, choices=GenerationMethod.choices, blank=True, default=""
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    llm_model = models.CharField(max_length=100, blank=True, default="")
    prompt_tokens = models.PositiveIntegerField(null=True, blank=True)
    completion_tokens = models.PositiveIntegerField(null=True, blank=True)
    generation_time_ms = models.PositiveIntegerField(null=True, blank=True)
    raw_data = models.JSONField(default=dict)
    error_message = models.TextField(blank=True, default="")
    prompt_text = models.TextField(blank=True, default="")
    sections = models.JSONField(default=dict, blank=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="summaries",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_summaries",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="summaries",
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="summaries",
    )
    focus_prompt = models.TextField(blank=True, default="")
    generated_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]
        indexes = [
            models.Index(
                fields=["period_type", "period_start", "period_end"],
                name="idx_summary_period",
            ),
            models.Index(
                fields=["period_type", "period_start", "period_end", "-generated_at"],
                name="idx_summary_period_latest",
            ),
        ]
        verbose_name = "Report Summary"
        verbose_name_plural = "Report Summaries"

    def __str__(self):
        return f"{self.get_period_type_display()} summary: {self.period_start} - {self.period_end}"

    def clean(self):
        if self.period_end and self.period_start and self.period_end < self.period_start:
            raise ValidationError("period_end must be >= period_start")
        if self.period_type == self.PeriodType.DAILY and self.period_start != self.period_end:
            raise ValidationError("Daily summaries must have period_start == period_end")
        if self.period_type == self.PeriodType.WEEKLY:
            if self.period_end and self.period_start:
                delta = (self.period_end - self.period_start).days
                if delta != 6:
                    raise ValidationError("Weekly summaries must span exactly 7 days (Mon-Sun)")
