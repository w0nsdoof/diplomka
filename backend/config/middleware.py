import logging
import time

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    """Log HTTP requests with method, path, status, duration, and user."""

    SKIP_PATHS = {"/api/health/"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in self.SKIP_PATHS:
            return self.get_response(request)

        start = time.monotonic()
        response = self.get_response(request)
        duration_ms = (time.monotonic() - start) * 1000

        user = getattr(request, "user", None)
        user_id = user.pk if user and user.is_authenticated else "-"

        logger.info(
            "%s %s %s %.0fms user=%s",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
            user_id,
        )

        return response
