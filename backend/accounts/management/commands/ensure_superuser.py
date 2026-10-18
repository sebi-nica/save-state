"""Create the admin account from DJANGO_SUPERUSER_* env vars if it does not exist yet.

Runs on every deploy (Render's free tier has no shell for `createsuperuser`). Safe to re-run:
an existing user is left untouched.
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a superuser from DJANGO_SUPERUSER_USERNAME/EMAIL/PASSWORD if missing."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        if not (username and email and password):
            self.stdout.write("DJANGO_SUPERUSER_* not set; skipping.")
            return
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"Superuser '{username}' already exists.")
            return
        User.objects.create_superuser(username=username, email=email.lower(), password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser '{username}'."))
