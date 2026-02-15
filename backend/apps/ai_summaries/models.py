from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


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
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_summaries",
    )
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
