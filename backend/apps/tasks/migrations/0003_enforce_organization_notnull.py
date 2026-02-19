import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0002_task_organization"),
        ("organizations", "0002_backfill_default_org"),
    ]

    operations = [
        migrations.AlterField(
            model_name="task",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tasks",
                to="organizations.organization",
            ),
        ),
    ]
