import pytest

from tests.factories import TagFactory


@pytest.mark.django_db
class TestTagUpdate:
    """PUT /api/tags/{id}/ — full update (manager-only)."""

    def test_manager_can_update_tag(self, manager_client, tag):
        resp = manager_client.put(f"/api/tags/{tag.id}/", {"name": "Renamed", "color": "#ff0000"})
        assert resp.status_code == 200
        assert resp.data["name"] == "Renamed"
        assert resp.data["color"] == "#ff0000"
        tag.refresh_from_db()
        assert tag.name == "Renamed"

    def test_engineer_cannot_update_tag(self, engineer_client, tag):
        resp = engineer_client.put(f"/api/tags/{tag.id}/", {"name": "Hack", "color": "#000000"})
        assert resp.status_code == 403

    def test_update_rejects_invalid_color(self, manager_client, tag):
        resp = manager_client.put(f"/api/tags/{tag.id}/", {"name": "X", "color": "bad"})
        assert resp.status_code == 400

    def test_update_other_org_tag_returns_404(self, manager_client):
        other_tag = TagFactory()  # different org
        resp = manager_client.put(f"/api/tags/{other_tag.id}/", {"name": "X", "color": "#000000"})
        assert resp.status_code == 404


@pytest.mark.django_db
class TestTagPartialUpdate:
    """PATCH /api/tags/{id}/ — partial update (manager-only)."""

    def test_manager_can_patch_name(self, manager_client, tag):
        resp = manager_client.patch(f"/api/tags/{tag.id}/", {"name": "NewName"})
        assert resp.status_code == 200
        assert resp.data["name"] == "NewName"

    def test_manager_can_patch_color(self, manager_client, tag):
        resp = manager_client.patch(f"/api/tags/{tag.id}/", {"color": "#123abc"})
        assert resp.status_code == 200
        assert resp.data["color"] == "#123abc"

    def test_engineer_cannot_patch_tag(self, engineer_client, tag):
        resp = engineer_client.patch(f"/api/tags/{tag.id}/", {"name": "Hack"})
        assert resp.status_code == 403
