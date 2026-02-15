from django.contrib import admin

from .models import ReportSummary


@admin.register(ReportSummary)
class ReportSummaryAdmin(admin.ModelAdmin):
    list_display = [
        "period_type", "period_start", "period_end",
        "status", "generation_method", "generated_at",
    ]
    list_filter = ["period_type", "status", "generation_method"]
    search_fields = ["summary_text"]
    readonly_fields = ["generated_at", "created_at"]
    ordering = ["-generated_at"]
