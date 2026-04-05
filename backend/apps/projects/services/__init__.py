import logging

from django.db.models import F

from apps.audit.models import AuditLogEntry
from apps.projects.models import Epic, Project

logger = logging.getLogger(__name__)


def update_project_with_version(project, validated_data, actor):
    old_values = {}
    for field, value in validated_data.items():
        if field in ("tag_ids", "version"):
            continue
        old_values[field] = str(getattr(project, field, ""))

    update_fields = {k: v for k, v in validated_data.items() if k not in ("tag_ids", "version")}
    if not update_fields:
        return True, None, project

    rows = Project.objects.filter(pk=project.pk, version=project.version).update(
        version=F("version") + 1,
        **update_fields,
    )
    if rows == 0:
        logger.warning(
            "Optimistic lock conflict project=%s version=%s actor=%s",
            project.pk, project.version, actor.pk,
        )
        return False, "Conflict: project was modified by another user.", None

    project.refresh_from_db()
    logger.info(
        "Project updated project=%s fields=%s actor=%s",
        project.pk, list(update_fields.keys()), actor.pk,
    )

    for field, new_value in update_fields.items():
        old_val = old_values.get(field, "")
        new_val = str(new_value)
        if old_val != new_val:
            AuditLogEntry.objects.create(
                project=project,
                actor=actor,
                action=AuditLogEntry.Action.FIELD_UPDATE,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
            )

    return True, None, project


def update_epic_with_version(epic, validated_data, actor):
    old_values = {}
    for field, value in validated_data.items():
        if field in ("tag_ids", "version"):
            continue
        old_values[field] = str(getattr(epic, field, ""))

    update_fields = {k: v for k, v in validated_data.items() if k not in ("tag_ids", "version")}
    if not update_fields:
        return True, None, epic

    rows = Epic.objects.filter(pk=epic.pk, version=epic.version).update(
        version=F("version") + 1,
        **update_fields,
    )
    if rows == 0:
        logger.warning(
            "Optimistic lock conflict epic=%s version=%s actor=%s",
            epic.pk, epic.version, actor.pk,
        )
        return False, "Conflict: epic was modified by another user.", None

    epic.refresh_from_db()
    logger.info(
        "Epic updated epic=%s fields=%s actor=%s",
        epic.pk, list(update_fields.keys()), actor.pk,
    )

    for field, new_value in update_fields.items():
        old_val = old_values.get(field, "")
        new_val = str(new_value)
        if old_val != new_val:
            AuditLogEntry.objects.create(
                epic=epic,
                actor=actor,
                action=AuditLogEntry.Action.FIELD_UPDATE,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
            )

    return True, None, epic


def apply_project_status_change(project, new_status, actor):
    old_status = project.status

    rows = Project.objects.filter(pk=project.pk, version=project.version).update(
        status=new_status,
        version=F("version") + 1,
    )
    if rows == 0:
        logger.warning(
            "Optimistic lock conflict project=%s version=%s actor=%s",
            project.pk, project.version, actor.pk,
        )
        return False, "Conflict: project was modified by another user.", None

    project.refresh_from_db()
    logger.info(
        "Status changed project=%s from=%s to=%s actor=%s",
        project.pk, old_status, new_status, actor.pk,
    )

    AuditLogEntry.objects.create(
        project=project,
        actor=actor,
        action=AuditLogEntry.Action.STATUS_CHANGE,
        field_name="status",
        old_value=old_status,
        new_value=new_status,
    )

    return True, None, project


def apply_epic_status_change(epic, new_status, actor):
    old_status = epic.status

    rows = Epic.objects.filter(pk=epic.pk, version=epic.version).update(
        status=new_status,
        version=F("version") + 1,
    )
    if rows == 0:
        logger.warning(
            "Optimistic lock conflict epic=%s version=%s actor=%s",
            epic.pk, epic.version, actor.pk,
        )
        return False, "Conflict: epic was modified by another user.", None

    epic.refresh_from_db()
    logger.info(
        "Status changed epic=%s from=%s to=%s actor=%s",
        epic.pk, old_status, new_status, actor.pk,
    )

    AuditLogEntry.objects.create(
        epic=epic,
        actor=actor,
        action=AuditLogEntry.Action.STATUS_CHANGE,
        field_name="status",
        old_value=old_status,
        new_value=new_status,
    )

    return True, None, epic
