import io
import logging
from datetime import timedelta

from django.db.models import Avg, Count, F, OuterRef, Q, Subquery
from django.utils import timezone
from openpyxl import Workbook
from weasyprint import HTML

from apps.audit.models import AuditLogEntry
from apps.tasks.models import Task

logger = logging.getLogger(__name__)


def get_report_data(date_from=None, date_to=None, client_id=None, organization=None):
    # Base queryset: all tasks in org (no date filter) for current-state metrics.
    base_qs = Task.objects.all()
    if organization:
        base_qs = base_qs.filter(organization=organization)
    if client_id:
        base_qs = base_qs.filter(client_id=client_id)

    total = base_qs.count()

    status_counts = dict(
        base_qs.values("status").annotate(c=Count("id")).values_list("status", "c")
    )
    by_status = {s: status_counts.get(s, 0) for s in Task.Status.values}

    priority_counts = dict(
        base_qs.values("priority").annotate(c=Count("id")).values_list("priority", "c")
    )
    by_priority = {p: priority_counts.get(p, 0) for p in Task.Priority.values}

    now = timezone.now()
    overdue = base_qs.filter(deadline__lt=now).exclude(
        status__in=["done", "archived"]
    ).count()

    # Period-specific metrics using date filters.
    created_in_period = 0
    closed_in_period = 0
    avg_resolution_time_hours = None
    completion_rate = None

    audit_period_filter = Q()
    if organization:
        audit_period_filter &= Q(task__organization=organization)
    if client_id:
        audit_period_filter &= Q(task__client_id=client_id)

    if date_from or date_to:
        period_qs = base_qs
        if date_from:
            period_qs = period_qs.filter(created_at__gte=date_from)
            audit_period_filter &= Q(timestamp__gte=date_from)
        if date_to:
            period_qs = period_qs.filter(created_at__lte=date_to)
            audit_period_filter &= Q(timestamp__lte=date_to)
        created_in_period = period_qs.count()

        # Tasks completed during the period (via audit log).
        done_entries = AuditLogEntry.objects.filter(
            audit_period_filter,
            action=AuditLogEntry.Action.STATUS_CHANGE,
            new_value="done",
        )
        closed_in_period = done_entries.values("task_id").distinct().count()

        # Average resolution time for tasks completed in period.
        avg_result = (
            done_entries.values("task_id")
            .distinct()
            .annotate(resolution=F("timestamp") - F("task__created_at"))
            .aggregate(avg_resolution=Avg("resolution"))
        )
        if avg_result["avg_resolution"]:
            avg_resolution_time_hours = round(
                avg_result["avg_resolution"].total_seconds() / 3600, 1
            )

        if created_in_period > 0:
            completion_rate = round(closed_in_period / created_in_period * 100, 1)
    else:
        created_in_period = total
        closed_in_period = base_qs.filter(status="done").count()

    # Unassigned active tasks.
    unassigned_count = (
        base_qs.filter(assignees__isnull=True)
        .exclude(status__in=["done", "archived"])
        .count()
    )

    # Stuck waiting tasks (in waiting status for 3+ days).
    waiting_tasks = base_qs.filter(status="waiting")
    three_days_ago = now - timedelta(days=3)
    latest_waiting_entry = (
        AuditLogEntry.objects.filter(
            task=OuterRef("pk"),
            action=AuditLogEntry.Action.STATUS_CHANGE,
            new_value="waiting",
        )
        .order_by("-timestamp")
        .values("timestamp")[:1]
    )
    stuck_tasks = list(
        waiting_tasks.annotate(waiting_since=Subquery(latest_waiting_entry))
        .filter(waiting_since__lt=three_days_ago)
        .values("id", "title")[:5]
    )
    stuck_waiting = {
        "count": len(stuck_tasks),
        "tasks": stuck_tasks,
    }

    by_client = list(
        base_qs.filter(client__isnull=False)
        .values("client__id", "client__name")
        .annotate(
            total=Count("id"),
            created=Count("id", filter=Q(status="created")),
            done=Count("id", filter=Q(status="done")),
        )
        .order_by("-total")
    )

    by_engineer = list(
        base_qs.filter(assignees__isnull=False)
        .values("assignees__id", "assignees__first_name", "assignees__last_name")
        .annotate(
            assigned=Count("id", distinct=True),
            done=Count("id", filter=Q(status="done"), distinct=True),
        )
        .order_by("-assigned")
    )

    # Tag distribution.
    by_tag = list(
        base_qs.filter(tags__isnull=False)
        .values("tags__id", "tags__name")
        .annotate(count=Count("id", distinct=True))
        .order_by("-count")
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
            "avg_resolution_time_hours": avg_resolution_time_hours,
            "unassigned_count": unassigned_count,
            "stuck_waiting": stuck_waiting,
            "completion_rate": completion_rate,
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
        "by_tag": [
            {
                "tag_id": t["tags__id"],
                "tag_name": t["tags__name"],
                "count": t["count"],
            }
            for t in by_tag
        ],
    }


def generate_pdf_report(data):
    logger.info("Generating PDF report period=%s", data.get("period"))
    tasks = data["tasks"]
    avg_res = tasks.get("avg_resolution_time_hours")
    avg_res_display = f"{avg_res} hours" if avg_res is not None else "N/A"
    comp_rate = tasks.get("completion_rate")
    comp_rate_display = f"{comp_rate}%" if comp_rate is not None else "N/A"
    stuck = tasks.get("stuck_waiting", {})
    stuck_count = stuck.get("count", 0)

    tag_rows = "".join(
        f"<tr><td>{t['tag_name']}</td><td>{t['count']}</td></tr>"
        for t in data.get("by_tag", [])
    )

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
            <tr><td>Total Tasks</td><td>{tasks['total']}</td></tr>
            <tr><td>Created in Period</td><td>{tasks['created_in_period']}</td></tr>
            <tr><td>Closed in Period</td><td>{tasks['closed_in_period']}</td></tr>
            <tr><td>Overdue</td><td>{tasks['overdue']}</td></tr>
            <tr><td>Avg Resolution Time</td><td>{avg_res_display}</td></tr>
            <tr><td>Completion Rate</td><td>{comp_rate_display}</td></tr>
            <tr><td>Unassigned Active Tasks</td><td>{tasks.get('unassigned_count', 0)}</td></tr>
            <tr><td>Stuck Waiting (3+ days)</td><td>{stuck_count}</td></tr>
        </table>

        <h2>By Status</h2>
        <table>
            <tr><th>Status</th><th>Count</th></tr>
            {''.join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in tasks['by_status'].items())}
        </table>

        <h2>By Priority</h2>
        <table>
            <tr><th>Priority</th><th>Count</th></tr>
            {''.join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in tasks['by_priority'].items())}
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

        {"<h2>By Tag</h2><table><tr><th>Tag</th><th>Count</th></tr>" + tag_rows + "</table>" if tag_rows else ""}
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
    tasks = data["tasks"]

    avg_res = tasks.get("avg_resolution_time_hours")
    comp_rate = tasks.get("completion_rate")
    stuck = tasks.get("stuck_waiting", {})

    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.append(["Metric", "Value"])
    ws_summary.append(["Total Tasks", tasks["total"]])
    ws_summary.append(["Created in Period", tasks["created_in_period"]])
    ws_summary.append(["Closed in Period", tasks["closed_in_period"]])
    ws_summary.append(["Overdue", tasks["overdue"]])
    ws_summary.append(["Avg Resolution Time (hours)", avg_res if avg_res is not None else "N/A"])
    ws_summary.append(["Completion Rate (%)", comp_rate if comp_rate is not None else "N/A"])
    ws_summary.append(["Unassigned Active Tasks", tasks.get("unassigned_count", 0)])
    ws_summary.append(["Stuck Waiting (3+ days)", stuck.get("count", 0)])
    ws_summary.append([])
    ws_summary.append(["Status", "Count"])
    for k, v in tasks["by_status"].items():
        ws_summary.append([k, v])
    ws_summary.append([])
    ws_summary.append(["Priority", "Count"])
    for k, v in tasks["by_priority"].items():
        ws_summary.append([k, v])

    ws_clients = wb.create_sheet("By Client")
    ws_clients.append(["Client", "Total", "Created", "Done"])
    for c in data["by_client"]:
        ws_clients.append([c["client_name"], c["total"], c["created"], c["done"]])

    ws_engineers = wb.create_sheet("By Engineer")
    ws_engineers.append(["Engineer", "Assigned", "Done"])
    for e in data["by_engineer"]:
        ws_engineers.append([e["engineer_name"], e["assigned"], e["done"]])

    by_tag = data.get("by_tag", [])
    if by_tag:
        ws_tags = wb.create_sheet("By Tag")
        ws_tags.append(["Tag", "Count"])
        for t in by_tag:
            ws_tags.append([t["tag_name"], t["count"]])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
