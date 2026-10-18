"""Content-based recommendations.

1. Look at the user's 4-5 star games (Completed/Dropped only) and count their genres and platforms.
2. Score local games the user has not tracked by overlap with the top genres/platforms.
3. If that yields too few results, ask IGDB for well-rated games with those genres/platforms,
   cache them locally, and merge them in.
"""

import logging
from collections import Counter

from django.core.cache import cache

from games import igdb
from games.models import Game
from games.services import upsert_games
from library.models import RATEABLE_STATUSES, UserGameList

logger = logging.getLogger(__name__)

TOP_GENRES = 3
TOP_PLATFORMS = 2
GENRE_WEIGHT = 2
PLATFORM_WEIGHT = 1
LOCAL_CANDIDATE_CAP = 2000
DISCOVER_CACHE_SECONDS = 3600


def taste_profile(user):
    """Return the top genres and platforms ({id: name}) from the user's highly rated games."""
    liked = UserGameList.objects.filter(
        user=user, rating__gte=4, status__in=RATEABLE_STATUSES
    ).select_related("game")
    genre_counts, platform_counts, names = Counter(), Counter(), {}
    for entry in liked:
        for g in entry.game.genres:
            genre_counts[g["id"]] += 1
            names[("g", g["id"])] = g["name"]
        for p in entry.game.platforms:
            platform_counts[p["id"]] += 1
            names[("p", p["id"])] = p["name"]
    genres = {gid: names[("g", gid)] for gid, _ in genre_counts.most_common(TOP_GENRES)}
    platforms = {pid: names[("p", pid)] for pid, _ in platform_counts.most_common(TOP_PLATFORMS)}
    return genres, platforms


def score_game(game, genres, platforms):
    matched_genres = [g["name"] for g in game.genres if g["id"] in genres]
    matched_platforms = [p["name"] for p in game.platforms if p["id"] in platforms]
    score = GENRE_WEIGHT * len(matched_genres) + PLATFORM_WEIGHT * len(matched_platforms)
    return score, matched_genres, matched_platforms


def recommend(user, limit=20):
    genres, platforms = taste_profile(user)
    if not genres and not platforms:
        return {
            "based_on": {"genres": [], "platforms": []},
            "source": None,
            "results": [],
            "message": "Rate some Completed or Dropped games 4 or 5 stars to get recommendations.",
        }

    owned_ids = set(UserGameList.objects.filter(user=user).values_list("game_id", flat=True))
    scored = {}

    def consider(game):
        if game.id in owned_ids or game.id in scored:
            return
        score, mg, mp = score_game(game, genres, platforms)
        # Require at least one genre match: platform-only matches are too weak a signal.
        if mg:
            scored[game.id] = (score, game, mg, mp)

    for game in Game.objects.exclude(id__in=owned_ids).order_by("-created_at")[:LOCAL_CANDIDATE_CAP]:
        consider(game)

    source = "local"
    if len(scored) < limit:
        try:
            cache_key = "igdb:discover:" + "-".join(map(str, sorted(genres))) + ":" + "-".join(map(str, sorted(platforms)))
            discovered = cache.get(cache_key)
            if discovered is None:
                discovered = igdb.discover_games(list(genres), list(platforms), limit=limit * 2)
                cache.set(cache_key, discovered, DISCOVER_CACHE_SECONDS)
            for game in upsert_games(discovered):
                consider(game)
            source = "local+igdb"
        except igdb.IGDBError as exc:
            logger.warning("IGDB fallback for recommendations failed: %s", exc)

    ranked = sorted(scored.values(), key=lambda item: (-item[0], item[1].title))[:limit]
    return {
        "based_on": {"genres": list(genres.values()), "platforms": list(platforms.values())},
        "source": source,
        "results": [
            {"game": game, "score": score, "matched_genres": mg, "matched_platforms": mp}
            for score, game, mg, mp in ranked
        ],
        "message": None if ranked else "No matching games found yet. Try rating more games.",
    }
