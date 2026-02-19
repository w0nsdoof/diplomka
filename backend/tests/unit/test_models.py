import pytest

from apps.accounts.models import User
from apps.tags.models import Tag
from tests.factories import ClientFactory, EngineerFactory


@pytest.mark.django_db
class TestUserModel:
    def test_create_user_with_email(self):
        user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            first_name="Test",
            last_name="User",
            role=User.Role.ENGINEER,
        )
        assert user.email == "test@example.com"
        assert user.check_password("testpass123")
        assert user.username is None

    def test_create_user_requires_email(self):
        with pytest.raises(ValueError, match="Email is required"):
            User.objects.create_user(email="", password="testpass123")

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            email="admin@example.com",
            password="adminpass123",
            first_name="Admin",
            last_name="User",
        )
        assert user.is_staff is True
        assert user.is_superuser is True
        assert user.role == User.Role.MANAGER

    def test_str_representation(self):
        user = EngineerFactory(first_name="John", last_name="Doe", email="john@example.com")
        assert str(user) == "John Doe (john@example.com)"

    def test_client_relationship(self):
        client = ClientFactory()
        user = EngineerFactory(client=client, role=User.Role.CLIENT)
        assert user.client == client
        assert user in client.portal_users.all()


@pytest.mark.django_db
class TestTagModel:
    def test_auto_slug_on_save(self, organization):
        tag = Tag(name="Bug Fix", color="#ff0000", organization=organization)
        tag.save()
        assert tag.slug == "bug-fix"

    def test_preserves_explicit_slug(self, organization):
        tag = Tag(name="Bug Fix", slug="custom-slug", color="#ff0000", organization=organization)
        tag.save()
        assert tag.slug == "custom-slug"

    def test_str_representation(self):
        tag = Tag(name="Feature", slug="feature")
        assert str(tag) == "Feature"
