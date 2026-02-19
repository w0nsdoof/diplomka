from django.db import models


class Client(models.Model):
    class ClientType(models.TextChoices):
        COMPANY = "company", "Company"
        INDIVIDUAL = "individual", "Individual"

    name = models.CharField(max_length=255)
    client_type = models.CharField(max_length=20, choices=ClientType.choices)
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(max_length=254, blank=True, default="")
    contact_person = models.CharField(max_length=255, blank=True, default="")
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="clients",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("name", "organization")]

    def __str__(self):
        return self.name
