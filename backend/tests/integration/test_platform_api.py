import pytest

from apps.organizations.models import Organization
from tests.factories import ManagerFactory, OrganizationFactory

ORGS_URL = "/api/platform/organizations/"


@pytest.mark.django_db
class TestOrganizationList:
    def test_superadmin_can_list_orgs(self, superadmin_client):
        OrganizationFactory.create_batch(3)
        resp = superadmin_client.get(ORGS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] >= 3

    def test_non_superadmin_gets_403(self, manager_client):
        resp = manager_client.get(ORGS_URL)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestOrganizationCreate:
    def test_superadmin_creates_org(self, superadmin_client):
        resp = superadmin_client.post(ORGS_URL, {"name": "Acme Corp"}, format="json")
        assert resp.status_code == 201
        assert Organization.objects.filter(name="Acme Corp").exists()

    def test_duplicate_name_rejected(self, superadmin_client):
        OrganizationFactory(name="Existing Org")
        resp = superadmin_client.post(ORGS_URL, {"name": "Existing Org"}, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestOrganizationRetrieve:
    def test_superadmin_retrieves_org_with_stats(self, superadmin_client):
        org = OrganizationFactory()
        ManagerFactory(organization=org)
        resp = superadmin_client.get(f"{ORGS_URL}{org.pk}/")
        assert resp.status_code == 200
        assert resp.data["name"] == org.name
        assert resp.data["user_count"] == 1
        assert resp.data["manager_count"] == 1


@pytest.mark.django_db
class TestManagerEndpoints:
    def test_create_manager_for_org(self, superadmin_client):
        org = OrganizationFactory()
        resp = superadmin_client.post(
            f"{ORGS_URL}{org.pk}/managers/",
            {
                "email": "newmanager@example.com",
                "first_name": "New",
                "last_name": "Manager",
                "password": "SecurePass123!",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["email"] == "newmanager@example.com"

    def test_list_managers_for_org(self, superadmin_client):
        org = OrganizationFactory()
        ManagerFactory.create_batch(2, organization=org)
        resp = superadmin_client.get(f"{ORGS_URL}{org.pk}/managers/")
        assert resp.status_code == 200
        assert resp.data["count"] == 2

    def test_cannot_create_manager_for_inactive_org(self, superadmin_client):
        org = OrganizationFactory(is_active=False)
        resp = superadmin_client.post(
            f"{ORGS_URL}{org.pk}/managers/",
            {
                "email": "fail@example.com",
                "first_name": "Fail",
                "last_name": "User",
                "password": "SecurePass123!",
            },
            format="json",
        )
        assert resp.status_code == 400
