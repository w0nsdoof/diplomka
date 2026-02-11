import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def check_approaching_deadlines():
    from apps.notifications.services import create_notification
    from apps.tasks.models import Task

    now = timezone.now()
    deadline_threshold = now + timedelta(hours=24)

    tasks = Task.objects.filter(
        deadline__gte=now,
        deadline__lte=deadline_threshold,
        status__in=["created", "in_progress", "waiting"],
    ).prefetch_related("assignees")

    count = 0
    for task in tasks:
        from apps.notifications.models import Notification
        for assignee in task.assignees.all():
            already_notified = Notification.objects.filter(
                recipient=assignee,
                task=task,
                event_type="deadline_warning",
                created_at__gte=now - timedelta(hours=24),
            ).exists()
            if not already_notified:
                create_notification(
                    recipient=assignee,
                    event_type="deadline_warning",
                    task=task,
                    message=f"Task '{task.title}' deadline is approaching: {task.deadline.strftime('%Y-%m-%d %H:%M')}",
                )
                count += 1

        if task.created_by:
            already_notified = Notification.objects.filter(
                recipient=task.created_by,
                task=task,
                event_type="deadline_warning",
                created_at__gte=now - timedelta(hours=24),
            ).exists()
            if not already_notified:
                create_notification(
                    recipient=task.created_by,
                    event_type="deadline_warning",
                    task=task,
                    message=f"Task '{task.title}' deadline is approaching: {task.deadline.strftime('%Y-%m-%d %H:%M')}",
                )
                count += 1

    logger.info("Deadline check complete: %d warnings sent", count)
    return f"Sent {count} deadline warning notifications"


@shared_task
def send_client_status_email(task_id, old_status, new_status):
    from django.core.mail import send_mail
    from apps.tasks.models import Task

    try:
        task = Task.objects.select_related("client").get(pk=task_id)
    except Task.DoesNotExist:
        logger.warning("send_client_status_email: task %s not found", task_id)
        return

    if not task.client:
        return

    portal_users = task.client.portal_users.filter(is_active=True)
    emails = [u.email for u in portal_users if u.email]
    if not emails:
        return

    logger.info(
        "Sending status email task=%s %s->%s to %d recipients",
        task_id, old_status, new_status, len(emails),
    )
    send_mail(
        subject=f"Ticket #{task.id} status updated: {new_status}",
        message=f"Your ticket '{task.title}' has been updated from {old_status} to {new_status}.",
        from_email=None,
        recipient_list=emails,
        fail_silently=True,
    )
