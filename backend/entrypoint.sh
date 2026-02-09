#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

python manage.py shell -c "
from apps.accounts.models import User
import os

def ensure_user(email, password, first_name, last_name, role, is_staff=False, is_superuser=False):
    user, created = User.objects.get_or_create(email=email, defaults={
        'first_name': first_name,
        'last_name': last_name,
        'role': role,
        'is_staff': is_staff,
        'is_superuser': is_superuser,
        'is_active': True,
    })
    if created:
        user.set_password(password)
        user.save()
        print(f'User created: {email} ({role})')
    elif not user.is_active:
        user.is_active = True
        user.save(update_fields=['is_active'])
        print(f'User activated: {email} ({role})')
    else:
        print(f'User already exists: {email} ({role})')

# Superuser
email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if email and password:
    ensure_user(email, password, 'Admin', 'User', 'manager', is_staff=True, is_superuser=True)

# Test accounts
for role in ('manager', 'engineer', 'client'):
    env_email = os.environ.get(f'TEST_{role.upper()}_EMAIL')
    env_password = os.environ.get(f'TEST_{role.upper()}_PASSWORD')
    if env_email and env_password:
        ensure_user(env_email, env_password, role.capitalize(), 'Test', role)
"

exec "$@"
