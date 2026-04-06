from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.common.validators import CommonValidatorsMixin
from apps.projects.models import Epic, Project
from apps.tags.models import Tag
from apps.tasks.serializers import AssigneeSerializer, ClientBriefSerializer, TagBriefSerializer

User = get_user_model()


# ---------------------------------------------------------------------------
# Nested read-only helpers
# ---------------------------------------------------------------------------

class ProjectBriefSerializer(serializers.ModelSerializer):
    """Minimal project representation used inside EpicListSerializer."""

    class Meta:
        model = Project
        fields = ["id", "title"]


# ---------------------------------------------------------------------------
# Project serializers
# ---------------------------------------------------------------------------

class ProjectListSerializer(serializers.ModelSerializer):
    assignee = AssigneeSerializer(read_only=True)
    client = ClientBriefSerializer(read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    team = AssigneeSerializer(many=True, read_only=True)
    epics_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = [
            "id", "title", "description", "status", "priority", "deadline",
            "assignee", "client", "tags", "team", "epics_count",
            "created_at", "updated_at",
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    assignee = AssigneeSerializer(read_only=True)
    client = ClientBriefSerializer(read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    team = AssigneeSerializer(many=True, read_only=True)
    created_by = AssigneeSerializer(read_only=True)
    epics_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = [
            "id", "title", "description", "status", "priority", "deadline",
            "assignee", "client", "tags", "team", "created_by",
            "epics_count", "version", "created_at", "updated_at",
        ]


class ProjectCreateSerializer(CommonValidatorsMixin, serializers.ModelSerializer):
    assignee_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to User (assignee)."
    )
    client_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Client."
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of tag IDs to attach.",
    )
    team_member_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of user IDs for the project team.",
    )

    class Meta:
        model = Project
        fields = ["id", "title", "description", "priority", "deadline", "assignee_id", "client_id", "tag_ids", "team_member_ids"]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        assignee_id = validated_data.pop("assignee_id", None)
        client_id = validated_data.pop("client_id", None)
        tag_ids = validated_data.pop("tag_ids", [])
        team_member_ids = validated_data.pop("team_member_ids", [])

        if assignee_id is not None:
            validated_data["assignee_id"] = assignee_id
        if client_id is not None:
            validated_data["client_id"] = client_id

        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["organization"] = user.organization
        project = Project.objects.create(**validated_data)

        if tag_ids:
            project.tags.set(tag_ids)

        if team_member_ids:
            project.team.set(team_member_ids)

        from apps.audit.models import AuditLogEntry
        from apps.audit.services import create_audit_entry

        create_audit_entry(
            project=project,
            actor=user,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="project",
            new_value=f"Project '{project.title}' created",
        )

        if assignee_id and assignee_id != user.pk:
            from apps.notifications.services import create_notification
            from apps.telegram.templates import build_telegram_context

            assignee = User.objects.get(pk=assignee_id)
            ctx = build_telegram_context(
                event_type="project_assigned", project=project, actor=user,
            )
            create_notification(
                recipient=assignee,
                event_type="project_assigned",
                project=project,
                message=f"You have been assigned to project '{project.title}'",
                actor=user,
                telegram_context=ctx,
            )

        return project


class ProjectUpdateSerializer(CommonValidatorsMixin, serializers.ModelSerializer):
    assignee_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to User (assignee). Pass null to unlink."
    )
    client_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Client. Pass null to unlink."
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False,
        help_text="Set of tag IDs. Replaces existing tags.",
    )
    team_member_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False,
        help_text="Set of user IDs. Replaces existing team members.",
    )
    version = serializers.IntegerField(help_text="Current version for optimistic locking.")

    class Meta:
        model = Project
        fields = ["title", "description", "priority", "deadline", "assignee_id", "client_id", "tag_ids", "team_member_ids", "version"]

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        team_member_ids = validated_data.pop("team_member_ids", None)
        client_id = validated_data.pop("client_id", None)
        assignee_id = validated_data.pop("assignee_id", None)

        if client_id is not None:
            validated_data["client_id"] = client_id
        elif "client_id" in self.initial_data and self.initial_data["client_id"] is None:
            validated_data["client_id"] = None

        if assignee_id is not None:
            validated_data["assignee_id"] = assignee_id
        elif "assignee_id" in self.initial_data and self.initial_data["assignee_id"] is None:
            validated_data["assignee_id"] = None

        from apps.projects.services import update_project_with_version

        success, error, project = update_project_with_version(
            instance, validated_data, self.context["request"].user
        )
        if not success:
            raise serializers.ValidationError(error)

        if tag_ids is not None:
            project.tags.set(tag_ids)

        if team_member_ids is not None:
            project.team.set(team_member_ids)

        return project


class ProjectStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=Project.Status.choices,
        help_text="Target status. Any transition is allowed (manager-only).",
    )


# ---------------------------------------------------------------------------
# Epic serializers
# ---------------------------------------------------------------------------

class EpicListSerializer(serializers.ModelSerializer):
    project = ProjectBriefSerializer(read_only=True)
    assignee = AssigneeSerializer(read_only=True)
    client = ClientBriefSerializer(read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    tasks_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Epic
        fields = [
            "id", "title", "status", "priority", "deadline",
            "project", "assignee", "client", "tags", "tasks_count",
            "created_at", "updated_at",
        ]


class EpicDetailSerializer(serializers.ModelSerializer):
    project = ProjectBriefSerializer(read_only=True)
    assignee = AssigneeSerializer(read_only=True)
    client = ClientBriefSerializer(read_only=True)
    tags = TagBriefSerializer(many=True, read_only=True)
    created_by = AssigneeSerializer(read_only=True)
    tasks_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Epic
        fields = [
            "id", "title", "description", "status", "priority", "deadline",
            "project", "assignee", "client", "tags", "created_by",
            "tasks_count", "version", "created_at", "updated_at",
        ]


class EpicCreateSerializer(CommonValidatorsMixin, serializers.ModelSerializer):
    """Manager epic create — full field access."""

    project_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Project (nullable for standalone epics)."
    )
    assignee_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to User (assignee)."
    )
    client_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Client."
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of tag IDs to attach.",
    )

    class Meta:
        model = Epic
        fields = [
            "id", "title", "description", "priority", "deadline",
            "project_id", "assignee_id", "client_id", "tag_ids",
        ]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        project_id = validated_data.pop("project_id", None)
        assignee_id = validated_data.pop("assignee_id", None)
        client_id = validated_data.pop("client_id", None)
        tag_ids = validated_data.pop("tag_ids", [])

        if project_id is not None:
            validated_data["project_id"] = project_id
        if assignee_id is not None:
            validated_data["assignee_id"] = assignee_id
        if client_id is not None:
            validated_data["client_id"] = client_id

        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["organization"] = user.organization
        epic = Epic.objects.create(**validated_data)

        if tag_ids:
            epic.tags.set(tag_ids)

        from apps.audit.models import AuditLogEntry
        from apps.audit.services import create_audit_entry

        create_audit_entry(
            epic=epic,
            actor=user,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="epic",
            new_value=f"Epic '{epic.title}' created",
        )

        if assignee_id and assignee_id != user.pk:
            from apps.notifications.services import create_notification
            from apps.telegram.templates import build_telegram_context

            assignee = User.objects.get(pk=assignee_id)
            ctx = build_telegram_context(
                event_type="epic_assigned", epic=epic, actor=user,
            )
            create_notification(
                recipient=assignee,
                event_type="epic_assigned",
                epic=epic,
                message=f"You have been assigned to epic '{epic.title}'",
                actor=user,
                telegram_context=ctx,
            )

        return epic


class EpicCreateEngineerSerializer(CommonValidatorsMixin, serializers.ModelSerializer):
    """Engineer epic create — limited fields (no assignee_id, client_id)."""

    project_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Project (nullable for standalone epics)."
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
        help_text="List of tag IDs to attach.",
    )

    class Meta:
        model = Epic
        fields = ["id", "title", "description", "priority", "deadline", "project_id", "tag_ids"]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        project_id = validated_data.pop("project_id", None)
        tag_ids = validated_data.pop("tag_ids", [])

        if project_id is not None:
            validated_data["project_id"] = project_id

        user = self.context["request"].user
        validated_data["created_by"] = user
        validated_data["organization"] = user.organization
        epic = Epic.objects.create(**validated_data)

        if tag_ids:
            epic.tags.set(tag_ids)

        from apps.audit.models import AuditLogEntry
        from apps.audit.services import create_audit_entry

        create_audit_entry(
            epic=epic,
            actor=user,
            action=AuditLogEntry.Action.FIELD_UPDATE,
            field_name="epic",
            new_value=f"Epic '{epic.title}' created",
        )

        return epic


class EpicUpdateSerializer(CommonValidatorsMixin, serializers.ModelSerializer):
    """Manager epic update — full field access including project_id re-parenting."""

    project_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Project. Pass null to unlink."
    )
    assignee_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to User (assignee). Pass null to unlink."
    )
    client_id = serializers.IntegerField(
        required=False, allow_null=True, help_text="FK to Client. Pass null to unlink."
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False,
        help_text="Set of tag IDs. Replaces existing tags.",
    )
    version = serializers.IntegerField(help_text="Current version for optimistic locking.")

    class Meta:
        model = Epic
        fields = [
            "title", "description", "priority", "deadline",
            "project_id", "assignee_id", "client_id", "tag_ids", "version",
        ]

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        client_id = validated_data.pop("client_id", None)
        assignee_id = validated_data.pop("assignee_id", None)
        project_id = validated_data.pop("project_id", None)

        if client_id is not None:
            validated_data["client_id"] = client_id
        elif "client_id" in self.initial_data and self.initial_data["client_id"] is None:
            validated_data["client_id"] = None

        if assignee_id is not None:
            validated_data["assignee_id"] = assignee_id
        elif "assignee_id" in self.initial_data and self.initial_data["assignee_id"] is None:
            validated_data["assignee_id"] = None

        if project_id is not None:
            validated_data["project_id"] = project_id
        elif "project_id" in self.initial_data and self.initial_data["project_id"] is None:
            validated_data["project_id"] = None

        from apps.projects.services import update_epic_with_version

        success, error, epic = update_epic_with_version(
            instance, validated_data, self.context["request"].user
        )
        if not success:
            raise serializers.ValidationError(error)

        if tag_ids is not None:
            epic.tags.set(tag_ids)

        return epic


class EpicUpdateEngineerSerializer(CommonValidatorsMixin, serializers.ModelSerializer):
    """Engineer epic update — no assignee_id, client_id, or project_id (no re-parenting)."""

    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False,
        help_text="Set of tag IDs. Replaces existing tags.",
    )
    version = serializers.IntegerField(help_text="Current version for optimistic locking.")

    class Meta:
        model = Epic
        fields = ["title", "description", "priority", "deadline", "tag_ids", "version"]

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)

        from apps.projects.services import update_epic_with_version

        success, error, epic = update_epic_with_version(
            instance, validated_data, self.context["request"].user
        )
        if not success:
            raise serializers.ValidationError(error)

        if tag_ids is not None:
            epic.tags.set(tag_ids)

        return epic


class EpicStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=Epic.Status.choices,
        help_text="Target status. Any transition is allowed (manager-only).",
    )


# ---------------------------------------------------------------------------
# AI Task Generation serializers
# ---------------------------------------------------------------------------


class GeneratedTaskSerializer(serializers.Serializer):
    """Schema for a single AI-generated task (returned by the generation endpoint)."""
    title = serializers.CharField(help_text="Concise, actionable task title")
    description = serializers.CharField(help_text="1-3 sentences explaining what needs to be done")
    priority = serializers.ChoiceField(
        choices=["low", "medium", "high", "critical"],
        help_text="Task priority level",
    )
    assignee_id = serializers.IntegerField(
        allow_null=True,
        help_text="ID of a project team member, or null if no good match",
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="IDs of matching organization tags",
    )
    estimated_hours = serializers.FloatField(
        allow_null=True,
        help_text="Rough time estimate in hours, null if uncertain",
    )


class GenerationMetaSerializer(serializers.Serializer):
    """Metadata about the LLM generation call."""
    model = serializers.CharField(help_text="LLM model used for generation")
    prompt_tokens = serializers.IntegerField(allow_null=True, help_text="Number of prompt tokens")
    completion_tokens = serializers.IntegerField(allow_null=True, help_text="Number of completion tokens")
    generation_time_ms = serializers.IntegerField(allow_null=True, help_text="Wall-clock generation time in ms")


class GenerationResultSerializer(serializers.Serializer):
    """Full result payload when generation completes successfully."""
    tasks = GeneratedTaskSerializer(many=True, help_text="List of AI-generated tasks for review")
    warnings = serializers.ListField(
        child=serializers.CharField(),
        help_text="Validation warnings (e.g. dropped invalid assignees/tags)",
    )
    generation_meta = GenerationMetaSerializer(help_text="LLM call metadata")


class GenerationStatusSerializer(serializers.Serializer):
    """Response for polling the generation status."""
    status = serializers.ChoiceField(
        choices=["pending", "processing", "completed", "failed"],
        help_text="Current generation status",
    )
    result = GenerationResultSerializer(
        allow_null=True,
        help_text="Present only when status is 'completed'",
    )
    error = serializers.CharField(
        allow_null=True,
        help_text="Error message when status is 'failed'",
    )


class CreatedTaskSerializer(serializers.Serializer):
    """Schema for a task returned after confirmation."""
    id = serializers.IntegerField(help_text="Created task ID")
    title = serializers.CharField(help_text="Task title")
    status = serializers.CharField(help_text="Initial task status (always 'created')")


class ConfirmTasksResponseSerializer(serializers.Serializer):
    """Response after confirming and creating AI-generated tasks."""
    created_count = serializers.IntegerField(help_text="Number of tasks created")
    tasks = CreatedTaskSerializer(many=True, help_text="List of created tasks")


class ConfirmTaskItemSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="", allow_blank=True)
    priority = serializers.ChoiceField(choices=["low", "medium", "high", "critical"])
    assignee_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
    )
    estimated_hours = serializers.FloatField(required=False, allow_null=True, default=None, min_value=0)


class ConfirmTasksSerializer(serializers.Serializer):
    tasks = serializers.ListField(
        child=ConfirmTaskItemSerializer(),
        min_length=1,
        max_length=15,
    )

    def validate_tasks(self, value):
        # Collect all referenced assignee/tag IDs for bulk validation
        epic = self.context["epic"]
        project = epic.project

        # Validate assignee_ids against project team (active engineers)
        all_assignee_ids = {
            item["assignee_id"]
            for item in value
            if item.get("assignee_id") is not None
        }
        valid_team_ids = set()
        if project and all_assignee_ids:
            valid_team_ids = set(
                project.team.filter(
                    role="engineer", is_active=True, pk__in=all_assignee_ids,
                ).values_list("pk", flat=True)
            )

        # Validate tag_ids against organization
        all_tag_ids = set()
        for item in value:
            all_tag_ids.update(item.get("tag_ids", []))
        valid_tag_ids = set()
        if all_tag_ids:
            valid_tag_ids = set(
                Tag.objects.filter(
                    pk__in=all_tag_ids, organization=epic.organization,
                ).values_list("pk", flat=True)
            )

        # Silently drop invalid assignees and tags per FR-013/FR-018
        for item in value:
            if item.get("assignee_id") is not None and item["assignee_id"] not in valid_team_ids:
                item["assignee_id"] = None
            if item.get("tag_ids"):
                item["tag_ids"] = [tid for tid in item["tag_ids"] if tid in valid_tag_ids]

        return value
