import json as _json

from django.conf import settings
from django.db.models import Count, OuterRef, Subquery
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from redis import Redis
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsManager, IsManagerOrEngineer

from .models import LLMModel, ReportSummary
from .serializers import (
    GenerateRequestSerializer,
    LLMModelSerializer,
    OrgDefaultModelSerializer,
    RegenerateRequestSerializer,
    SummaryDetailSerializer,
    SummaryListSerializer,
    SummaryVersionSerializer,
)
from .tasks import generate_summary


class SummaryLatestView(APIView):
    """GET /api/summaries/latest/ — latest completed daily and weekly summaries."""
    permission_classes = [IsManagerOrEngineer]

    @extend_schema(
        summary="Get latest summaries",
        description="Returns the most recent completed daily and weekly summaries.",
        responses={200: inline_serializer("LatestSummariesResponse", fields={
            "daily": SummaryListSerializer(allow_null=True),
            "weekly": SummaryListSerializer(allow_null=True),
        })},
        tags=["Summaries"],
    )
    def get(self, request):
        org = request.user.organization
        daily = ReportSummary.objects.filter(
            organization=org,
            period_type=ReportSummary.PeriodType.DAILY,
            status=ReportSummary.Status.COMPLETED,
        ).first()

        weekly = ReportSummary.objects.filter(
            organization=org,
            period_type=ReportSummary.PeriodType.WEEKLY,
            status=ReportSummary.Status.COMPLETED,
        ).first()

        return Response({
            "daily": SummaryListSerializer(daily).data if daily else None,
            "weekly": SummaryListSerializer(weekly).data if weekly else None,
        })


class SummaryListView(ListAPIView):
    """GET /api/summaries/ — paginated list, latest version per period group only."""
    serializer_class = SummaryListSerializer
    permission_classes = [IsManagerOrEngineer]
    queryset = ReportSummary.objects.none()

    @extend_schema(
        summary="List report summaries",
        description="Returns a paginated list of report summaries (latest version per period only).",
        parameters=[
            OpenApiParameter(name="period_type", type=str, enum=["daily", "weekly", "on_demand"]),
            OpenApiParameter(name="status", type=str, enum=["pending", "generating", "completed", "failed"]),
        ],
        tags=["Summaries"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ReportSummary.objects.none()
        org = self.request.user.organization
        latest_ids_subquery = (
            ReportSummary.objects.filter(
                organization=org,
                period_type=OuterRef("period_type"),
                period_start=OuterRef("period_start"),
                period_end=OuterRef("period_end"),
            )
            .order_by("-generated_at")
            .values("id")[:1]
        )

        qs = ReportSummary.objects.filter(
            organization=org,
            id=Subquery(latest_ids_subquery),
        ).order_by("-generated_at")

        version_count = (
            ReportSummary.objects.filter(
                organization=org,
                period_type=OuterRef("period_type"),
                period_start=OuterRef("period_start"),
                period_end=OuterRef("period_end"),
            )
            .values("period_type")
            .annotate(cnt=Count("id"))
            .values("cnt")
        )
        qs = qs.annotate(
            _version_count=Subquery(version_count),
        )

        period_type = self.request.query_params.get("period_type")
        if period_type:
            qs = qs.filter(period_type=period_type)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def get_serializer(self, *args, **kwargs):
        """Inject has_versions from annotation."""
        instance = kwargs.get("instance") or (args[0] if args else None)
        if instance and kwargs.get("many"):
            for obj in instance:
                obj.has_versions = getattr(obj, "_version_count", 1) > 1
        return super().get_serializer(*args, **kwargs)


class SummaryDetailView(RetrieveAPIView):
    """GET /api/summaries/{id}/ — full detail with version count."""
    serializer_class = SummaryDetailSerializer
    permission_classes = [IsManagerOrEngineer]

    @extend_schema(
        summary="Get summary detail",
        description="Returns full detail of a specific summary including raw metrics data.",
        tags=["Summaries"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        org = self.request.user.organization
        return ReportSummary.objects.filter(organization=org).select_related("requested_by", "project", "client").annotate(
            version_count=Subquery(
                ReportSummary.objects.filter(
                    organization=org,
                    period_type=OuterRef("period_type"),
                    period_start=OuterRef("period_start"),
                    period_end=OuterRef("period_end"),
                )
                .values("period_type")
                .annotate(cnt=Count("id"))
                .values("cnt")
            ),
        )


class SummaryVersionsView(APIView):
    """GET /api/summaries/{id}/versions/ — all versions for same period group."""
    permission_classes = [IsManagerOrEngineer]

    @extend_schema(
        summary="List summary versions",
        description="Returns all versions for the same period group, ordered by newest first.",
        responses={200: SummaryVersionSerializer(many=True)},
        tags=["Summaries"],
    )
    def get(self, request, pk):
        org = request.user.organization
        try:
            summary = ReportSummary.objects.get(pk=pk, organization=org)
        except ReportSummary.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        versions = ReportSummary.objects.filter(
            organization=org,
            period_type=summary.period_type,
            period_start=summary.period_start,
            period_end=summary.period_end,
        ).select_related("requested_by").order_by("-generated_at")

        serializer = SummaryVersionSerializer(versions, many=True)
        return Response(serializer.data)


class SummaryGenerateView(APIView):
    """POST /api/summaries/generate/ — trigger on-demand summary generation."""
    permission_classes = [IsManager]

    @extend_schema(
        summary="Generate on-demand summary",
        description="Trigger AI summary generation for a custom date range. Returns immediately with pending summary.",
        request=GenerateRequestSerializer,
        responses={
            202: SummaryDetailSerializer,
            400: OpenApiResponse(description="Invalid date range"),
            409: OpenApiResponse(description="Generation already in progress"),
        },
        tags=["Summaries"],
    )
    def post(self, request):
        serializer = GenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        period_start = serializer.validated_data["period_start"]
        period_end = serializer.validated_data["period_end"]
        project_id = serializer.validated_data.get("project_id")
        client_id = serializer.validated_data.get("client_id")
        focus_prompt = serializer.validated_data.get("focus_prompt", "")
        org = request.user.organization

        in_progress_filter = {
            "organization": org,
            "period_type": ReportSummary.PeriodType.ON_DEMAND,
            "period_start": period_start,
            "period_end": period_end,
            "status__in": [ReportSummary.Status.PENDING, ReportSummary.Status.GENERATING],
            "project_id": project_id,
            "client_id": client_id,
        }
        if ReportSummary.objects.filter(**in_progress_filter).exists():
            return Response(
                {"detail": "Summary generation already in progress for this period."},
                status=status.HTTP_409_CONFLICT,
            )

        summary = ReportSummary.objects.create(
            organization=org,
            period_type=ReportSummary.PeriodType.ON_DEMAND,
            period_start=period_start,
            period_end=period_end,
            status=ReportSummary.Status.PENDING,
            requested_by=request.user,
            project_id=project_id,
            client_id=client_id,
            focus_prompt=focus_prompt,
        )

        model_override = None
        llm_model_id = serializer.validated_data.get("llm_model_id")
        if llm_model_id:
            model_override = LLMModel.objects.get(pk=llm_model_id).model_id

        generate_summary.delay(
            "on_demand", str(period_start), str(period_end),
            summary_id=summary.id,
            model_override=model_override,
        )

        detail_serializer = SummaryDetailSerializer(summary)
        return Response(detail_serializer.data, status=status.HTTP_202_ACCEPTED)


class SummaryRegenerateView(APIView):
    """POST /api/summaries/{id}/regenerate/ — regenerate an existing summary."""
    permission_classes = [IsManager]

    @extend_schema(
        summary="Regenerate a summary",
        description="Creates a new version of an existing summary. Returns immediately with pending new version.",
        request=RegenerateRequestSerializer,
        responses={
            202: SummaryDetailSerializer,
            404: OpenApiResponse(description="Summary not found"),
            409: OpenApiResponse(description="Regeneration already in progress"),
        },
        tags=["Summaries"],
    )
    def post(self, request, pk):
        serializer = RegenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        org = request.user.organization
        try:
            original = ReportSummary.objects.get(pk=pk, organization=org)
        except ReportSummary.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        in_progress = ReportSummary.objects.filter(
            organization=org,
            period_type=original.period_type,
            period_start=original.period_start,
            period_end=original.period_end,
            status__in=[ReportSummary.Status.PENDING, ReportSummary.Status.GENERATING],
        ).exists()
        if in_progress:
            return Response(
                {"detail": "Regeneration already in progress for this period."},
                status=status.HTTP_409_CONFLICT,
            )

        summary = ReportSummary.objects.create(
            organization=org,
            period_type=original.period_type,
            period_start=original.period_start,
            period_end=original.period_end,
            status=ReportSummary.Status.PENDING,
            requested_by=request.user,
        )

        model_override = None
        llm_model_id = serializer.validated_data.get("llm_model_id")
        if llm_model_id:
            model_override = LLMModel.objects.get(pk=llm_model_id).model_id

        generate_summary.delay(
            original.period_type, str(original.period_start), str(original.period_end),
            summary_id=summary.id,
            model_override=model_override,
        )

        detail_serializer = SummaryDetailSerializer(summary)
        return Response(detail_serializer.data, status=status.HTTP_202_ACCEPTED)


class SummaryGenerationStatusView(APIView):
    """GET /api/summaries/{id}/generation-status/ — poll pipeline stage during generation."""
    permission_classes = [IsManagerOrEngineer]

    @extend_schema(
        summary="Poll summary generation status",
        description=(
            "Returns the current generation status and pipeline stage for a summary. "
            "Poll until status is 'completed' or 'failed'."
        ),
        responses={
            200: inline_serializer("SummaryGenerationStatus", fields={
                "id": drf_serializers.IntegerField(),
                "status": drf_serializers.CharField(),
                "stage": drf_serializers.CharField(allow_null=True),
                "stage_meta": drf_serializers.DictField(allow_null=True),
            }),
            404: OpenApiResponse(description="Summary not found"),
        },
        tags=["Summaries"],
    )
    def get(self, request, pk):
        org = request.user.organization
        try:
            summary = ReportSummary.objects.only("id", "status").get(pk=pk, organization=org)
        except ReportSummary.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        response_data = {
            "id": summary.id,
            "status": summary.status,
            "stage": None,
            "stage_meta": {},
        }

        # Read pipeline stage from Redis (best-effort)
        try:
            redis_client = Redis.from_url(settings.CELERY_BROKER_URL)
            raw = redis_client.get(f"summary_generate:{summary.id}:stage")
            if raw:
                stage_data = _json.loads(raw)
                response_data["stage"] = stage_data.get("stage")
                response_data["stage_meta"] = stage_data.get("stage_meta", {})
        except Exception:
            pass

        return Response(response_data)


class LLMModelListView(ListAPIView):
    """GET /api/llm-models/ — list active LLM models."""

    serializer_class = LLMModelSerializer
    permission_classes = [IsManagerOrEngineer]
    pagination_class = None

    @extend_schema(
        summary="List available LLM models",
        description="Returns all active LLM models that can be selected for AI generation.",
        tags=["LLM Models"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return LLMModel.objects.filter(is_active=True)


class OrgDefaultModelView(APIView):
    """GET/PATCH /api/llm-models/org-default/ — manage organization's default LLM model."""

    permission_classes = [IsManager]

    @extend_schema(
        summary="Get organization's default LLM model",
        responses={200: inline_serializer("OrgDefaultModelResponse", fields={
            "default_llm_model": LLMModelSerializer(allow_null=True),
        })},
        tags=["LLM Models"],
    )
    def get(self, request):
        org = request.user.organization
        model = org.default_llm_model
        return Response({
            "default_llm_model": LLMModelSerializer(model).data if model else None,
        })

    @extend_schema(
        summary="Set organization's default LLM model",
        request=OrgDefaultModelSerializer,
        responses={200: inline_serializer("OrgDefaultModelPatchResponse", fields={
            "default_llm_model": LLMModelSerializer(allow_null=True),
        })},
        tags=["LLM Models"],
    )
    def patch(self, request):
        serializer = OrgDefaultModelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        org = request.user.organization
        model_id = serializer.validated_data["default_llm_model_id"]
        if model_id is not None:
            org.default_llm_model = LLMModel.objects.get(pk=model_id, is_active=True)
        else:
            org.default_llm_model = None
        org.save(update_fields=["default_llm_model"])

        model = org.default_llm_model
        return Response({
            "default_llm_model": LLMModelSerializer(model).data if model else None,
        })
