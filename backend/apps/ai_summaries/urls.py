from django.urls import path

from . import views

app_name = "ai_summaries"

urlpatterns = [
    path("", views.SummaryListView.as_view(), name="summary-list"),
    path("latest/", views.SummaryLatestView.as_view(), name="summary-latest"),
    path("generate/", views.SummaryGenerateView.as_view(), name="summary-generate"),
    path("<int:pk>/", views.SummaryDetailView.as_view(), name="summary-detail"),
    path("<int:pk>/versions/", views.SummaryVersionsView.as_view(), name="summary-versions"),
    path("<int:pk>/regenerate/", views.SummaryRegenerateView.as_view(), name="summary-regenerate"),
    path("<int:pk>/generation-status/", views.SummaryGenerationStatusView.as_view(), name="summary-generation-status"),
]
