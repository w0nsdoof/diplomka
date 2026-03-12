#!/bin/sh
set -e

# Only run collectstatic, migrations and seed users from the main backend
# process (CMD=daphne), not from celery-worker or celery-beat which share
# this entrypoint.
case "$1" in
  daphne*)
    echo "Collecting static files..."
    rm -rf /app/staticfiles
    python manage.py collectstatic --noinput

    echo "Running migrations..."
    python manage.py migrate --noinput

    echo "Seeding users..."
    python manage.py shell -c "
from apps.accounts.models import User
from apps.organizations.models import Organization
import os

# Ensure a default organization exists for seed users
default_org, _ = Organization.objects.get_or_create(
    slug='default',
    defaults={'name': 'Default Organization'},
)

def ensure_user(email, password, first_name, last_name, role,
                organization=None, is_staff=False, is_superuser=False):
    user, created = User.objects.get_or_create(email=email, defaults={
        'first_name': first_name,
        'last_name': last_name,
        'role': role,
        'organization': organization,
        'is_staff': is_staff,
        'is_superuser': is_superuser,
        'is_active': True,
    })
    if created:
        user.set_password(password)
        user.save()
        print(f'User created: {email} ({role})')
    else:
        user.set_password(password)
        if not user.is_active:
            user.is_active = True
        user.save()
        print(f'User updated: {email} ({role})')

# Superuser (manager with staff/superuser flags, belongs to default org)
email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if email and password:
    ensure_user(email, password, 'Admin', 'User', 'manager',
                organization=default_org, is_staff=True, is_superuser=True)

# Test accounts (belong to default org)
for role in ('manager', 'engineer', 'client'):
    env_email = os.environ.get(f'TEST_{role.upper()}_EMAIL')
    env_password = os.environ.get(f'TEST_{role.upper()}_PASSWORD')
    if env_email and env_password:
        ensure_user(env_email, env_password, role.capitalize(), 'Test', role,
                    organization=default_org)
"
    ;;
  *)
    echo "Skipping migrations and user seeding (not the main backend process)."
    ;;
esac

exec "$@"
