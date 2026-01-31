from django.urls import path

from apps.reports.views import ReportExcelExportView, ReportPDFExportView, ReportSummaryView

urlpatterns = [
    path("summary/", ReportSummaryView.as_view(), name="report-summary"),
    path("export/pdf/", ReportPDFExportView.as_view(), name="report-pdf"),
    path("export/excel/", ReportExcelExportView.as_view(), name="report-excel"),
]
