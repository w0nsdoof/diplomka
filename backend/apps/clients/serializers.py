from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.clients.models import Client


class ClientListSerializer(serializers.ModelSerializer):
    tasks_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Client
        fields = [
            "id", "name", "client_type", "phone", "email",
            "contact_person", "created_at", "tasks_count",
        ]


class ClientDetailSerializer(serializers.ModelSerializer):
    task_summary = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id", "name", "client_type", "phone", "email",
            "contact_person", "created_at", "task_summary",
        ]

    def get_task_summary(self, obj):
        from apps.tasks.models import Task
        tasks = obj.tasks.all()
        total = tasks.count()
        by_status = {}
        for s in Task.Status.values:
            by_status[s] = tasks.filter(status=s).count()
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
                raise serializers.ValidationError(_("A client with this name already exists in your organization."))
        return value
