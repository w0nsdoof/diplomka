from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.clients.models import Client
from apps.projects.models import Epic
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
        fields = ["id", "name", "color"]


class ClientBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["id", "name"]


# --- Hierarchy helper serializers ---

class EpicBriefSerializer(serializers.ModelSerializer):
    """Brief epic info for task list view: {id, title}."""

    class Meta:
        model = Epic
        fields = ["id", "title"]


class ProjectBriefSerializer(serializers.Serializer):
    """Inline project info: {id, title}."""
    id = serializers.IntegerField()
    title = serializers.CharField()


class EpicDetailBriefSerializer(serializers.ModelSerializer):
    """Epic info for task detail view: {id, title, project: {id, title} | null}."""
    project = ProjectBriefSerializer(read_only=True)

    class Meta:
        model = Epic
        fields = ["id", "title", "project"]


class ParentTaskBriefSerializer(serializers.ModelSerializer):
    """Brief parent task info: {id, title}."""

    class Meta:
        model = Task
        fields = ["id", "title"]


class SubtaskSummarySerializer(serializers.ModelSerializer):
    """Subtask summary for detail view: {id, title, status, priority, deadline, assignees}."""
    assignees = AssigneeSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = ["id", "title", "status", "priority", "deadline", "assignees"]


# --- Main serializers ---

class TaskListSerializer(serializers.ModelSerializer):
    client = ClientBriefSerializer(read_only=True)
    assignees = AssigneeSerializer(many=True, read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    comments_count = serializers.IntegerField(read_only=True, default=0, help_text="Number of comments on this task.")
    attachments_count = serializers.IntegerField(read_only=True, default=0, help_text="Number of attachments on this task.")
    entity_type = serializers.SerializerMethodField()
    epic = EpicBriefSerializer(read_only=True)
    parent_task = ParentTaskBriefSerializer(read_only=True)
    subtasks_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority", "deadline",
            "created_at", "updated_at", "client", "assignees", "tags",
            "comments_count", "attachments_count",
            "entity_type", "epic", "parent_task", "subtasks_count",
        ]

    def get_entity_type(self, obj):
        return obj.entity_type


class TaskDetailSerializer(serializers.ModelSerializer):
    client = ClientBriefSerializer(read_only=True)
    assignees = AssigneeSerializer(many=True, read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    created_by = AssigneeSerializer(read_only=True)
    comments_count = serializers.IntegerField(read_only=True, default=0)
    attachments_count = serializers.IntegerField(read_only=True, default=0)
    entity_type = serializers.SerializerMethodField()
    epic = EpicDetailBriefSerializer(read_only=True)
    parent_task = ParentTaskBriefSerializer(read_only=True)
    subtasks_count = serializers.IntegerField(read_only=True, default=0)
    subtasks = SubtaskSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "status", "priority", "deadline",
            "created_at", "updated_at", "created_by", "client", "assignees",
            "tags", "comments_count", "attachments_count", "version",
            "entity_type", "epic", "parent_task", "subtasks_count", "subtasks",
        ]

    def get_entity_type(self, obj):
        return obj.entity_type


def _validate_subtask_constraints(data, parent_task_id):
    """Shared validation for subtask creation constraints."""
    parent = Task.objects.filter(pk=parent_task_id).first()
    if parent is None:
        raise serializers.ValidationError({"parent_task_id": "Parent task not found."})
    if parent.parent_task_id is not None:
        raise serializers.ValidationError(
            {"parent_task_id": "Cannot nest subtasks more than one level deep."}
        )
    # Subtask assignees limited to 0-1
    assignee_ids = data.get("assignee_ids", [])
    if len(assignee_ids) > 1:
        raise serializers.ValidationError(
            {"assignee_ids": "Subtasks can have at most one assignee."}
        )
    return parent


class TaskCreateSerializer(serializers.ModelSerializer):
    assignee_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of user IDs to assign. Must be active engineers. Manager-only.",
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of tag IDs to attach.",
    )
    client_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to Client.")
    epic_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to Epic.")
    parent_task_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to parent Task (creates a subtask).")

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "priority", "deadline",
            "client_id", "assignee_ids", "tag_ids",
            "epic_id", "parent_task_id",
        ]
        read_only_fields = ["id"]

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

    def validate_epic_id(self, value):
        if value:
            org = self.context["request"].user.organization
            if not Epic.objects.filter(pk=value, organization=org).exists():
                raise serializers.ValidationError("Epic not found or does not belong to your organization.")
        return value

    def validate(self, data):
        parent_task_id = data.get("parent_task_id")
        if parent_task_id:
            org = self.context["request"].user.organization
            parent = _validate_subtask_constraints(data, parent_task_id)
            if parent.organization_id != org.id:
                raise serializers.ValidationError(
                    {"parent_task_id": "Parent task not found or does not belong to your organization."}
                )
            # Force client_id to null for subtasks
            data["client_id"] = None
        return data

    @transaction.atomic
    def create(self, validated_data):
        assignee_ids = validated_data.pop("assignee_ids", [])
        tag_ids = validated_data.pop("tag_ids", [])
        client_id = validated_data.pop("client_id", None)
        epic_id = validated_data.pop("epic_id", None)
        parent_task_id = validated_data.pop("parent_task_id", None)

        if client_id:
            validated_data["client_id"] = client_id
        if epic_id:
            validated_data["epic_id"] = epic_id
        if parent_task_id:
            validated_data["parent_task_id"] = parent_task_id

        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["organization"] = user.organization
        task = Task.objects.create(**validated_data)

        if assignee_ids:
            task.assignees.set(assignee_ids)
            from apps.notifications.services import create_notification
            from apps.telegram.templates import build_telegram_context
            assignees = User.objects.filter(pk__in=assignee_ids)
            for assignee in assignees:
                ctx = build_telegram_context(
                    event_type="task_assigned", task=task, actor=user,
                )
                create_notification(
                    recipient=assignee,
                    event_type="task_assigned",
                    task=task,
                    message=f"You have been assigned to task '{task.title}'",
                    actor=user,
                    telegram_context=ctx,
                )
        if tag_ids:
            task.tags.set(tag_ids)

        from apps.audit.models import AuditLogEntry
        from apps.audit.services import create_audit_entry
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
        child=serializers.IntegerField(), required=False,
        help_text="Set of tag IDs. Replaces existing tags.",
    )
    client_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to Client. Pass null to unlink.")
    epic_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to Epic. Manager-only re-parenting.")
    parent_task_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to parent Task. Manager-only re-parenting.")

    class Meta:
        model = Task
        fields = [
            "title", "description", "priority", "deadline",
            "client_id", "tag_ids",
            "epic_id", "parent_task_id",
        ]

    def validate_client_id(self, value):
        if value:
            if not Client.objects.filter(pk=value).exists():
                raise serializers.ValidationError("Client not found.")
        return value

    def validate_epic_id(self, value):
        if value:
            org = self.context["request"].user.organization
            if not Epic.objects.filter(pk=value, organization=org).exists():
                raise serializers.ValidationError("Epic not found or does not belong to your organization.")
        return value

    def validate(self, data):
        parent_task_id = data.get("parent_task_id")
        if parent_task_id:
            org = self.context["request"].user.organization
            parent = Task.objects.filter(pk=parent_task_id).first()
            if parent is None:
                raise serializers.ValidationError({"parent_task_id": "Parent task not found."})
            if parent.organization_id != org.id:
                raise serializers.ValidationError(
                    {"parent_task_id": "Parent task not found or does not belong to your organization."}
                )
            if parent.parent_task_id is not None:
                raise serializers.ValidationError(
                    {"parent_task_id": "Cannot nest subtasks more than one level deep."}
                )
            # Cannot set parent_task_id on a task that has subtasks
            if self.instance and self.instance.subtasks.exists():
                raise serializers.ValidationError(
                    {"parent_task_id": "Cannot set parent on a task that already has subtasks."}
                )
        return data

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        client_id = validated_data.pop("client_id", None)
        epic_id = validated_data.pop("epic_id", None)
        parent_task_id = validated_data.pop("parent_task_id", None)

        if client_id is not None:
            validated_data["client_id"] = client_id
        if epic_id is not None:
            validated_data["epic_id"] = epic_id
        if parent_task_id is not None:
            validated_data["parent_task_id"] = parent_task_id

        from apps.tasks.services import update_task_with_version
        success, error, task = update_task_with_version(
            instance, validated_data, self.context["request"].user
        )
        if not success:
            raise serializers.ValidationError(error)

        if tag_ids is not None:
            task.tags.set(tag_ids)

        return task


class TaskCreateEngineerSerializer(serializers.ModelSerializer):
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    epic_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to Epic.")
    parent_task_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to parent Task (creates a subtask).")

    class Meta:
        model = Task
        fields = ["id", "title", "description", "priority", "deadline", "tag_ids", "epic_id", "parent_task_id"]
        read_only_fields = ["id"]

    def validate_tag_ids(self, value):
        if value:
            tags = Tag.objects.filter(pk__in=value)
            if tags.count() != len(value):
                raise serializers.ValidationError("One or more tags are invalid.")
        return value

    def validate_epic_id(self, value):
        if value:
            org = self.context["request"].user.organization
            if not Epic.objects.filter(pk=value, organization=org).exists():
                raise serializers.ValidationError("Epic not found or does not belong to your organization.")
        return value

    def validate(self, data):
        parent_task_id = data.get("parent_task_id")
        if parent_task_id:
            org = self.context["request"].user.organization
            parent = _validate_subtask_constraints(data, parent_task_id)
            if parent.organization_id != org.id:
                raise serializers.ValidationError(
                    {"parent_task_id": "Parent task not found or does not belong to your organization."}
                )
        return data

    @transaction.atomic
    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        epic_id = validated_data.pop("epic_id", None)
        parent_task_id = validated_data.pop("parent_task_id", None)

        if epic_id:
            validated_data["epic_id"] = epic_id
        if parent_task_id:
            validated_data["parent_task_id"] = parent_task_id

        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["organization"] = user.organization
        task = Task.objects.create(**validated_data)

        if tag_ids:
            task.tags.set(tag_ids)

        from apps.audit.models import AuditLogEntry
        from apps.audit.services import create_audit_entry
        create_audit_entry(
            task=task,
            actor=user,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="task",
            new_value=f"Task '{task.title}' created",
        )

        return task


class TaskUpdateEngineerSerializer(serializers.ModelSerializer):
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )

    class Meta:
        model = Task
        fields = ["title", "description", "priority", "deadline", "tag_ids"]

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)

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
    status = serializers.ChoiceField(choices=Task.Status.choices, help_text="Target status. Must be a valid transition from current status.")
    comment = serializers.CharField(required=False, allow_blank=True, help_text="Optional comment recorded with the status change.")


class TaskAssignSerializer(serializers.Serializer):
    assignee_ids = serializers.ListField(child=serializers.IntegerField(), help_text="Full list of user IDs to assign. Replaces existing. All must be active engineers.")

    def validate_assignee_ids(self, value):
        engineers = User.objects.filter(pk__in=value, role="engineer", is_active=True)
        if engineers.count() != len(value):
            invalid = set(value) - set(engineers.values_list("pk", flat=True))
            raise serializers.ValidationError(
                f"User(s) with ID(s) {invalid} do not exist or are not engineers."
            )
        return value
