
from django.http import FileResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsManager
from apps.reports.services import generate_excel_report, generate_pdf_report, get_report_data


class ReportSummaryView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_id = request.query_params.get("client_id")
        data = get_report_data(date_from, date_to, client_id)
        return Response(data)


class ReportPDFExportView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_id = request.query_params.get("client_id")
        data = get_report_data(date_from, date_to, client_id)
        pdf_buffer = generate_pdf_report(data)

        filename = f"report_{date_from or 'all'}_{date_to or 'all'}.pdf"
        return FileResponse(
            pdf_buffer,
            content_type="application/pdf",
            as_attachment=True,
            filename=filename,
        )


class ReportExcelExportView(APIView):
    permission_classes = [IsManager]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_id = request.query_params.get("client_id")
        data = get_report_data(date_from, date_to, client_id)
        excel_buffer = generate_excel_report(data)

        filename = f"report_{date_from or 'all'}_{date_to or 'all'}.xlsx"
        return FileResponse(
            excel_buffer,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            filename=filename,
        )
