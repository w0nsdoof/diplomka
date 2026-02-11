import pytest
from rest_framework.test import APIClient

from tests.factories import (
    ClientFactory,
    ClientUserFactory,
    EngineerFactory,
    ManagerFactory,
    TagFactory,
    TaskFactory,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def manager():
    return ManagerFactory()


@pytest.fixture
def engineer():
    return EngineerFactory()


@pytest.fixture
def engineer2():
    return EngineerFactory()


@pytest.fixture
def client_org():
    return ClientFactory()


@pytest.fixture
def client_user(client_org):
    return ClientUserFactory(client=client_org)


@pytest.fixture
def tag():
    return TagFactory()


@pytest.fixture
def task(manager):
    return TaskFactory(created_by=manager)


@pytest.fixture
def manager_client(api_client, manager):
    api_client.force_authenticate(user=manager)
    return api_client


@pytest.fixture
def engineer_client(api_client, engineer):
    api_client.force_authenticate(user=engineer)
    return api_client


@pytest.fixture
def client_user_client(api_client, client_user):
    api_client.force_authenticate(user=client_user)
    return api_client


@pytest.fixture
def anon_client(api_client):
    return api_client
