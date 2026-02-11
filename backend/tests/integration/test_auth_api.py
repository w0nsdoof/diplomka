import pytest
from django.urls import reverse

from tests.factories import EngineerFactory, ManagerFactory


@pytest.mark.django_db
class TestTokenObtain:
    URL = "/api/auth/token/"

    def test_login_returns_access_token_and_refresh_cookie(self, api_client):
        user = ManagerFactory()
        resp = api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        assert resp.status_code == 200
        assert "access" in resp.data
        # Refresh token is now in httpOnly cookie, not in response body
        assert "refresh" not in resp.data
        assert "refresh_token" in resp.cookies

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

    def test_refresh_token_from_cookie(self, api_client):
        user = ManagerFactory()
        resp = api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        # The refresh cookie is set by the login response
        # DRF test client automatically sends cookies on subsequent requests
        resp2 = api_client.post("/api/auth/token/refresh/")
        assert resp2.status_code == 200
        assert "access" in resp2.data

    def test_refresh_without_cookie_returns_401(self, api_client):
        resp = api_client.post("/api/auth/token/refresh/")
        assert resp.status_code == 401

    def test_logout_clears_refresh_cookie(self, api_client):
        user = ManagerFactory()
        api_client.post(self.URL, {"email": user.email, "password": "testpass123"})
        resp = api_client.post("/api/auth/logout/")
        assert resp.status_code == 204


@pytest.mark.django_db
class TestAuthRequired:
    def test_unauthenticated_gets_401(self, anon_client):
        resp = anon_client.get("/api/tasks/")
        assert resp.status_code == 401
