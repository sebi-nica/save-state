from . import igdb
from .models import Game


def upsert_game(data):
    """Create or refresh a local Game from mapped IGDB data."""
    fields = {k: v for k, v in data.items() if k != "igdb_id"}
    game, _ = Game.objects.update_or_create(igdb_id=data["igdb_id"], defaults=fields)
    return game


def import_game(igdb_id):
    """Return the local Game for an IGDB id, fetching it from IGDB the first time."""
    game = Game.objects.filter(igdb_id=igdb_id).first()
    if game:
        return game
    data = igdb.get_game(igdb_id)
    return upsert_game(data) if data else None


UPSERT_FIELDS = ["title", "slug", "cover_url", "summary", "release_date", "genres", "platforms", "updated_at"]


def upsert_games(items):
    """Bulk version of upsert_game: one INSERT ... ON CONFLICT plus one SELECT, in input order."""
    if not items:
        return []
    Game.objects.bulk_create(
        [Game(**data) for data in items],
        update_conflicts=True,
        unique_fields=["igdb_id"],
        update_fields=UPSERT_FIELDS,
    )
    by_igdb_id = {g.igdb_id: g for g in Game.objects.filter(igdb_id__in=[d["igdb_id"] for d in items])}
    return [by_igdb_id[d["igdb_id"]] for d in items]
