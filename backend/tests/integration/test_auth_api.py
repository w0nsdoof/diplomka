import pytest
from django.urls import reverse

from tests.factories import EngineerFactory, ManagerFactory


@pytest.mark.django_db
class TestTokenObtain:
    URL = "/api/auth/token/"

    def test_login_returns_tokens(self, api_client):
        user = ManagerFactory()
        resp = api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data

    def test_token_contains_custom_claims(self, api_client):
        import jwt
        user = ManagerFactory()
        resp = api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        token = resp.data["access"]
        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["email"] == user.email
        assert payload["role"] == "manager"

    def test_invalid_credentials(self, api_client):
        resp = api_client.post(self.URL, {"email": "nope@ex.com", "password": "wrong"})
        assert resp.status_code == 401

    def test_inactive_user_cannot_login(self, api_client):
        user = ManagerFactory(is_active=False)
        resp = api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        assert resp.status_code == 401

    def test_refresh_token(self, api_client):
        user = ManagerFactory()
        resp = api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        refresh = resp.data["refresh"]

        resp2 = api_client.post("/api/auth/token/refresh/", {"refresh": refresh})
        assert resp2.status_code == 200
        assert "access" in resp2.data


@pytest.mark.django_db
class TestAuthRequired:
    def test_unauthenticated_gets_401(self, anon_client):
        resp = anon_client.get("/api/tasks/")
        assert resp.status_code == 401
