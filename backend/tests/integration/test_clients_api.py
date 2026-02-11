import pytest

from apps.clients.models import Client
from tests.factories import ClientFactory, TaskFactory

CLIENTS_URL = "/api/clients/"


@pytest.mark.django_db
class TestClientList:
    def test_manager_lists_clients(self, manager_client):
        ClientFactory.create_batch(3)
        resp = manager_client.get(CLIENTS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 3

    def test_engineer_can_read_clients(self, engineer_client):
        ClientFactory()
        resp = engineer_client.get(CLIENTS_URL)
        assert resp.status_code == 200

    def test_client_user_sees_only_own_client(self, client_user_client, client_user):
        ClientFactory()  # another client
        resp = client_user_client.get(CLIENTS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["id"] == client_user.client_id


@pytest.mark.django_db
class TestClientCreate:
    def test_manager_creates_client(self, manager_client):
        data = {
            "name": "New Client",
            "client_type": "company",
            "email": "new@client.com",
        }
        resp = manager_client.post(CLIENTS_URL, data, format="json")
        assert resp.status_code == 201
        assert Client.objects.filter(name="New Client").exists()

    def test_engineer_cannot_create_client(self, engineer_client):
        data = {"name": "Nope", "client_type": "company"}
        resp = engineer_client.post(CLIENTS_URL, data, format="json")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestClientPortal:
    def test_client_lists_own_tickets(self, client_user_client, client_user, manager):
        TaskFactory(created_by=manager, client=client_user.client)
        TaskFactory(created_by=manager, client=client_user.client, status="archived")
        resp = client_user_client.get("/api/portal/tickets/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1  # archived excluded

    def test_client_views_ticket_detail(self, client_user_client, client_user, manager):
        task = TaskFactory(created_by=manager, client=client_user.client)
        resp = client_user_client.get(f"/api/portal/tickets/{task.id}/")
        assert resp.status_code == 200
        assert resp.data["title"] == task.title

    def test_engineer_cannot_access_portal(self, engineer_client):
        resp = engineer_client.get("/api/portal/tickets/")
        assert resp.status_code == 403
