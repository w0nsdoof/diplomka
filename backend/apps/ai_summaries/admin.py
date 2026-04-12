from django.contrib import admin

from .models import LLMModel, ReportSummary


@admin.register(LLMModel)
class LLMModelAdmin(admin.ModelAdmin):
    list_display = ["display_name", "model_id", "is_active", "is_default", "created_at"]
    list_filter = ["is_active", "is_default"]
    search_fields = ["display_name", "model_id"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(ReportSummary)
class ReportSummaryAdmin(admin.ModelAdmin):
    list_display = [
        "period_type", "period_start", "period_end",
        "status", "generation_method", "organization", "generated_at",
    ]
    list_filter = ["period_type", "status", "generation_method", "organization"]
    search_fields = ["summary_text"]
    readonly_fields = ["generated_at", "created_at"]
    ordering = ["-generated_at"]
