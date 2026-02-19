from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["title", "status", "priority", "client", "organization", "created_at"]
    list_filter = ["status", "priority", "organization"]
    search_fields = ["title", "description"]
    ordering = ["-created_at"]
