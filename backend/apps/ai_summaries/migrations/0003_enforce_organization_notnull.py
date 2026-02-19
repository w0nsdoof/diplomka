from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ai_summaries", "0002_reportsummary_organization"),
        ("organizations", "0002_backfill_default_org"),
    ]

    operations = [
        migrations.AlterField(
            model_name="reportsummary",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="summaries",
                to="organizations.organization",
            ),
        ),
    ]
