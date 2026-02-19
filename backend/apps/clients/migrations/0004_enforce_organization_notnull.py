import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0003_client_organization_alter_client_name_and_more"),
        ("organizations", "0002_backfill_default_org"),
    ]

    operations = [
        migrations.AlterField(
            model_name="client",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="clients",
                to="organizations.organization",
            ),
        ),
    ]
