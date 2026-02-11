import factory
from django.utils import timezone

from apps.accounts.models import User
from apps.clients.models import Client
from apps.tags.models import Tag
from apps.tasks.models import Task


class ClientFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Client

    name = factory.Sequence(lambda n: f"Client {n}")
    client_type = Client.ClientType.COMPANY
    email = factory.LazyAttribute(lambda o: f"{o.name.lower().replace(' ', '')}@example.com")


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    role = User.Role.ENGINEER
    is_active = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "testpass123")
        user = super()._create(model_class, *args, **kwargs)
        user.set_password(password)
        user.save(update_fields=["password"])
        return user


class ManagerFactory(UserFactory):
    role = User.Role.MANAGER


class EngineerFactory(UserFactory):
    role = User.Role.ENGINEER


class ClientUserFactory(UserFactory):
    role = User.Role.CLIENT
    client = factory.SubFactory(ClientFactory)


class TagFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tag

    name = factory.Sequence(lambda n: f"tag-{n}")
    slug = factory.LazyAttribute(lambda o: o.name)
    color = "#6c757d"


class TaskFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Task
        skip_postgeneration_save = True

    title = factory.Sequence(lambda n: f"Task {n}")
    description = factory.Faker("paragraph")
    priority = Task.Priority.MEDIUM
    status = Task.Status.CREATED
    deadline = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=7))
    created_by = factory.SubFactory(ManagerFactory)

    @factory.post_generation
    def assignees(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        self.assignees.set(extracted)

    @factory.post_generation
    def tags(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        self.tags.set(extracted)
