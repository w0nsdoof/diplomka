import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tags", "0002_tag_organization_alter_tag_name_alter_tag_slug_and_more"),
        ("organizations", "0002_backfill_default_org"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tag",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tags",
                to="organizations.organization",
            ),
        ),
    ]
