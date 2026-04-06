import logging

from django.db.models import F

from apps.audit.models import AuditLogEntry

logger = logging.getLogger(__name__)


def update_with_version(instance, validated_data, actor, *,
                        excluded_fields=("tag_ids", "version")):
    """Generic optimistic-locking update with audit trail.

    Returns (success, error_message, updated_instance).
    """
    model_class = type(instance)
    model_name = model_class.__name__.lower()

    old_values = {}
    for field in validated_data:
        if field in excluded_fields:
            continue
        old_values[field] = str(getattr(instance, field, ""))

    update_fields = {
        k: v for k, v in validated_data.items() if k not in excluded_fields
    }
    if not update_fields:
        return True, None, instance

    rows = model_class.objects.filter(
        pk=instance.pk, version=instance.version
    ).update(version=F("version") + 1, **update_fields)

    if rows == 0:
        logger.warning(
            "Optimistic lock conflict %s=%s version=%s actor=%s",
            model_name, instance.pk, instance.version, actor.pk,
        )
        return False, f"Conflict: {model_name} was modified by another user.", None

    instance.refresh_from_db()
    logger.info(
        "%s updated %s=%s fields=%s actor=%s",
        model_name.capitalize(), model_name, instance.pk,
        list(update_fields.keys()), actor.pk,
    )

    audit_kwargs = {model_name: instance}
    for field, new_value in update_fields.items():
        old_val = old_values.get(field, "")
        new_val = str(new_value)
        if old_val != new_val:
            AuditLogEntry.objects.create(
                actor=actor,
                action=AuditLogEntry.Action.FIELD_UPDATE,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
                **audit_kwargs,
            )

    return True, None, instance


def apply_versioned_status_change(instance, new_status, actor):
    """Generic optimistic-locking status change with audit trail.

    Returns (success, error_message, updated_instance).
    """
    model_class = type(instance)
    model_name = model_class.__name__.lower()
    old_status = instance.status

    rows = model_class.objects.filter(
        pk=instance.pk, version=instance.version
    ).update(status=new_status, version=F("version") + 1)

    if rows == 0:
        logger.warning(
            "Optimistic lock conflict %s=%s version=%s actor=%s",
            model_name, instance.pk, instance.version, actor.pk,
        )
        return False, f"Conflict: {model_name} was modified by another user.", None

    instance.refresh_from_db()
    logger.info(
        "Status changed %s=%s from=%s to=%s actor=%s",
        model_name, instance.pk, old_status, new_status, actor.pk,
    )

    audit_kwargs = {model_name: instance}
    AuditLogEntry.objects.create(
        actor=actor,
        action=AuditLogEntry.Action.STATUS_CHANGE,
        field_name="status",
        old_value=old_status,
        new_value=new_status,
        **audit_kwargs,
    )

    return True, None, instance
