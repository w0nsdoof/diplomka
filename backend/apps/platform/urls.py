from rest_framework.routers import DefaultRouter

from apps.platform.views import OrganizationViewSet

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="platform-organization")

urlpatterns = router.urls
