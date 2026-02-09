from django.db import models


class Client(models.Model):
    class ClientType(models.TextChoices):
        COMPANY = "company", "Company"
        INDIVIDUAL = "individual", "Individual"

    name = models.CharField(max_length=255, unique=True)
    client_type = models.CharField(max_length=20, choices=ClientType.choices)
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(max_length=254, blank=True, default="")
    contact_person = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
