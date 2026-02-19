"""T075 — Cross-organization data isolation integration tests.

Creates two organizations with data and verifies that each org's users can only
see their own data. Direct ID access to another org's resources returns 404.
"""
import pytest
from rest_framework.test import APIClient

from apps.ai_summaries.models import ReportSummary
from apps.notifications.models import Notification
from tests.factories import (
    ClientFactory,
    EngineerFactory,
    ManagerFactory,
    OrganizationFactory,
    TagFactory,
    TaskFactory,
)


@pytest.fixture
def org_a():
    return OrganizationFactory(name="Org A")


@pytest.fixture
def org_b():
    return OrganizationFactory(name="Org B")


@pytest.fixture
def manager_a(org_a):
    return ManagerFactory(organization=org_a)


@pytest.fixture
def manager_b(org_b):
    return ManagerFactory(organization=org_b)


@pytest.fixture
def engineer_a(org_a):
    return EngineerFactory(organization=org_a, first_name="Alice", last_name="Eng")


@pytest.fixture
def client_a(manager_a, org_a):
    return ClientFactory(organization=org_a)


@pytest.fixture
def client_b(manager_b, org_b):
    return ClientFactory(organization=org_b)


@pytest.fixture
def task_a(manager_a, client_a):
    return TaskFactory(created_by=manager_a, client=client_a)


@pytest.fixture
def task_b(manager_b, client_b):
    return TaskFactory(created_by=manager_b, client=client_b)


@pytest.fixture
def tag_a(org_a):
    return TagFactory(organization=org_a)


@pytest.fixture
def tag_b(org_b):
    return TagFactory(organization=org_b)


@pytest.fixture
def api_a(manager_a):
    client = APIClient()
    client.force_authenticate(user=manager_a)
    return client


@pytest.fixture
def api_b(manager_b):
    client = APIClient()
    client.force_authenticate(user=manager_b)
    return client


# ── Task isolation ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTaskIsolation:
    def test_task_list_shows_only_own_org(self, api_a, api_b, task_a, task_b):
        resp_a = api_a.get("/api/tasks/")
        resp_b = api_b.get("/api/tasks/")
        assert resp_a.data["count"] == 1
        assert resp_a.data["results"][0]["id"] == task_a.id
        assert resp_b.data["count"] == 1
        assert resp_b.data["results"][0]["id"] == task_b.id

    def test_direct_access_to_other_org_task_returns_404(self, api_a, task_b):
        resp = api_a.get(f"/api/tasks/{task_b.id}/")
        assert resp.status_code == 404

    def test_status_change_on_other_org_task_returns_404(self, api_a, task_b):
        resp = api_a.post(f"/api/tasks/{task_b.id}/status/", {"status": "in_progress"}, format="json")
        assert resp.status_code == 404


# ── Client isolation ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClientIsolation:
    def test_client_list_shows_only_own_org(self, api_a, api_b, client_a, client_b):
        resp_a = api_a.get("/api/clients/")
        resp_b = api_b.get("/api/clients/")
        assert resp_a.data["count"] == 1
        assert resp_a.data["results"][0]["id"] == client_a.id
        assert resp_b.data["count"] == 1
        assert resp_b.data["results"][0]["id"] == client_b.id

    def test_direct_access_to_other_org_client_returns_404(self, api_a, client_b):
        resp = api_a.get(f"/api/clients/{client_b.id}/")
        assert resp.status_code == 404


# ── Tag isolation ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTagIsolation:
    def test_tag_list_shows_only_own_org(self, api_a, api_b, tag_a, tag_b):
        resp_a = api_a.get("/api/tags/")
        resp_b = api_b.get("/api/tags/")
        assert resp_a.data["count"] == 1
        assert resp_a.data["results"][0]["id"] == tag_a.id
        assert resp_b.data["count"] == 1
        assert resp_b.data["results"][0]["id"] == tag_b.id


# ── User isolation ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserIsolation:
    def test_user_list_shows_only_own_org(self, api_a, api_b, manager_a, manager_b, engineer_a):
        resp_a = api_a.get("/api/users/")
        resp_b = api_b.get("/api/users/")
        ids_a = {u["id"] for u in resp_a.data["results"]}
        ids_b = {u["id"] for u in resp_b.data["results"]}
        assert manager_a.id in ids_a
        assert engineer_a.id in ids_a
        assert manager_b.id not in ids_a
        assert manager_b.id in ids_b
        assert manager_a.id not in ids_b

    def test_direct_access_to_other_org_user_returns_404(self, api_a, manager_b):
        resp = api_a.get(f"/api/users/{manager_b.id}/")
        assert resp.status_code == 404


# ── Comment/Attachment nested resource isolation ──────────────────────────────

@pytest.mark.django_db
class TestNestedResourceIsolation:
    def test_comments_on_other_org_task_returns_404(self, api_a, task_b):
        resp = api_a.get(f"/api/tasks/{task_b.id}/comments/")
        assert resp.status_code == 404

    def test_create_comment_on_other_org_task_returns_404(self, api_a, task_b):
        resp = api_a.post(
            f"/api/tasks/{task_b.id}/comments/",
            {"content": "cross-org", "is_public": True},
            format="json",
        )
        assert resp.status_code == 404

    def test_attachments_on_other_org_task_returns_404(self, api_a, task_b):
        resp = api_a.get(f"/api/tasks/{task_b.id}/attachments/")
        assert resp.status_code == 404


# ── Mention isolation ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMentionIsolation:
    def test_parse_mentions_cannot_resolve_cross_org_user(
        self, api_a, task_a, manager_b
    ):
        """Mentioning a user from another org should not create a notification for them."""
        api_a.post(
            f"/api/tasks/{task_a.id}/comments/",
            {
                "content": f"@{manager_b.first_name} {manager_b.last_name} check this",
                "is_public": True,
            },
            format="json",
        )
        assert not Notification.objects.filter(
            recipient=manager_b, event_type="mention"
        ).exists()

    def test_parse_mentions_resolves_same_org_user(
        self, api_a, task_a, engineer_a
    ):
        """Mentioning a user from the same org should create a notification."""
        api_a.post(
            f"/api/tasks/{task_a.id}/comments/",
            {"content": "@Alice Eng check this", "is_public": True},
            format="json",
        )
        assert Notification.objects.filter(
            recipient=engineer_a, event_type="mention"
        ).exists()


# ── Report isolation ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportIsolation:
    def test_report_shows_only_own_org_data(self, api_a, api_b, task_a, task_b):
        resp_a = api_a.get("/api/reports/summary/")
        resp_b = api_b.get("/api/reports/summary/")
        assert resp_a.data["tasks"]["total"] == 1
        assert resp_b.data["tasks"]["total"] == 1


# ── Summary isolation ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSummaryIsolation:
    def test_summary_list_shows_only_own_org(self, api_a, api_b, org_a, org_b):
        ReportSummary.objects.create(
            organization=org_a,
            period_type="daily",
            period_start="2025-01-01",
            period_end="2025-01-01",
            status="completed",
            summary_text="Org A summary",
        )
        ReportSummary.objects.create(
            organization=org_b,
            period_type="daily",
            period_start="2025-01-01",
            period_end="2025-01-01",
            status="completed",
            summary_text="Org B summary",
        )

        resp_a = api_a.get("/api/summaries/")
        resp_b = api_b.get("/api/summaries/")
        assert resp_a.data["count"] == 1
        assert resp_b.data["count"] == 1

    def test_direct_access_to_other_org_summary_returns_404(self, api_a, org_b):
        summary = ReportSummary.objects.create(
            organization=org_b,
            period_type="daily",
            period_start="2025-01-01",
            period_end="2025-01-01",
            status="completed",
            summary_text="Org B summary",
        )
        resp = api_a.get(f"/api/summaries/{summary.id}/")
        assert resp.status_code == 404
