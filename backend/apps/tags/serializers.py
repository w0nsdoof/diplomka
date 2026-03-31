import re

from rest_framework import serializers

from apps.tags.models import Tag


class TagSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=50, help_text="Tag display name. Must be unique within organization.")
    color = serializers.CharField(required=False, help_text="Hex color code (#RRGGBB). Default: #6c757d.")

    class Meta:
        model = Tag
        fields = ["id", "name", "color"]
        read_only_fields = ["id"]

    def validate_color(self, value):
        if value and not re.match(r"^#[0-9a-fA-F]{6}$", value):
            raise serializers.ValidationError("Color must be a valid hex code (#RRGGBB).")
        return value
