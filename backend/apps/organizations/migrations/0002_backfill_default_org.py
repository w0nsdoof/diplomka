from django.db import migrations


def backfill_default_organization(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    User = apps.get_model("accounts", "User")
    Client = apps.get_model("clients", "Client")
    Task = apps.get_model("tasks", "Task")
    Tag = apps.get_model("tags", "Tag")
    ReportSummary = apps.get_model("ai_summaries", "ReportSummary")

    # Create default organization
    default_org, _ = Organization.objects.get_or_create(
        slug="default",
        defaults={"name": "Default Organization", "is_active": True},
    )

    # Convert superusers to superadmin role (organization=None)
    User.objects.filter(is_superuser=True).update(role="superadmin", organization=None)

    # Backfill all non-superadmin users
    User.objects.filter(organization__isnull=True).exclude(role="superadmin").update(
        organization=default_org
    )

    # Backfill all other models
    Client.objects.filter(organization__isnull=True).update(organization=default_org)
    Task.objects.filter(organization__isnull=True).update(organization=default_org)
    Tag.objects.filter(organization__isnull=True).update(organization=default_org)
    ReportSummary.objects.filter(organization__isnull=True).update(organization=default_org)


def reverse_backfill(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Client = apps.get_model("clients", "Client")
    Task = apps.get_model("tasks", "Task")
    Tag = apps.get_model("tags", "Tag")
    ReportSummary = apps.get_model("ai_summaries", "ReportSummary")

    User.objects.update(organization=None)
    Client.objects.update(organization=None)
    Task.objects.update(organization=None)
    Tag.objects.update(organization=None)
    ReportSummary.objects.update(organization=None)

    # Convert superadmins back to managers with superuser flag
    User.objects.filter(role="superadmin").update(
        role="manager", is_superuser=True, is_staff=True
    )


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0001_initial"),
        ("accounts", "0002_user_organization_alter_user_role"),
        ("clients", "0003_client_organization_alter_client_name_and_more"),
        ("tasks", "0002_task_organization"),
        ("tags", "0002_tag_organization_alter_tag_name_alter_tag_slug_and_more"),
        ("ai_summaries", "0002_reportsummary_organization"),
    ]

    operations = [
        migrations.RunPython(backfill_default_organization, reverse_backfill),
    ]
