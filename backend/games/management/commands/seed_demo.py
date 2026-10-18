"""Seed a few well-known games so the UI can be tried without IGDB credentials (local dev only)."""

from django.core.management.base import BaseCommand

from games.models import Game
from games.igdb import COVER_URL

RPG, ADV, SHOOTER, PLATFORM, INDIE = (12, "Role-playing (RPG)"), (31, "Adventure"), (5, "Shooter"), (8, "Platform"), (32, "Indie")
PC, PS4, PS5, SWITCH = (6, "PC (Microsoft Windows)"), (48, "PlayStation 4"), (167, "PlayStation 5"), (130, "Nintendo Switch")

GAMES = [
    (1942, "The Witcher 3: Wild Hunt", "2015-05-19", [RPG, ADV], [PC, PS4], "co1wyy"),
    (119133, "Elden Ring", "2022-02-25", [RPG, ADV], [PC, PS5], "co4jni"),
    (1020, "Grand Theft Auto V", "2013-09-17", [SHOOTER, ADV], [PC, PS4], "co2lbd"),
    (11133, "Dark Souls III", "2016-03-24", [RPG], [PC, PS4], "co1vcf"),
    (7346, "The Legend of Zelda: Breath of the Wild", "2017-03-03", [RPG, ADV], [SWITCH], "co3p2d"),
    (26226, "Celeste", "2018-01-25", [PLATFORM, INDIE], [PC, SWITCH], "co3byy"),
]


class Command(BaseCommand):
    help = "Insert demo games for local UI testing."

    def handle(self, *args, **options):
        for igdb_id, title, released, genres, platforms, cover in GAMES:
            Game.objects.update_or_create(
                igdb_id=igdb_id,
                defaults={
                    "title": title,
                    "release_date": released,
                    "cover_url": COVER_URL.format(image_id=cover),
                    "genres": [{"id": i, "name": n} for i, n in genres],
                    "platforms": [{"id": i, "name": n} for i, n in platforms],
                    "summary": f"{title} (demo record seeded locally).",
                },
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(GAMES)} demo games."))
