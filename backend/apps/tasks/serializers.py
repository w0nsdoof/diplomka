from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.clients.models import Client
from apps.tags.models import Tag
from apps.tasks.models import Task

User = get_user_model()


class AssigneeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name"]


class TagBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class ClientBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["id", "name"]


class TaskListSerializer(serializers.ModelSerializer):
    client = ClientBriefSerializer(read_only=True)
    assignees = AssigneeSerializer(many=True, read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    comments_count = serializers.IntegerField(read_only=True, default=0)
    attachments_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority", "deadline",
            "created_at", "updated_at", "client", "assignees", "tags",
            "comments_count", "attachments_count",
        ]


class TaskDetailSerializer(serializers.ModelSerializer):
    client = ClientBriefSerializer(read_only=True)
    assignees = AssigneeSerializer(many=True, read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    created_by = AssigneeSerializer(read_only=True)
    comments_count = serializers.IntegerField(read_only=True, default=0)
    attachments_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "status", "priority", "deadline",
            "created_at", "updated_at", "created_by", "client", "assignees",
            "tags", "comments_count", "attachments_count", "version",
        ]


class TaskCreateSerializer(serializers.ModelSerializer):
    assignee_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    client_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Task
        fields = ["title", "description", "priority", "deadline", "client_id", "assignee_ids", "tag_ids"]

    def validate_client_id(self, value):
        if value:
            if not Client.objects.filter(pk=value).exists():
                raise serializers.ValidationError("Client not found.")
        return value

    def validate_assignee_ids(self, value):
        if value:
            engineers = User.objects.filter(pk__in=value, role="engineer", is_active=True)
            if engineers.count() != len(value):
                raise serializers.ValidationError("One or more assignees are invalid.")
        return value

    def validate_tag_ids(self, value):
        if value:
            tags = Tag.objects.filter(pk__in=value)
            if tags.count() != len(value):
                raise serializers.ValidationError("One or more tags are invalid.")
        return value

    def create(self, validated_data):
        assignee_ids = validated_data.pop("assignee_ids", [])
        tag_ids = validated_data.pop("tag_ids", [])
        client_id = validated_data.pop("client_id", None)

        if client_id:
            validated_data["client_id"] = client_id

        validated_data["created_by"] = self.context["request"].user
        task = Task.objects.create(**validated_data)

        if assignee_ids:
            task.assignees.set(assignee_ids)
            from apps.notifications.services import create_notification
            for uid in assignee_ids:
                user = User.objects.get(pk=uid)
                create_notification(
                    recipient=user,
                    event_type="task_assigned",
                    task=task,
                    message=f"You have been assigned to task '{task.title}'",
                )
        if tag_ids:
            task.tags.set(tag_ids)

        from apps.audit.services import create_audit_entry
        from apps.audit.models import AuditLogEntry
        create_audit_entry(
            task=task,
            actor=self.context["request"].user,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="task",
            new_value=f"Task '{task.title}' created",
        )

        return task


class TaskUpdateSerializer(serializers.ModelSerializer):
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )
    client_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Task
        fields = ["title", "description", "priority", "deadline", "client_id", "tag_ids"]

    def validate_client_id(self, value):
        if value:
            if not Client.objects.filter(pk=value).exists():
                raise serializers.ValidationError("Client not found.")
        return value

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        client_id = validated_data.pop("client_id", None)

        if client_id is not None:
            validated_data["client_id"] = client_id

        from apps.tasks.services import update_task_with_version
        success, error, task = update_task_with_version(
            instance, validated_data, self.context["request"].user
        )
        if not success:
            raise serializers.ValidationError(error)

        if tag_ids is not None:
            task.tags.set(tag_ids)

        return task


class TaskStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.Status.choices)
    comment = serializers.CharField(required=False, allow_blank=True)


class TaskAssignSerializer(serializers.Serializer):
    assignee_ids = serializers.ListField(child=serializers.IntegerField())

    def validate_assignee_ids(self, value):
        engineers = User.objects.filter(pk__in=value, role="engineer", is_active=True)
        if engineers.count() != len(value):
            invalid = set(value) - set(engineers.values_list("pk", flat=True))
            raise serializers.ValidationError(
                f"User(s) with ID(s) {invalid} do not exist or are not engineers."
            )
        return value
