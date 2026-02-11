import pytest

from apps.comments.services import parse_mentions
from tests.factories import EngineerFactory


@pytest.mark.django_db
class TestParseMentions:
    def test_finds_mentioned_user(self):
        user = EngineerFactory(first_name="John", last_name="Doe")
        result = parse_mentions("Hey @John Doe check this")
        assert user in result

    def test_no_match_for_unknown_user(self):
        result = parse_mentions("Hey @Unknown Person check this")
        assert result == []

    def test_case_insensitive(self):
        user = EngineerFactory(first_name="John", last_name="Doe")
        result = parse_mentions("Hey @john doe check this")
        assert user in result

    def test_multiple_mentions(self):
        u1 = EngineerFactory(first_name="Alice", last_name="Smith")
        u2 = EngineerFactory(first_name="Bob", last_name="Jones")
        result = parse_mentions("@Alice Smith and @Bob Jones please review")
        assert u1 in result
        assert u2 in result

    def test_ignores_inactive_users(self):
        EngineerFactory(first_name="John", last_name="Doe", is_active=False)
        result = parse_mentions("Hey @John Doe check this")
        assert result == []

    def test_empty_content(self):
        result = parse_mentions("")
        assert result == []
