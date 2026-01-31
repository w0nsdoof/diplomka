from apps.audit.models import AuditLogEntry


def create_audit_entry(task, actor, action, field_name="", old_value="", new_value=""):
    return AuditLogEntry.objects.create(
        task=task,
        actor=actor,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
    )
