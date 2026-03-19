import pytest

from apps.accounts.models import User
from tests.factories import ClientFactory, EngineerFactory

USERS_URL = "/api/users/"


@pytest.mark.django_db
class TestUserList:
    def test_manager_lists_users(self, manager_client, manager, organization):
        EngineerFactory.create_batch(2, organization=organization)
        resp = manager_client.get(USERS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] >= 3  # manager + 2 engineers

    def test_engineer_cannot_list_users(self, engineer_client):
        resp = engineer_client.get(USERS_URL)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestUserCreate:
    def test_manager_creates_user(self, manager_client):
        data = {
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "role": "engineer",
            "password": "StrongPass123!",
        }
        resp = manager_client.post(USERS_URL, data, format="json")
        assert resp.status_code == 201
        assert User.objects.filter(email="new@example.com").exists()

    def test_client_role_requires_client_id(self, manager_client):
        data = {
            "email": "clientuser@example.com",
            "first_name": "Client",
            "last_name": "User",
            "role": "client",
            "password": "StrongPass123!",
        }
        resp = manager_client.post(USERS_URL, data, format="json")
        assert resp.status_code == 400

    def test_client_role_with_valid_client(self, manager_client):
        client = ClientFactory()
        data = {
            "email": "portal@example.com",
            "first_name": "Portal",
            "last_name": "User",
            "role": "client",
            "password": "StrongPass123!",
            "client_id": client.id,
        }
        resp = manager_client.post(USERS_URL, data, format="json")
        assert resp.status_code == 201

    def test_create_user_with_phone(self, manager_client):
        data = {
            "email": "withphone@example.com",
            "first_name": "Phone",
            "last_name": "User",
            "role": "engineer",
            "password": "StrongPass123!",
            "phone": "+77001234567",
        }
        resp = manager_client.post(USERS_URL, data, format="json")
        assert resp.status_code == 201
        user = User.objects.get(email="withphone@example.com")
        assert user.phone == "+77001234567"


@pytest.mark.django_db
class TestUserListFields:
    def test_list_includes_phone(self, manager_client, organization):
        EngineerFactory(organization=organization, phone="+70001112233")
        resp = manager_client.get(USERS_URL)
        assert resp.status_code == 200
        phones = [u["phone"] for u in resp.data["results"]]
        assert "+70001112233" in phones


@pytest.mark.django_db
class TestUserSoftDelete:
    def test_destroy_deactivates_user(self, manager_client, organization):
        eng = EngineerFactory(organization=organization)
        resp = manager_client.delete(f"{USERS_URL}{eng.id}/")
        assert resp.status_code == 204
        eng.refresh_from_db()
        assert eng.is_active is False

    def test_deactivated_user_still_in_db(self, manager_client, organization):
        eng = EngineerFactory(organization=organization)
        manager_client.delete(f"{USERS_URL}{eng.id}/")
        assert User.objects.filter(pk=eng.pk).exists()


@pytest.mark.django_db
class TestUserUpdate:
    def test_manager_updates_user(self, manager_client, organization):
        eng = EngineerFactory(organization=organization)
        resp = manager_client.patch(
            f"{USERS_URL}{eng.id}/",
            {"first_name": "Updated"},
            format="json",
        )
        assert resp.status_code == 200
        eng.refresh_from_db()
        assert eng.first_name == "Updated"
