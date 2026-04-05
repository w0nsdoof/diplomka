import pytest
from rest_framework.test import APIClient

from tests.factories import (
    ClientFactory,
    ClientUserFactory,
    EngineerFactory,
    ManagerFactory,
    OrganizationFactory,
    ProjectFactory,
    SuperadminFactory,
    TagFactory,
    TaskFactory,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def organization():
    return OrganizationFactory()


@pytest.fixture
def manager(organization):
    return ManagerFactory(organization=organization)


@pytest.fixture
def engineer(organization):
    return EngineerFactory(organization=organization)


@pytest.fixture
def engineer2(organization):
    return EngineerFactory(organization=organization)


@pytest.fixture
def client_org(organization):
    return ClientFactory(organization=organization)


@pytest.fixture
def client_user(client_org):
    return ClientUserFactory(client=client_org, organization=client_org.organization)


@pytest.fixture
def superadmin():
    return SuperadminFactory()


@pytest.fixture
def tag(organization):
    return TagFactory(organization=organization)


@pytest.fixture
def project(manager):
    return ProjectFactory(created_by=manager, organization=manager.organization)


@pytest.fixture
def task(manager):
    return TaskFactory(created_by=manager, organization=manager.organization)


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
def superadmin_client(api_client, superadmin):
    api_client.force_authenticate(user=superadmin)
    return api_client


@pytest.fixture
def anon_client(api_client):
    return api_client
