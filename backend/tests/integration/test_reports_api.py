import pytest

from tests.factories import ClientFactory, EngineerFactory, TaskFactory

REPORT_URL = "/api/reports/summary/"


@pytest.mark.django_db
class TestReportSummary:
    def test_manager_gets_report(self, manager_client, manager):
        client = ClientFactory()
        eng = EngineerFactory()
        TaskFactory(created_by=manager, client=client, assignees=[eng], status="created")
        TaskFactory(created_by=manager, client=client, status="done")

        resp = manager_client.get(REPORT_URL)
        assert resp.status_code == 200
        assert resp.data["tasks"]["total"] == 2
        assert resp.data["tasks"]["by_status"]["created"] == 1
        assert resp.data["tasks"]["by_status"]["done"] == 1
        assert len(resp.data["by_client"]) == 1
        assert len(resp.data["by_engineer"]) == 1

    def test_engineer_cannot_access_reports(self, engineer_client):
        resp = engineer_client.get(REPORT_URL)
        assert resp.status_code == 403

    def test_filter_by_client(self, manager_client, manager):
        c1 = ClientFactory()
        c2 = ClientFactory()
        TaskFactory(created_by=manager, client=c1)
        TaskFactory(created_by=manager, client=c2)

        resp = manager_client.get(REPORT_URL, {"client_id": c1.id})
        assert resp.status_code == 200
        assert resp.data["tasks"]["total"] == 1
