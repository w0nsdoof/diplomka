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
        return token


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "is_active", "date_joined", "last_login"]
        read_only_fields = fields


class UserDetailSerializer(serializers.ModelSerializer):
    assigned_tasks_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "role",
            "is_active", "date_joined", "last_login", "client",
            "assigned_tasks_count",
        ]
        read_only_fields = ["id", "date_joined", "last_login", "assigned_tasks_count"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    client_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "password", "client_id"]
        read_only_fields = ["id"]

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
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    client_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "role", "is_active", "password", "client_id"]

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
