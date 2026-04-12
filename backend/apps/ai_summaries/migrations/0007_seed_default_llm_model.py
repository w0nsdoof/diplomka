from django.conf import settings
from django.db import migrations


def seed_default_model(apps, schema_editor):
    LLMModel = apps.get_model("ai_summaries", "LLMModel")
    if not LLMModel.objects.exists():
        LLMModel.objects.create(
            model_id=getattr(settings, "LLM_MODEL", "minimax/minimax-m2.5:free"),
            display_name="MiniMax M2.5 (free)",
            is_active=True,
            is_default=True,
        )


def reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("ai_summaries", "0006_add_llm_model"),
    ]

    operations = [
        migrations.RunPython(seed_default_model, reverse),
    ]
