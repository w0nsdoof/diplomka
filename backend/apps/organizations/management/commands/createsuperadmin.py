from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Create a superadmin user (no organization, role=superadmin)"

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Superadmin email address")
        parser.add_argument("--password", required=True, help="Superadmin password")
        parser.add_argument("--first-name", default="Platform", help="First name")
        parser.add_argument("--last-name", default="Admin", help="Last name")

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        first_name = options["first_name"]
        last_name = options["last_name"]

        if User.objects.filter(email=email).exists():
            raise CommandError(f"User with email {email} already exists.")

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.SUPERADMIN,
            organization=None,
            is_staff=True,
        )
        self.stdout.write(
            self.style.SUCCESS(f"Superadmin created: {user.email}")
        )
