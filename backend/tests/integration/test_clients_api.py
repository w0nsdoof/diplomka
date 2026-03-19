import pytest

from apps.clients.models import Client
from tests.factories import ClientFactory, ClientUserFactory, TaskFactory

CLIENTS_URL = "/api/clients/"


@pytest.mark.django_db
class TestClientList:
    def test_manager_lists_clients(self, manager_client, organization):
        ClientFactory.create_batch(3, organization=organization)
        resp = manager_client.get(CLIENTS_URL)
        assert resp.status_code == 200
        assert resp.data["count"] == 3

    def test_list_includes_employee_count(self, manager_client, organization):
        client_obj = ClientFactory(organization=organization)
        ClientUserFactory(client=client_obj, organization=organization)
        ClientUserFactory(client=client_obj, organization=organization)
        resp = manager_client.get(CLIENTS_URL)
        assert resp.status_code == 200
        result = resp.data["results"][0]
        assert result["employee_count"] == 2

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
class TestClientDetail:
    def test_detail_includes_employees(self, manager_client, organization):
        client_obj = ClientFactory(organization=organization)
        emp1 = ClientUserFactory(
            client=client_obj, organization=organization,
            first_name="Alice", last_name="Smith",
            email="alice@example.com", phone="+7001",
        )
        emp2 = ClientUserFactory(
            client=client_obj, organization=organization,
            first_name="Bob", last_name="Jones",
        )
        resp = manager_client.get(f"{CLIENTS_URL}{client_obj.id}/")
        assert resp.status_code == 200
        assert resp.data["employee_count"] == 2
        employees = resp.data["employees"]
        assert len(employees) == 2
        emails = {e["email"] for e in employees}
        assert emp1.email in emails
        assert emp2.email in emails
        # Check fields present
        first = employees[0]
        assert "first_name" in first
        assert "last_name" in first
        assert "email" in first
        assert "job_title" in first
        assert "phone" in first

    def test_detail_employees_scoped_to_client(self, manager_client, organization):
        client1 = ClientFactory(organization=organization)
        client2 = ClientFactory(organization=organization)
        ClientUserFactory(client=client1, organization=organization)
        ClientUserFactory(client=client2, organization=organization)
        resp = manager_client.get(f"{CLIENTS_URL}{client1.id}/")
        assert resp.data["employee_count"] == 1
        assert len(resp.data["employees"]) == 1


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
