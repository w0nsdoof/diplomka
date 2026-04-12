import json
import logging
import time
from datetime import UTC, datetime

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


def _set_stage(redis_client, epic_id: int, stage: str, meta: dict | None = None):
    """Write current pipeline stage + metadata to Redis and broadcast via Channels."""
    stage_meta = meta or {}
    payload = {"stage": stage, "stage_meta": stage_meta}
    redis_client.set(
        f"epic_generate:{epic_id}:stage",
        json.dumps(payload),
        ex=300,  # auto-expire after 5 min
    )
    # Best-effort WS broadcast
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"generation_epic_tasks_{epic_id}",
            {"type": "generation_stage", "stage": stage, "stage_meta": stage_meta},
        )
    except Exception:
        pass


@shared_task(soft_time_limit=90, time_limit=120)
def generate_epic_tasks(epic_id: int, model_override: str | None = None) -> dict:
    from apps.projects.models import Epic

    redis_client = _get_redis()
    redis_key = f"epic_generate:{epic_id}"
    try:
        _set_stage(redis_client, epic_id, "collecting_context")

        epic = Epic.objects.select_related(
            "project", "client", "organization",
        ).prefetch_related("tags").get(pk=epic_id)

        context = build_generation_context(epic)

        _set_stage(redis_client, epic_id, "collecting_context", {
            "tasks_found": len(context["existing_tasks"]),
            "team_size": len(context["team_members"]),
            "tags_available": len(context["available_tags"]),
        })

        _set_stage(redis_client, epic_id, "building_prompt")

        system_prompt = build_system_prompt(context)
        user_prompt = build_user_prompt(context)

        # Rough token estimate (~4 chars per token)
        token_estimate = (len(system_prompt) + len(user_prompt)) // 4

        _set_stage(redis_client, epic_id, "building_prompt", {
            "token_estimate": token_estimate,
        })

        from apps.ai_summaries.services import call_llm, resolve_llm_model

        llm_model = resolve_llm_model(
            organization=epic.organization,
            explicit_model_id=model_override,
        )
        _set_stage(redis_client, epic_id, "calling_llm", {
            "model": llm_model,
            "started_at": time.time(),
        })

        try:
            start = time.monotonic()
            text, model, prompt_tokens, completion_tokens = call_llm(
                system_prompt, user_prompt, model=llm_model,
            )
            generation_time_ms = int((time.monotonic() - start) * 1000)
        except Exception:
            logger.exception("LLM call failed for epic_id=%s", epic_id)
            raise RuntimeError(
                "AI service is temporarily unavailable. Please try again in a few minutes."
            )

        _set_stage(redis_client, epic_id, "parsing_response", {
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "generation_time_ms": generation_time_ms,
        })

        try:
            raw_tasks = parse_llm_response(text)
        except ValueError:
            logger.error("Failed to parse LLM response for epic_id=%s: %s", epic_id, text[:500])
            raise RuntimeError(
                "AI returned an unexpected response format. Please try again."
            )

        _set_stage(redis_client, epic_id, "validating", {
            "raw_task_count": len(raw_tasks),
        })

        team_ids = {m["id"] for m in context["team_members"]}
        org_tag_ids = {t["id"] for t in context["available_tags"]}
        validated, warnings = validate_generated_tasks(raw_tasks, team_ids, org_tag_ids)

        if not validated:
            logger.warning("LLM produced zero valid tasks for epic_id=%s", epic_id)
            raise RuntimeError(
                "AI could not generate valid tasks for this epic. "
                "Try adding more detail to the epic description."
            )

        _set_stage(redis_client, epic_id, "completed", {
            "valid_tasks": len(validated),
            "warnings_count": len(warnings),
            "generation_time_ms": generation_time_ms,
        })

        generation_meta = {
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "generation_time_ms": generation_time_ms,
        }

        logger.info(
            "Generated %d tasks for epic_id=%s model=%s tokens=%s/%s time_ms=%s",
            len(validated), epic_id, model, prompt_tokens, completion_tokens, generation_time_ms,
        )

        # Store raw generation for audit
        Epic.objects.filter(pk=epic_id).update(last_generation={
            "timestamp": datetime.now(UTC).isoformat(),
            "raw_task_count": len(raw_tasks),
            "validated_task_count": len(validated),
            "warnings": warnings,
            "meta": generation_meta,
            "raw_tasks": raw_tasks[:20],  # cap stored payload
        })

        return {
            "tasks": validated,
            "warnings": warnings,
            "generation_meta": generation_meta,
        }
    finally:
        try:
            _get_redis().delete(redis_key)
        except Exception:
            logger.exception("Failed to delete Redis key %s", redis_key)
