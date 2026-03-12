import hmac
import logging

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.telegram.bot import handle_webhook_update
from apps.telegram.models import TelegramLink
from apps.telegram.serializers import (
    TelegramNotificationToggleSerializer,
    TelegramStatusSerializer,
)
from apps.telegram.services import generate_verification_code, get_bot_username, unlink_telegram

logger = logging.getLogger(__name__)


@extend_schema(
    tags=["Telegram"],
    summary="Get current Telegram link status",
    responses={200: TelegramStatusSerializer},
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def telegram_status(request):
    try:
        link = TelegramLink.objects.get(user=request.user)
        data = {
            "is_linked": True,
            "username": link.username or None,
            "is_active": link.is_active,
            "telegram_notifications_enabled": link.telegram_notifications_enabled,
            "linked_at": link.linked_at,
        }
    except TelegramLink.DoesNotExist:
        data = {
            "is_linked": False,
            "username": None,
            "is_active": False,
            "telegram_notifications_enabled": False,
            "linked_at": None,
        }
    return Response(data)


@extend_schema(
    tags=["Telegram"],
    summary="Generate Telegram linking code",
    responses={
        201: {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "deep_link": {"type": "string"},
                "expires_at": {"type": "string", "format": "date-time"},
                "bot_username": {"type": "string"},
            },
        },
        400: {"description": "Already linked or invalid role"},
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def telegram_link(request):
    user = request.user

    # Check role (FR-013)
    if user.role not in ("manager", "engineer"):
        return Response(
            {"detail": "Only managers and engineers can link Telegram."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Check if already linked
    if TelegramLink.objects.filter(user=user).exists():
        return Response(
            {"detail": "Telegram account is already linked."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    code, deep_link, expires_at = generate_verification_code(user)
    return Response(
        {
            "code": code,
            "deep_link": deep_link,
            "expires_at": expires_at,
            "bot_username": get_bot_username(),
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    tags=["Telegram"],
    summary="Unlink Telegram account",
    responses={204: None, 400: {"description": "No link exists"}},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def telegram_unlink(request):
    deleted = unlink_telegram(request.user)
    if not deleted:
        return Response(
            {"detail": "No Telegram link exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["Telegram"],
    summary="Toggle Telegram notifications",
    request=TelegramNotificationToggleSerializer,
    responses={
        200: {"type": "object", "properties": {"telegram_notifications_enabled": {"type": "boolean"}}},
        400: {"description": "No link exists"},
    },
)
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def telegram_notifications_toggle(request):
    serializer = TelegramNotificationToggleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        link = TelegramLink.objects.get(user=request.user)
    except TelegramLink.DoesNotExist:
        return Response(
            {"detail": "No Telegram link exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    link.telegram_notifications_enabled = serializer.validated_data["enabled"]
    link.save(update_fields=["telegram_notifications_enabled"])
    return Response({"telegram_notifications_enabled": link.telegram_notifications_enabled})


@csrf_exempt
@extend_schema(
    tags=["Telegram"],
    summary="Telegram Bot webhook endpoint",
    responses={200: None, 403: {"description": "Invalid secret token"}},
)
@api_view(["POST"])
@permission_classes([AllowAny])
def telegram_webhook(request):
    # Verify secret token
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    expected = settings.TELEGRAM_WEBHOOK_SECRET

    if not expected or not hmac.compare_digest(secret, expected):
        return Response(status=status.HTTP_403_FORBIDDEN)

    try:
        handle_webhook_update(request.data)
    except Exception:
        logger.exception("Error processing Telegram webhook")

    return Response(status=status.HTTP_200_OK)
