"""Fill in IGDB time-to-beat estimates for stored games that don't have them yet.

Runs on every deploy (build.sh). Only games with no estimate are queried, 500 per IGDB request.
"""

from django.core.management.base import BaseCommand

from games import igdb
from games.models import Game

BATCH = 500


class Command(BaseCommand):
    help = "Fetch missing time-to-beat estimates from IGDB."

    def handle(self, *args, **options):
        missing = list(Game.objects.filter(ttb_normally__isnull=True).values_list("igdb_id", flat=True))
        updated = 0
        for start in range(0, len(missing), BATCH):
            found = igdb.fetch_time_to_beat(missing[start : start + BATCH])
            for igdb_id, fields in found.items():
                updated += Game.objects.filter(igdb_id=igdb_id).update(**fields)
        self.stdout.write(f"Time to beat: checked {len(missing)} games, updated {updated}.")
