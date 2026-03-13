from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.MANAGER)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        MANAGER = "manager", "Manager"
        ENGINEER = "engineer", "Engineer"
        CLIENT = "client", "Client"

    username = None
    email = models.EmailField(max_length=254, unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, db_index=True)
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="portal_users",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )
    avatar = models.ImageField(upload_to="avatars/", blank=True, default="")
    job_title = models.CharField(max_length=150, blank=True, default="")
    skills = models.TextField(blank=True, default="")
    bio = models.TextField(blank=True, default="")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        indexes = [
            models.Index(fields=["role"], name="ix_user_role"),
        ]

    @property
    def is_superadmin(self):
        return self.role == self.Role.SUPERADMIN

    def clean(self):
        super().clean()
        if self.role == self.Role.SUPERADMIN and self.organization_id is not None:
            raise ValidationError("Superadmin users must not have an organization.")
        if self.role and self.role != self.Role.SUPERADMIN and not self.organization_id:
            raise ValidationError("Non-superadmin users must have an organization.")

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
