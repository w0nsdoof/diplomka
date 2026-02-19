from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Count, Q
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.organizations.models import Organization

User = get_user_model()


class OrganizationListSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)
    task_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "is_active", "user_count", "task_count", "created_at"]
        read_only_fields = fields


class OrganizationDetailSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)
    manager_count = serializers.IntegerField(read_only=True)
    engineer_count = serializers.IntegerField(read_only=True)
    client_user_count = serializers.IntegerField(read_only=True)
    task_count = serializers.IntegerField(read_only=True)
    client_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id", "name", "slug", "is_active",
            "user_count", "manager_count", "engineer_count", "client_user_count",
            "task_count", "client_count",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    @staticmethod
    def annotate_queryset(qs):
        return qs.annotate(
            user_count=Count("users", distinct=True),
            manager_count=Count("users", filter=Q(users__role="manager"), distinct=True),
            engineer_count=Count("users", filter=Q(users__role="engineer"), distinct=True),
            client_user_count=Count("users", filter=Q(users__role="client"), distinct=True),
            task_count=Count("tasks", distinct=True),
            client_count=Count("clients", distinct=True),
        )


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["name"]


class OrganizationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["name", "is_active"]


class ManagerBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_active", "date_joined"]
        read_only_fields = fields


class ManagerCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(_("A user with this email already exists."))
        return value

    def create(self, validated_data):
        organization = self.context["organization"]
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            role=User.Role.MANAGER,
            organization=organization,
        )
