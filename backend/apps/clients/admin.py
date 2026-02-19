from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["name", "client_type", "email", "organization", "created_at"]
    list_filter = ["client_type", "organization"]
    search_fields = ["name", "email"]
    ordering = ["name"]
