from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name
        token["role"] = user.role
        token["organization_id"] = user.organization_id
        token["language"] = user.language
        return token


class MeSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, validators=[validate_password],
        help_text="New password. Omit to keep current.",
    )
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "role",
            "avatar", "job_title", "skills", "bio", "language",
            "date_joined", "password",
        ]
        read_only_fields = ["id", "email", "role", "date_joined"]

    def validate_avatar(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Avatar must be under 5 MB.")
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        new_avatar = validated_data.get("avatar")
        # Delete old file when replacing or clearing avatar
        if "avatar" in validated_data and instance.avatar:
            instance.avatar.delete(save=False)
        # Handle explicit null (remove avatar)
        if new_avatar is None and "avatar" in validated_data:
            validated_data["avatar"] = ""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "phone", "is_active", "date_joined", "last_login"]
        read_only_fields = fields


class UserDetailSerializer(serializers.ModelSerializer):
    assigned_tasks_count = serializers.IntegerField(read_only=True, default=0, help_text="Number of tasks currently assigned to this user.")

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "role", "phone",
            "is_active", "date_joined", "last_login", "client",
            "assigned_tasks_count",
        ]
        read_only_fields = ["id", "date_joined", "last_login", "assigned_tasks_count"]


class UserCreateSerializer(serializers.ModelSerializer):
    ALLOWED_ROLES = {"manager", "engineer", "client"}

    password = serializers.CharField(write_only=True, validators=[validate_password], help_text="Min 8 chars, not common, not entirely numeric.")
    client_id = serializers.IntegerField(required=False, allow_null=True, help_text="Required when role='client'. FK to Client.")

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "password", "client_id", "phone", "job_title"]
        read_only_fields = ["id"]

    def validate_role(self, value):
        if value not in self.ALLOWED_ROLES:
            raise serializers.ValidationError(f"Role must be one of: {', '.join(sorted(self.ALLOWED_ROLES))}.")
        return value

    def validate(self, attrs):
        client_id = attrs.pop("client_id", None)
        if attrs.get("role") == "client" and not client_id:
            raise serializers.ValidationError({"client_id": "Required for client role."})
        if client_id:
            from apps.clients.models import Client
            try:
                attrs["client"] = Client.objects.get(pk=client_id)
            except Client.DoesNotExist:
                raise serializers.ValidationError({"client_id": "Client not found."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    ALLOWED_ROLES = {"manager", "engineer", "client"}

    password = serializers.CharField(write_only=True, required=False, validators=[validate_password], help_text="New password. Omit to keep current.")
    client_id = serializers.IntegerField(required=False, allow_null=True, help_text="FK to Client. Required for client-role users.")

    class Meta:
        model = User
        fields = ["first_name", "last_name", "role", "is_active", "password", "client_id", "phone", "job_title"]

    def validate_role(self, value):
        if value not in self.ALLOWED_ROLES:
            raise serializers.ValidationError(f"Role must be one of: {', '.join(sorted(self.ALLOWED_ROLES))}.")
        return value

    def validate(self, attrs):
        client_id = attrs.pop("client_id", None)
        if client_id is not None:
            from apps.clients.models import Client
            try:
                attrs["client"] = Client.objects.get(pk=client_id)
            except Client.DoesNotExist:
                raise serializers.ValidationError({"client_id": "Client not found."})
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
