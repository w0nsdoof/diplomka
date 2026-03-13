import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

ME_URL = "/api/users/me/"


@pytest.mark.django_db
class TestMeGet:
    def test_manager_gets_own_profile(self, manager_client, manager):
        resp = manager_client.get(ME_URL)
        assert resp.status_code == 200
        assert resp.data["email"] == manager.email
        assert resp.data["first_name"] == manager.first_name
        assert resp.data["role"] == "manager"
        assert "job_title" in resp.data
        assert "skills" in resp.data
        assert "bio" in resp.data

    def test_engineer_gets_own_profile(self, engineer_client, engineer):
        resp = engineer_client.get(ME_URL)
        assert resp.status_code == 200
        assert resp.data["email"] == engineer.email

    def test_anon_cannot_access(self, anon_client):
        resp = anon_client.get(ME_URL)
        assert resp.status_code == 401


@pytest.mark.django_db
class TestMeUpdate:
    def test_update_name(self, engineer_client, engineer):
        resp = engineer_client.patch(
            ME_URL, {"first_name": "Updated"}, format="json"
        )
        assert resp.status_code == 200
        engineer.refresh_from_db()
        assert engineer.first_name == "Updated"

    def test_update_profile_fields(self, engineer_client, engineer):
        resp = engineer_client.patch(
            ME_URL,
            {
                "job_title": "Senior Developer",
                "skills": "Python, Django, React",
                "bio": "10 years of experience",
            },
            format="json",
        )
        assert resp.status_code == 200
        engineer.refresh_from_db()
        assert engineer.job_title == "Senior Developer"
        assert engineer.skills == "Python, Django, React"
        assert engineer.bio == "10 years of experience"

    def test_cannot_change_email(self, engineer_client, engineer):
        original_email = engineer.email
        resp = engineer_client.patch(
            ME_URL, {"email": "hacker@example.com"}, format="json"
        )
        assert resp.status_code == 200
        engineer.refresh_from_db()
        assert engineer.email == original_email

    def test_cannot_change_role(self, engineer_client, engineer):
        resp = engineer_client.patch(
            ME_URL, {"role": "manager"}, format="json"
        )
        assert resp.status_code == 200
        engineer.refresh_from_db()
        assert engineer.role == "engineer"

    def test_change_password(self, engineer_client, engineer):
        resp = engineer_client.patch(
            ME_URL, {"password": "NewStrongPass456!"}, format="json"
        )
        assert resp.status_code == 200
        engineer.refresh_from_db()
        assert engineer.check_password("NewStrongPass456!")

    def test_upload_avatar(self, engineer_client, engineer):
        img = Image.new("RGB", (100, 100), color="red")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        avatar = SimpleUploadedFile("avatar.png", buf.read(), content_type="image/png")
        resp = engineer_client.patch(ME_URL, {"avatar": avatar}, format="multipart")
        assert resp.status_code == 200
        assert resp.data["avatar"] is not None
        assert "avatars/" in resp.data["avatar"]
        engineer.refresh_from_db()
        assert engineer.avatar

    def test_remove_avatar(self, engineer_client, engineer):
        # Upload first
        img = Image.new("RGB", (100, 100), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        avatar = SimpleUploadedFile("avatar.png", buf.read(), content_type="image/png")
        engineer_client.patch(ME_URL, {"avatar": avatar}, format="multipart")
        # Then remove
        resp = engineer_client.patch(ME_URL, {"avatar": None}, format="json")
        assert resp.status_code == 200
        engineer.refresh_from_db()
        assert not engineer.avatar

    def test_anon_cannot_update(self, anon_client):
        resp = anon_client.patch(ME_URL, {"first_name": "Hacker"}, format="json")
        assert resp.status_code == 401
