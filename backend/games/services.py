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
