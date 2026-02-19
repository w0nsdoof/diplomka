import pytest
from rest_framework.test import APIRequestFactory

from apps.organizations.mixins import OrganizationQuerySetMixin
from apps.tasks.models import Task
from tests.factories import (
    ManagerFactory,
    OrganizationFactory,
    SuperadminFactory,
    TaskFactory,
)


class TestOrganizationQuerySetMixin:
    @pytest.mark.django_db
    def test_filters_by_user_organization(self):
        org1 = OrganizationFactory()
        org2 = OrganizationFactory()
        manager1 = ManagerFactory(organization=org1)
        TaskFactory(created_by=manager1, organization=org1)
        manager2 = ManagerFactory(organization=org2)
        TaskFactory(created_by=manager2, organization=org2)

        class TestViewSet(OrganizationQuerySetMixin):
            def __init__(self, request):
                self.request = request

            def get_queryset(self):
                qs = Task.objects.all()
                user = self.request.user
                if user.is_superadmin:
                    return qs.none()
                return qs.filter(organization=user.organization)

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = manager1
        viewset = TestViewSet(request)
        qs = viewset.get_queryset()
        assert qs.count() == 1
        assert qs.first().organization == org1

    @pytest.mark.django_db
    def test_superadmin_gets_empty_queryset(self):
        org = OrganizationFactory()
        manager = ManagerFactory(organization=org)
        TaskFactory(created_by=manager, organization=org)
        superadmin = SuperadminFactory()

        class TestViewSet(OrganizationQuerySetMixin):
            def __init__(self, request):
                self.request = request

            def get_queryset(self):
                qs = Task.objects.all()
                user = self.request.user
                if user.is_superadmin:
                    return qs.none()
                return qs.filter(organization=user.organization)

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = superadmin
        viewset = TestViewSet(request)
        qs = viewset.get_queryset()
        assert qs.count() == 0
