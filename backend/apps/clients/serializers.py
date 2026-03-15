from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.clients.models import Client
from apps.tasks.models import Task


class ClientListSerializer(serializers.ModelSerializer):
    tasks_count = serializers.IntegerField(read_only=True, default=0, help_text="Total number of tasks linked to this client.")

    class Meta:
        model = Client
        fields = [
            "id", "name", "client_type", "phone", "email",
            "contact_person", "created_at", "tasks_count",
        ]


class ClientDetailSerializer(serializers.ModelSerializer):
    task_summary = serializers.SerializerMethodField()
    _status_annotations = {
        s: Count("tasks", filter=Q(tasks__status=s))
        for s in Task.Status.values
    }

    class Meta:
        model = Client
        fields = [
            "id", "name", "client_type", "phone", "email",
            "contact_person", "created_at", "task_summary",
        ]

    @extend_schema_field(serializers.DictField(child=serializers.IntegerField(), help_text="Task count breakdown by status: {total, created, in_progress, waiting, done, archived}."))
    def get_task_summary(self, obj):
        total = sum(getattr(obj, f"tasks_{s}", 0) for s in Task.Status.values)
        by_status = {s: getattr(obj, f"tasks_{s}", 0) for s in Task.Status.values}
        return {"total": total, **by_status}


class ClientCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["name", "client_type", "phone", "email", "contact_person"]

    def validate_name(self, value):
        request = self.context.get("request")
        if request and request.user.organization:
            qs = Client.objects.filter(name=value, organization=request.user.organization)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A client with this name already exists in your organization.")
        return value
