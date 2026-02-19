import io
import logging

from django.db.models import Count, Q
from django.utils import timezone
from openpyxl import Workbook
from weasyprint import HTML

from apps.tasks.models import Task

logger = logging.getLogger(__name__)


def get_report_data(date_from=None, date_to=None, client_id=None, organization=None):
    qs = Task.objects.all()

    if organization:
        qs = qs.filter(organization=organization)
    if date_from:
        qs = qs.filter(created_at__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__lte=date_to)
    if client_id:
        qs = qs.filter(client_id=client_id)

    total = qs.count()
    by_status = {}
    for s in Task.Status.values:
        by_status[s] = qs.filter(status=s).count()

    by_priority = {}
    for p in Task.Priority.values:
        by_priority[p] = qs.filter(priority=p).count()

    now = timezone.now()
    overdue = qs.filter(deadline__lt=now).exclude(status__in=["done", "archived"]).count()

    created_in_period = qs.count()
    closed_in_period = qs.filter(status="done").count()

    by_client = list(
        qs.filter(client__isnull=False)
        .values("client__id", "client__name")
        .annotate(
            total=Count("id"),
            created=Count("id", filter=Q(status="created")),
            done=Count("id", filter=Q(status="done")),
        )
        .order_by("-total")
    )

    by_engineer = list(
        qs.filter(assignees__isnull=False)
        .values("assignees__id", "assignees__first_name", "assignees__last_name")
        .annotate(
            assigned=Count("id", distinct=True),
            done=Count("id", filter=Q(status="done"), distinct=True),
        )
        .order_by("-assigned")
    )

    return {
        "period": {
            "from": str(date_from) if date_from else None,
            "to": str(date_to) if date_to else None,
        },
        "tasks": {
            "total": total,
            "by_status": by_status,
            "by_priority": by_priority,
            "created_in_period": created_in_period,
            "closed_in_period": closed_in_period,
            "overdue": overdue,
        },
        "by_client": [
            {
                "client_id": c["client__id"],
                "client_name": c["client__name"],
                "total": c["total"],
                "created": c["created"],
                "done": c["done"],
            }
            for c in by_client
        ],
        "by_engineer": [
            {
                "engineer_id": e["assignees__id"],
                "engineer_name": f"{e['assignees__first_name']} {e['assignees__last_name']}",
                "assigned": e["assigned"],
                "done": e["done"],
            }
            for e in by_engineer
        ],
    }


def generate_pdf_report(data):
    logger.info("Generating PDF report period=%s", data.get("period"))
    html_content = f"""
    <html>
    <head><style>
        body {{ font-family: sans-serif; padding: 20px; }}
        table {{ border-collapse: collapse; width: 100%; margin: 16px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f5f5f5; }}
        h1 {{ color: #1976d2; }}
    </style></head>
    <body>
        <h1>Task Management Report</h1>
        <p>Period: {data['period']['from'] or 'All'} to {data['period']['to'] or 'All'}</p>

        <h2>Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Tasks</td><td>{data['tasks']['total']}</td></tr>
            <tr><td>Created in Period</td><td>{data['tasks']['created_in_period']}</td></tr>
            <tr><td>Closed in Period</td><td>{data['tasks']['closed_in_period']}</td></tr>
            <tr><td>Overdue</td><td>{data['tasks']['overdue']}</td></tr>
        </table>

        <h2>By Status</h2>
        <table>
            <tr><th>Status</th><th>Count</th></tr>
            {''.join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in data['tasks']['by_status'].items())}
        </table>

        <h2>By Priority</h2>
        <table>
            <tr><th>Priority</th><th>Count</th></tr>
            {''.join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in data['tasks']['by_priority'].items())}
        </table>

        <h2>By Client</h2>
        <table>
            <tr><th>Client</th><th>Total</th><th>Created</th><th>Done</th></tr>
            {''.join(f"<tr><td>{c['client_name']}</td><td>{c['total']}</td><td>{c['created']}</td><td>{c['done']}</td></tr>" for c in data['by_client'])}
        </table>

        <h2>By Engineer</h2>
        <table>
            <tr><th>Engineer</th><th>Assigned</th><th>Done</th></tr>
            {''.join(f"<tr><td>{e['engineer_name']}</td><td>{e['assigned']}</td><td>{e['done']}</td></tr>" for e in data['by_engineer'])}
        </table>
    </body>
    </html>
    """
    pdf_buffer = io.BytesIO()
    HTML(string=html_content).write_pdf(pdf_buffer)
    pdf_buffer.seek(0)
    return pdf_buffer


def generate_excel_report(data):
    logger.info("Generating Excel report period=%s", data.get("period"))
    wb = Workbook()

    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.append(["Metric", "Value"])
    ws_summary.append(["Total Tasks", data["tasks"]["total"]])
    ws_summary.append(["Created in Period", data["tasks"]["created_in_period"]])
    ws_summary.append(["Closed in Period", data["tasks"]["closed_in_period"]])
    ws_summary.append(["Overdue", data["tasks"]["overdue"]])
    ws_summary.append([])
    ws_summary.append(["Status", "Count"])
    for k, v in data["tasks"]["by_status"].items():
        ws_summary.append([k, v])
    ws_summary.append([])
    ws_summary.append(["Priority", "Count"])
    for k, v in data["tasks"]["by_priority"].items():
        ws_summary.append([k, v])

    ws_clients = wb.create_sheet("By Client")
    ws_clients.append(["Client", "Total", "Created", "Done"])
    for c in data["by_client"]:
        ws_clients.append([c["client_name"], c["total"], c["created"], c["done"]])

    ws_engineers = wb.create_sheet("By Engineer")
    ws_engineers.append(["Engineer", "Assigned", "Done"])
    for e in data["by_engineer"]:
        ws_engineers.append([e["engineer_name"], e["assigned"], e["done"]])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
