from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class CommonValidatorsMixin:
    """Shared field validators for DRF serializers.

    DRF only calls validate_<field> if that field exists on the serializer,
    so it is safe to include all validators even when only some are needed.
    """

    def validate_assignee_id(self, value):
        if value is not None:
            if not User.objects.filter(pk=value, is_active=True).exists():
                raise serializers.ValidationError("Assignee not found or inactive.")
        return value

    def validate_client_id(self, value):
        if value is not None:
            from apps.clients.models import Client

            if not Client.objects.filter(pk=value).exists():
                raise serializers.ValidationError("Client not found.")
        return value

    def validate_tag_ids(self, value):
        if value:
            from apps.tags.models import Tag

            if Tag.objects.filter(pk__in=value).count() != len(value):
                raise serializers.ValidationError("One or more tags are invalid.")
        return value

    def validate_team_member_ids(self, value):
        if value:
            if User.objects.filter(pk__in=value, is_active=True).count() != len(value):
                raise serializers.ValidationError(
                    "One or more team members not found or inactive."
                )
        return value

    def validate_project_id(self, value):
        if value is not None:
            from apps.projects.models import Project

            user = self.context["request"].user
            if not Project.objects.filter(
                pk=value, organization=user.organization
            ).exists():
                raise serializers.ValidationError(
                    "Project not found or belongs to different organization."
                )
        return value

    def validate_epic_id(self, value):
        if value:
            from apps.projects.models import Epic

            org = self.context["request"].user.organization
            if not Epic.objects.filter(pk=value, organization=org).exists():
                raise serializers.ValidationError(
                    "Epic not found or does not belong to your organization."
                )
        return value
