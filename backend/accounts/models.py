from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Standard Django user with a unique email. Roles use is_staff / is_superuser."""

    email = models.EmailField(unique=True)
