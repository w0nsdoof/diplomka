import re

from rest_framework import serializers

from apps.tags.models import Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug", "color"]
        read_only_fields = ["id", "slug"]

    def validate_color(self, value):
        if value and not re.match(r"^#[0-9a-fA-F]{6}$", value):
            raise serializers.ValidationError("Color must be a valid hex code (#RRGGBB).")
        return value
