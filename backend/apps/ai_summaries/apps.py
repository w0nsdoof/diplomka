from django.apps import AppConfig


class AiSummariesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ai_summaries"
    verbose_name = "AI Summaries"

    def ready(self):
        import apps.ai_summaries.metrics  # noqa: F401 — register Prometheus metrics
