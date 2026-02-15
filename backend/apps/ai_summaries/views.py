from django.db.models import Count, OuterRef, Subquery
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsManager

from .models import ReportSummary
from .serializers import (
    GenerateRequestSerializer,
    SummaryDetailSerializer,
    SummaryListSerializer,
    SummaryVersionSerializer,
)
from .tasks import generate_summary


class SummaryLatestView(APIView):
    """GET /api/summaries/latest/ — latest completed daily and weekly summaries."""
    permission_classes = [IsManager]

    @extend_schema(
        summary="Get latest summaries",
        description="Returns the most recent completed daily and weekly summaries.",
        responses={200: dict},
        tags=["Summaries"],
    )
    def get(self, request):
        daily = ReportSummary.objects.filter(
            period_type=ReportSummary.PeriodType.DAILY,
            status=ReportSummary.Status.COMPLETED,
        ).first()

        weekly = ReportSummary.objects.filter(
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
    permission_classes = [IsManager]

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
        latest_ids_subquery = (
            ReportSummary.objects.filter(
                period_type=OuterRef("period_type"),
                period_start=OuterRef("period_start"),
                period_end=OuterRef("period_end"),
            )
            .order_by("-generated_at")
            .values("id")[:1]
        )

        qs = ReportSummary.objects.filter(
            id=Subquery(latest_ids_subquery),
        ).order_by("-generated_at")

        version_count = (
            ReportSummary.objects.filter(
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
    permission_classes = [IsManager]

    @extend_schema(
        summary="Get summary detail",
        description="Returns full detail of a specific summary including raw metrics data.",
        tags=["Summaries"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return ReportSummary.objects.select_related("requested_by").annotate(
            version_count=Subquery(
                ReportSummary.objects.filter(
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
    permission_classes = [IsManager]

    @extend_schema(
        summary="List summary versions",
        description="Returns all versions for the same period group, ordered by newest first.",
        responses={200: SummaryVersionSerializer(many=True)},
        tags=["Summaries"],
    )
    def get(self, request, pk):
        try:
            summary = ReportSummary.objects.get(pk=pk)
        except ReportSummary.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        versions = ReportSummary.objects.filter(
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

        in_progress = ReportSummary.objects.filter(
            period_type=ReportSummary.PeriodType.ON_DEMAND,
            period_start=period_start,
            period_end=period_end,
            status__in=[ReportSummary.Status.PENDING, ReportSummary.Status.GENERATING],
        ).exists()
        if in_progress:
            return Response(
                {"detail": "Summary generation already in progress for this period."},
                status=status.HTTP_409_CONFLICT,
            )

        summary = ReportSummary.objects.create(
            period_type=ReportSummary.PeriodType.ON_DEMAND,
            period_start=period_start,
            period_end=period_end,
            status=ReportSummary.Status.PENDING,
            requested_by=request.user,
        )

        generate_summary.delay(
            "on_demand", str(period_start), str(period_end),
            summary_id=summary.id,
        )

        detail_serializer = SummaryDetailSerializer(summary)
        return Response(detail_serializer.data, status=status.HTTP_202_ACCEPTED)


class SummaryRegenerateView(APIView):
    """POST /api/summaries/{id}/regenerate/ — regenerate an existing summary."""
    permission_classes = [IsManager]

    @extend_schema(
        summary="Regenerate a summary",
        description="Creates a new version of an existing summary. Returns immediately with pending new version.",
        request=None,
        responses={
            202: SummaryDetailSerializer,
            404: OpenApiResponse(description="Summary not found"),
            409: OpenApiResponse(description="Regeneration already in progress"),
        },
        tags=["Summaries"],
    )
    def post(self, request, pk):
        try:
            original = ReportSummary.objects.get(pk=pk)
        except ReportSummary.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        in_progress = ReportSummary.objects.filter(
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
            period_type=original.period_type,
            period_start=original.period_start,
            period_end=original.period_end,
            status=ReportSummary.Status.PENDING,
            requested_by=request.user,
        )

        generate_summary.delay(
            original.period_type, str(original.period_start), str(original.period_end),
            summary_id=summary.id,
        )

        detail_serializer = SummaryDetailSerializer(summary)
        return Response(detail_serializer.data, status=status.HTTP_202_ACCEPTED)
