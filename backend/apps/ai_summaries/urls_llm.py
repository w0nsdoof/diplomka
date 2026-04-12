from django.urls import path

from . import views

app_name = "llm_models"

urlpatterns = [
    path("", views.LLMModelListView.as_view(), name="llm-model-list"),
    path("org-default/", views.OrgDefaultModelView.as_view(), name="org-default-model"),
]
