import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import F

from apps.audit.models import AuditLogEntry
from apps.notifications.services import create_notification
from apps.tasks.models import Task

logger = logging.getLogger(__name__)

VALID_TRANSITIONS = {
    Task.Status.CREATED: [Task.Status.IN_PROGRESS],
    Task.Status.IN_PROGRESS: [Task.Status.WAITING, Task.Status.DONE],
    Task.Status.WAITING: [Task.Status.IN_PROGRESS],
    Task.Status.DONE: [Task.Status.IN_PROGRESS, Task.Status.ARCHIVED],
}

MANAGER_ONLY_TRANSITIONS = {
    (Task.Status.DONE, Task.Status.ARCHIVED),
}


def validate_transition(current_status, new_status):
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        return False, f"Invalid status transition from '{current_status}' to '{new_status}'."
    return True, None


def apply_status_change(task, new_status, actor, comment=None):
    old_status = task.status
    valid, error = validate_transition(old_status, new_status)
    if not valid:
        logger.warning(
            "Invalid status transition task=%s from=%s to=%s actor=%s",
            task.pk, old_status, new_status, actor.pk,
        )
        return False, error, None

    rows = Task.objects.filter(pk=task.pk, version=task.version).update(
        status=new_status,
        version=F("version") + 1,
    )
    if rows == 0:
        logger.warning("Optimistic lock conflict task=%s version=%s actor=%s", task.pk, task.version, actor.pk)
        return False, "Conflict: task was modified by another user.", None

    task.refresh_from_db()
    logger.info("Status changed task=%s from=%s to=%s actor=%s", task.pk, old_status, new_status, actor.pk)

    AuditLogEntry.objects.create(
        task=task,
        actor=actor,
        action=AuditLogEntry.Action.STATUS_CHANGE,
        field_name="status",
        old_value=old_status,
        new_value=new_status,
    )

    from apps.telegram.templates import build_telegram_context

    for assignee in task.assignees.all():
        if assignee != actor:
            ctx = build_telegram_context(
                event_type="status_changed", task=task, actor=actor,
                extra={"old_status": old_status, "new_status": new_status},
            )
            create_notification(
                recipient=assignee,
                event_type="status_changed",
                task=task,
                message=f"Task '{task.title}' status changed from {old_status} to {new_status}",
                actor=actor,
                telegram_context=ctx,
            )

    _broadcast_task_event("task_status_changed", task)

    return True, None, task


def update_task_with_version(task, validated_data, actor):
    from apps.common.services import update_with_version

    success, error, task = update_with_version(
        task, validated_data, actor,
        excluded_fields=("assignee_ids", "tag_ids"),
    )
    if success:
        _broadcast_task_event("task_updated", task)
    return success, error, task


def _broadcast_task_event(event_type, task):
    channel_layer = get_channel_layer()
    group_name = f"kanban_board_{task.organization_id}"
    logger.debug("Broadcasting %s for task=%s to group=%s", event_type, task.pk, group_name)
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "task_event",
            "event_type": event_type,
            "payload": {
                "id": task.pk,
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
                "client_id": task.client_id,
                "version": task.version,
            },
        },
    )
