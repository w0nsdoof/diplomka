from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import MeView, UserViewSet

router = DefaultRouter()
router.register("", UserViewSet, basename="user")

urlpatterns = [
    path("me/", MeView.as_view(), name="user-me"),
    path("", include(router.urls)),
]
