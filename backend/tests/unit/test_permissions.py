from unittest.mock import Mock

import pytest

from apps.accounts.permissions import (
    IsAssignedEngineer,
    IsClient,
    IsEngineer,
    IsManager,
    IsManagerOrReadOnly,
)
from tests.factories import EngineerFactory, TaskFactory


def _make_request(user, method="GET"):
    request = Mock()
    request.user = user
    request.method = method
    return request


@pytest.mark.django_db
class TestIsManager:
    def test_allows_manager(self, manager):
        assert IsManager().has_permission(_make_request(manager), None) is True

    def test_denies_engineer(self, engineer):
        assert IsManager().has_permission(_make_request(engineer), None) is False


@pytest.mark.django_db
class TestIsEngineer:
    def test_allows_engineer(self, engineer):
        assert IsEngineer().has_permission(_make_request(engineer), None) is True

    def test_denies_manager(self, manager):
        assert IsEngineer().has_permission(_make_request(manager), None) is False


@pytest.mark.django_db
class TestIsClient:
    def test_allows_client(self, client_user):
        assert IsClient().has_permission(_make_request(client_user), None) is True

    def test_denies_engineer(self, engineer):
        assert IsClient().has_permission(_make_request(engineer), None) is False


@pytest.mark.django_db
class TestIsManagerOrReadOnly:
    def test_allows_manager_write(self, manager):
        assert IsManagerOrReadOnly().has_permission(_make_request(manager, "POST"), None) is True

    def test_allows_engineer_read(self, engineer):
        assert IsManagerOrReadOnly().has_permission(_make_request(engineer, "GET"), None) is True

    def test_denies_engineer_write(self, engineer):
        assert IsManagerOrReadOnly().has_permission(_make_request(engineer, "POST"), None) is False


@pytest.mark.django_db
class TestIsAssignedEngineer:
    def test_allows_assigned_engineer(self, manager):
        eng = EngineerFactory()
        task = TaskFactory(created_by=manager, assignees=[eng])
        assert IsAssignedEngineer().has_object_permission(
            _make_request(eng), None, task
        ) is True

    def test_denies_unassigned_engineer(self, manager):
        eng = EngineerFactory()
        task = TaskFactory(created_by=manager)
        assert IsAssignedEngineer().has_object_permission(
            _make_request(eng), None, task
        ) is False
