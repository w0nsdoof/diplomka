from django.contrib import admin

from .models import Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "color", "organization"]
    list_filter = ["organization"]
    search_fields = ["name"]
    ordering = ["name"]
