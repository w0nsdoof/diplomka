import logging
import time

from celery import shared_task
from django.conf import settings
from redis import Redis

from apps.projects.prompts import build_system_prompt, build_user_prompt
from apps.projects.services.ai_tasks import (
    build_generation_context,
    parse_llm_response,
    validate_generated_tasks,
)

logger = logging.getLogger(__name__)


def _get_redis():
    return Redis.from_url(settings.CELERY_BROKER_URL)


@shared_task(soft_time_limit=90, time_limit=120)
def generate_epic_tasks(epic_id: int) -> dict:
    from apps.projects.models import Epic

    redis_key = f"epic_generate:{epic_id}"
    try:
        epic = Epic.objects.select_related(
            "project", "client", "organization",
        ).prefetch_related("tags").get(pk=epic_id)

        context = build_generation_context(epic)

        system_prompt = build_system_prompt()
        user_prompt = build_user_prompt(context)

        from apps.ai_summaries.services import call_llm

        start = time.monotonic()
        text, model, prompt_tokens, completion_tokens = call_llm(system_prompt, user_prompt)
        generation_time_ms = int((time.monotonic() - start) * 1000)

        raw_tasks = parse_llm_response(text)

        team_ids = {m["id"] for m in context["team_members"]}
        org_tag_ids = {t["id"] for t in context["available_tags"]}
        validated_tasks = validate_generated_tasks(raw_tasks, team_ids, org_tag_ids)

        logger.info(
            "Generated %d tasks for epic_id=%s model=%s tokens=%s/%s time_ms=%s",
            len(validated_tasks), epic_id, model, prompt_tokens, completion_tokens, generation_time_ms,
        )

        return {
            "tasks": validated_tasks,
            "generation_meta": {
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "generation_time_ms": generation_time_ms,
            },
        }
    finally:
        try:
            _get_redis().delete(redis_key)
        except Exception:
            logger.exception("Failed to delete Redis key %s", redis_key)
