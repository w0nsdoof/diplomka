from rest_framework import serializers

from .models import LLMModel, ReportSummary


class LLMModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMModel
        fields = ["id", "model_id", "display_name", "is_default"]


class RequestedBySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class SummaryListSerializer(serializers.ModelSerializer):
    has_versions = serializers.BooleanField(read_only=True, default=False, help_text="True if there are multiple versions (regenerations) for this period.")

    class Meta:
        model = ReportSummary
        fields = [
            "id", "period_type", "period_start", "period_end",
            "summary_text", "generation_method", "status",
            "generated_at", "has_versions",
        ]


class ScopeSerializer(serializers.Serializer):
    """Inline serializer for project/client scope info."""
    id = serializers.IntegerField()
    name = serializers.CharField()


class SummaryDetailSerializer(serializers.ModelSerializer):
    version_count = serializers.IntegerField(read_only=True, default=1, help_text="Total number of versions for this period.")
    requested_by = RequestedBySerializer(read_only=True)
    project_scope = serializers.SerializerMethodField()
    client_scope = serializers.SerializerMethodField()

    class Meta:
        model = ReportSummary
        fields = [
            "id", "period_type", "period_start", "period_end",
            "summary_text", "sections", "generation_method", "status",
            "llm_model", "prompt_tokens", "completion_tokens",
            "generation_time_ms", "raw_data", "error_message",
            "prompt_text", "requested_by", "generated_at", "version_count",
            "focus_prompt", "project_scope", "client_scope",
        ]

    def get_project_scope(self, obj):
        if obj.project_id:
            return {"id": obj.project_id, "name": obj.project.title}
        return None

    def get_client_scope(self, obj):
        if obj.client_id:
            return {"id": obj.client_id, "name": obj.client.name}
        return None


class SummaryVersionSerializer(serializers.ModelSerializer):
    requested_by = RequestedBySerializer(read_only=True)

    class Meta:
        model = ReportSummary
        fields = [
            "id", "summary_text", "generation_method", "status",
            "generated_at", "requested_by",
        ]


class GenerateRequestSerializer(serializers.Serializer):
    period_start = serializers.DateField(help_text="Start date (YYYY-MM-DD). Must be <= period_end.")
    period_end = serializers.DateField(help_text="End date (YYYY-MM-DD). Must be >= period_start.")
    project_id = serializers.IntegerField(required=False, allow_null=True, default=None,
                                          help_text="Optional project ID to scope the summary.")
    client_id = serializers.IntegerField(required=False, allow_null=True, default=None,
                                         help_text="Optional client ID to scope the summary.")
    focus_prompt = serializers.CharField(required=False, allow_blank=True, default="",
                                         max_length=500,
                                         help_text="Optional custom focus instructions for the AI.")
    llm_model_id = serializers.IntegerField(required=False, allow_null=True, default=None,
                                            help_text="Optional LLM model ID to use for generation.")

    def validate_llm_model_id(self, value):
        if value is not None and not LLMModel.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Selected LLM model is not available.")
        return value

    def validate(self, data):
        if data["period_end"] < data["period_start"]:
            raise serializers.ValidationError(
                {"period_end": "period_end must be >= period_start."}
            )
        return data


class RegenerateRequestSerializer(serializers.Serializer):
    llm_model_id = serializers.IntegerField(required=False, allow_null=True, default=None,
                                            help_text="Optional LLM model ID to use for regeneration.")

    def validate_llm_model_id(self, value):
        if value is not None and not LLMModel.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Selected LLM model is not available.")
        return value


class OrgDefaultModelSerializer(serializers.Serializer):
    default_llm_model_id = serializers.IntegerField(allow_null=True,
                                                     help_text="LLM model ID to set as org default, or null to clear.")

    def validate_default_llm_model_id(self, value):
        if value is not None and not LLMModel.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Selected LLM model is not available.")
        return value
