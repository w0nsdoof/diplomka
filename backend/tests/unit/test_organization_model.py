import pytest
from django.db import IntegrityError

from apps.organizations.models import Organization
from tests.factories import OrganizationFactory


@pytest.mark.django_db
class TestOrganizationModel:
    def test_str(self):
        org = OrganizationFactory(name="Acme Corp")
        assert str(org) == "Acme Corp"

    def test_slug_auto_generation(self):
        org = OrganizationFactory(name="Test Company")
        assert org.slug == "test-company"

    def test_slug_uniqueness(self):
        OrganizationFactory(name="Dup Org", slug="dup-org")
        org2 = Organization(name="Dup Org 2")
        org2.slug = "dup-org"
        # slug collision should be handled by save()
        org2.save()
        assert org2.slug.startswith("dup-org")
        assert org2.slug != "dup-org"

    def test_unique_name(self):
        OrganizationFactory(name="Unique Name")
        with pytest.raises(IntegrityError):
            OrganizationFactory(name="Unique Name")

    def test_is_active_default(self):
        org = OrganizationFactory()
        assert org.is_active is True

    def test_deactivation(self):
        org = OrganizationFactory(is_active=True)
        org.is_active = False
        org.save()
        org.refresh_from_db()
        assert org.is_active is False
