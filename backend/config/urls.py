from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", include("django_prometheus.urls")),
    path("api/health/", health_check, name="health-check"),
    path("admin/", admin.site.urls),
    path("api/platform/", include("apps.platform.urls")),
    path("api/auth/", include("apps.accounts.urls_auth")),
    path("api/users/", include("apps.accounts.urls_users")),
    path("api/projects/", include("apps.projects.urls")),
    path("api/epics/", include("apps.projects.urls_epics")),
    path("api/tasks/", include("apps.tasks.urls")),
    path("api/clients/", include("apps.clients.urls")),
    path("api/tags/", include("apps.tags.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/summaries/", include("apps.ai_summaries.urls")),
    path("api/llm-models/", include("apps.ai_summaries.urls_llm")),
    path("api/portal/", include("apps.clients.urls_portal")),
    path("api/telegram/", include("apps.telegram.urls")),
    # OpenAPI schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]
