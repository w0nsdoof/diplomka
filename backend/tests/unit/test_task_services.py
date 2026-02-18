from unittest.mock import patch

import pytest

from apps.audit.models import AuditLogEntry
from apps.notifications.models import Notification
from apps.tasks.models import Task
from apps.tasks.services import (
    MANAGER_ONLY_TRANSITIONS,
    VALID_TRANSITIONS,
    apply_status_change,
    update_task_with_version,
    validate_transition,
)
from tests.factories import EngineerFactory, TaskFactory


@pytest.mark.django_db
class TestValidateTransition:
    def test_valid_transitions(self):
        for current, allowed_list in VALID_TRANSITIONS.items():
            for target in allowed_list:
                ok, err = validate_transition(current, target)
                assert ok is True
                assert err is None

    def test_invalid_transition_created_to_done(self):
        ok, err = validate_transition(Task.Status.CREATED, Task.Status.DONE)
        assert ok is False
        assert "Invalid status transition" in err

    def test_invalid_transition_archived_to_anything(self):
        for target in Task.Status.values:
            ok, _ = validate_transition(Task.Status.ARCHIVED, target)
            assert ok is False

    def test_manager_only_transitions_defined(self):
        assert (Task.Status.DONE, Task.Status.ARCHIVED) in MANAGER_ONLY_TRANSITIONS


@pytest.mark.django_db
class TestApplyStatusChange:
    @patch("apps.tasks.services._broadcast_task_event")
    def test_valid_status_change(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager, status=Task.Status.CREATED)
        ok, err, updated = apply_status_change(task, Task.Status.IN_PROGRESS, manager)

        assert ok is True
        assert err is None
        assert updated.status == Task.Status.IN_PROGRESS
        assert updated.version == 2

    @patch("apps.tasks.services._broadcast_task_event")
    def test_creates_audit_entry(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager, status=Task.Status.CREATED)
        apply_status_change(task, Task.Status.IN_PROGRESS, manager)

        entry = AuditLogEntry.objects.filter(task=task, action=AuditLogEntry.Action.STATUS_CHANGE)
        assert entry.exists()
        assert entry.first().old_value == Task.Status.CREATED
        assert entry.first().new_value == Task.Status.IN_PROGRESS

    @patch("apps.tasks.services._broadcast_task_event")
    def test_notifies_assignees_except_actor(self, mock_broadcast, manager):
        eng1 = EngineerFactory()
        eng2 = EngineerFactory()
        task = TaskFactory(created_by=manager, status=Task.Status.CREATED, assignees=[eng1, eng2])

        apply_status_change(task, Task.Status.IN_PROGRESS, eng1)

        notifications = Notification.objects.filter(task=task, event_type="status_changed")
        assert notifications.count() == 1
        assert notifications.first().recipient == eng2

    def test_invalid_transition_returns_error(self, manager):
        task = TaskFactory(created_by=manager, status=Task.Status.CREATED)
        ok, err, updated = apply_status_change(task, Task.Status.DONE, manager)

        assert ok is False
        assert "Invalid status transition" in err
        assert updated is None

    @patch("apps.tasks.services._broadcast_task_event")
    def test_version_conflict(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager, status=Task.Status.CREATED)
        # Simulate another user incrementing the version
        Task.objects.filter(pk=task.pk).update(version=99)

        ok, err, updated = apply_status_change(task, Task.Status.IN_PROGRESS, manager)
        assert ok is False
        assert "Conflict" in err


@pytest.mark.django_db
class TestUpdateTaskWithVersion:
    @patch("apps.tasks.services._broadcast_task_event")
    def test_updates_fields(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager, title="Old Title")
        ok, err, updated = update_task_with_version(
            task, {"title": "New Title"}, manager
        )
        assert ok is True
        assert updated.title == "New Title"
        assert updated.version == 2

    @patch("apps.tasks.services._broadcast_task_event")
    def test_creates_audit_for_changed_fields(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager, title="Old Title")
        update_task_with_version(task, {"title": "New Title"}, manager)

        entry = AuditLogEntry.objects.filter(
            task=task, action=AuditLogEntry.Action.FIELD_UPDATE, field_name="title"
        ).first()
        assert entry is not None
        assert entry.old_value == "Old Title"
        assert entry.new_value == "New Title"

    def test_no_update_when_empty_data(self, manager):
        task = TaskFactory(created_by=manager)
        ok, err, returned = update_task_with_version(task, {}, manager)
        assert ok is True
        assert returned.version == 1  # No version bump

    @patch("apps.tasks.services._broadcast_task_event")
    def test_version_conflict(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager, title="Old")
        Task.objects.filter(pk=task.pk).update(version=99)

        ok, err, updated = update_task_with_version(task, {"title": "New"}, manager)
        assert ok is False
        assert "Conflict" in err

    @patch("apps.tasks.services._broadcast_task_event")
    def test_skips_m2m_fields(self, mock_broadcast, manager):
        task = TaskFactory(created_by=manager)
        ok, err, updated = update_task_with_version(
            task, {"title": "New", "assignee_ids": [1], "tag_ids": [1]}, manager
        )
        assert ok is True
        assert updated.title == "New"
