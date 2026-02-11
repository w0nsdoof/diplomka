import logging

from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    view = context.get("view")
    request = context.get("request")

    if response is None:
        logger.exception(
            "Unhandled exception in %s: %s",
            view.__class__.__name__ if view else "unknown",
            exc,
        )
        return None

    if response.status_code >= 500:
        logger.error(
            "Server error %s in %s %s: %s",
            response.status_code,
            request.method if request else "?",
            request.path if request else "?",
            exc,
        )

    if response is not None:
        data = response.data
        if isinstance(data, dict) and "detail" not in data:
            response.data = {"errors": data}
        elif isinstance(data, list):
            response.data = {"detail": data[0] if data else "An error occurred."}

    return response
