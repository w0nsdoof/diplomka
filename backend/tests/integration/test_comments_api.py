import pytest

from apps.comments.models import Comment
from apps.notifications.models import Notification
from tests.factories import EngineerFactory, TaskFactory


def comments_url(task_id):
    return f"/api/tasks/{task_id}/comments/"


@pytest.mark.django_db
class TestCommentCreate:
    def test_engineer_creates_comment(self, engineer_client, task):
        resp = engineer_client.post(
            comments_url(task.id),
            {"content": "A comment", "is_public": True},
            format="json",
        )
        assert resp.status_code == 201
        assert Comment.objects.filter(task=task).count() == 1

    def test_client_cannot_create_comment(self, client_user_client, task):
        resp = client_user_client.post(
            comments_url(task.id),
            {"content": "Nope", "is_public": True},
            format="json",
        )
        assert resp.status_code == 403

    def test_mention_creates_notification(self, api_client, task, manager):
        eng = EngineerFactory(first_name="Alice", last_name="Smith")
        api_client.force_authenticate(user=manager)
        api_client.post(
            comments_url(task.id),
            {"content": "Hey @Alice Smith check this", "is_public": True},
            format="json",
        )
        assert Notification.objects.filter(
            recipient=eng, event_type="mention"
        ).exists()

    def test_comment_notifies_other_assignees(self, api_client, task, manager):
        eng1 = EngineerFactory()
        eng2 = EngineerFactory()
        task.assignees.set([eng1, eng2])
        api_client.force_authenticate(user=eng1)
        api_client.post(
            comments_url(task.id),
            {"content": "Update here", "is_public": True},
            format="json",
        )
        assert Notification.objects.filter(
            recipient=eng2, event_type="comment_added"
        ).exists()
        # eng1 is the author, should not get notified
        assert not Notification.objects.filter(
            recipient=eng1, event_type="comment_added"
        ).exists()


@pytest.mark.django_db
class TestCommentVisibility:
    def test_client_sees_only_public_comments(self, client_user_client, client_user, manager):
        task = TaskFactory(created_by=manager, client=client_user.client)
        Comment.objects.create(task=task, author=manager, content="Public", is_public=True)
        Comment.objects.create(task=task, author=manager, content="Internal", is_public=False)

        resp = client_user_client.get(comments_url(task.id))
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["content"] == "Public"

    def test_manager_sees_all_comments(self, manager_client, task, manager):
        Comment.objects.create(task=task, author=manager, content="Public", is_public=True)
        Comment.objects.create(task=task, author=manager, content="Internal", is_public=False)

        resp = manager_client.get(comments_url(task.id))
        assert resp.data["count"] == 2
