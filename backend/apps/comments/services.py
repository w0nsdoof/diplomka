import re

from django.contrib.auth import get_user_model

User = get_user_model()


def parse_mentions(content):
    pattern = r"@(\w+\s+\w+)"
    matches = re.findall(pattern, content)
    users = []
    for match in matches:
        parts = match.strip().split()
        if len(parts) >= 2:
            found = User.objects.filter(
                first_name__iexact=parts[0],
                last_name__iexact=parts[1],
                is_active=True,
            ).first()
            if found:
                users.append(found)
    return users
