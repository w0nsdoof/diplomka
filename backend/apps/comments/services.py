import re

from django.contrib.auth import get_user_model

User = get_user_model()


def parse_mentions(content, organization=None):
    pattern = r"@(\w+\s+\w+)"
    matches = re.findall(pattern, content)
    users = []
    for match in matches:
        parts = match.strip().split()
        if len(parts) >= 2:
            qs = User.objects.filter(
                first_name__iexact=parts[0],
                last_name__iexact=parts[1],
                is_active=True,
            )
            if organization:
                qs = qs.filter(organization=organization)
            found = qs.first()
            if found:
                users.append(found)
    return users
