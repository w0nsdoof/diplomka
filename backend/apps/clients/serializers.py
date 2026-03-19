from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.clients.models import Client
from apps.tasks.models import Task

User = get_user_model()


class ClientEmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "job_title", "phone"]
        read_only_fields = fields


class ClientListSerializer(serializers.ModelSerializer):
    tasks_count = serializers.IntegerField(read_only=True, default=0, help_text="Total number of tasks linked to this client.")
    employee_count = serializers.IntegerField(read_only=True, default=0, help_text="Number of portal users linked to this client.")

    class Meta:
        model = Client
        fields = [
            "id", "name", "client_type", "phone", "email",
            "contact_person", "created_at", "tasks_count", "employee_count",
        ]


class ClientDetailSerializer(serializers.ModelSerializer):
    task_summary = serializers.SerializerMethodField()
    employees = ClientEmployeeSerializer(source="portal_users", many=True, read_only=True)
    employee_count = serializers.IntegerField(read_only=True, default=0)
    _status_annotations = {
        s: Count("tasks", filter=Q(tasks__status=s))
        for s in Task.Status.values
    }

    class Meta:
        model = Client
        fields = [
            "id", "name", "client_type", "phone", "email",
            "contact_person", "created_at", "task_summary",
            "employees", "employee_count",
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
