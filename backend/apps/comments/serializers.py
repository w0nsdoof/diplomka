from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.comments.models import Comment

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "role"]


class MentionSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name"]


class CommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)
    mentions = MentionSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "author", "content", "is_public", "mentions", "created_at"]
        read_only_fields = ["id", "author", "mentions", "created_at"]


class CommentCreateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1)
    is_public = serializers.BooleanField(default=True)
