import pytest

from conftest import igdb_raw
from games import igdb
from games.models import Game
from library.models import UserGameList
from recommendations.services import recommend, taste_profile

pytestmark = pytest.mark.django_db
GAMES_URL = f"{igdb.API_URL}/games"
RPG, SHOOTER, PUZZLE = (12, "RPG"), (5, "Shooter"), (9, "Puzzle")
PC, PS5 = (6, "PC"), (167, "PS5")


@pytest.fixture
def rpg_fan(user, make_game):
    """alice loves RPGs on PC, dislikes a shooter, and has an RPG in her backlog."""
    loved = make_game(1, "Loved RPG", genres=[RPG], platforms=[PC])
    UserGameList.objects.create(user=user, game=loved, status="Completed", rating=5)
    UserGameList.objects.create(
        user=user, game=make_game(2, "Liked RPG", genres=[RPG, PUZZLE], platforms=[PC]), status="Dropped", rating=4
    )
    UserGameList.objects.create(
        user=user, game=make_game(3, "Bad shooter", genres=[SHOOTER], platforms=[PS5]), status="Completed", rating=1
    )
    UserGameList.objects.create(user=user, game=make_game(4, "Backlog RPG", genres=[RPG], platforms=[PC]), status="Backlog")
    return user


def test_taste_profile_uses_only_4_and_5_star_rateable_entries(rpg_fan, make_game):
    # A 5-star rating left on a game moved back to Playing is ignored.
    UserGameList.objects.create(
        user=rpg_fan, game=make_game(5, "Hidden", genres=[SHOOTER], platforms=[PS5]), status="Playing", rating=5
    )
    genres, platforms = taste_profile(rpg_fan)
    assert list(genres) == [12, 9]
    assert list(platforms) == [6]


def test_no_liked_games_gives_message(user):
    data = recommend(user)
    assert data["results"] == []
    assert "Rate" in data["message"]


def test_local_results_ranked_and_exclude_owned(rpg_fan, make_game):
    best = make_game(10, "RPG Puzzle PC", genres=[RPG, PUZZLE], platforms=[PC])
    ok = make_game(11, "RPG on PS5", genres=[RPG], platforms=[PS5])
    make_game(12, "Shooter on PC", genres=[SHOOTER], platforms=[PC])  # platform-only: excluded
    data = recommend(rpg_fan, limit=2)
    titles = [r["game"].title for r in data["results"]]
    assert titles == [best.title, ok.title]
    assert data["source"] == "local"
    assert data["results"][0]["matched_genres"] == ["RPG", "Puzzle"]
    assert "Backlog RPG" not in titles and "Loved RPG" not in titles


def test_igdb_fallback_fills_and_caches(rpg_fan, make_game, mock_igdb):
    make_game(10, "Local RPG", genres=[RPG], platforms=[PC])
    mock_igdb.post(
        GAMES_URL,
        json=[
            igdb_raw(1, "Loved RPG", genres=[RPG], platforms=[PC]),  # owned -> skipped
            igdb_raw(100, "Remote RPG", genres=[RPG, PUZZLE], platforms=[PC]),
            igdb_raw(101, "Remote shooter", genres=[SHOOTER], platforms=[PC]),  # no genre match
        ],
    )
    data = recommend(rpg_fan, limit=5)
    titles = [r["game"].title for r in data["results"]]
    assert titles == ["Remote RPG", "Local RPG"]
    assert data["source"] == "local+igdb"
    assert Game.objects.filter(igdb_id=100).exists()  # cached locally

    body = [c for c in mock_igdb.calls if c.request.url == GAMES_URL][0].request.body.decode()
    assert "genres = (12,9)" in body and "platforms = (6)" in body

    recommend(rpg_fan, limit=5)
    assert sum(1 for c in mock_igdb.calls if c.request.url == GAMES_URL) == 1


def test_igdb_failure_falls_back_to_local(rpg_fan, make_game, mock_igdb):
    make_game(10, "Local RPG", genres=[RPG], platforms=[PC])
    mock_igdb.post(GAMES_URL, status=500)
    data = recommend(rpg_fan, limit=5)
    assert [r["game"].title for r in data["results"]] == ["Local RPG"]
    assert data["source"] == "local"


def test_endpoint(auth_client, rpg_fan, make_game, mock_igdb):
    mock_igdb.post(GAMES_URL, json=[])
    make_game(10, "Local RPG", genres=[RPG], platforms=[PC])
    resp = auth_client.get("/api/recommendations/")
    assert resp.status_code == 200
    assert resp.data["based_on"]["genres"] == ["RPG", "Puzzle"]
    assert resp.data["results"][0]["game"]["title"] == "Local RPG"


def test_endpoint_requires_auth(client):
    assert client.get("/api/recommendations/").status_code == 401


# --- Backlog picker ---------------------------------------------------------------------------

import random  # noqa: E402

from recommendations.services import pick_next  # noqa: E402


def add_backlog(user, make_game, igdb_id, title, genres=(), platforms=(), hours=None):
    game = make_game(igdb_id, title, genres=genres, platforms=platforms)
    if hours is not None:
        Game.objects.filter(pk=game.pk).update(ttb_normally=hours * 3600)
    return UserGameList.objects.create(user=user, game=game, status="Backlog")


def test_picker_only_draws_from_backlog(rpg_fan, make_game):
    picks = pick_next(rpg_fan, count=5, rng=random.Random(1))
    assert [p["entry"].game.title for p in picks["results"]] == ["Backlog RPG"]
    assert picks["backlog_size"] == 1


def test_picker_empty_backlog(user):
    data = pick_next(user)
    assert data["results"] == [] and "backlog is empty" in data["message"]


def test_picker_respects_max_hours_and_skips_unknown_lengths(user, make_game):
    add_backlog(user, make_game, 1, "Short", hours=8)
    add_backlog(user, make_game, 2, "Long", hours=60)
    add_backlog(user, make_game, 3, "Unknown")
    data = pick_next(user, count=3, max_hours=10, rng=random.Random(0))
    assert [p["entry"].game.title for p in data["results"]] == ["Short"]
    assert "under 5 hours" in pick_next(user, max_hours=5)["message"]


def test_picker_favours_games_matching_taste(rpg_fan, make_game):
    # rpg_fan loves RPGs on PC; give the backlog one more matching and one non-matching game.
    add_backlog(rpg_fan, make_game, 20, "Another RPG", genres=[RPG], platforms=[PC])
    add_backlog(rpg_fan, make_game, 21, "Puzzle-free shooter", genres=[SHOOTER], platforms=[PS5])
    rng = random.Random(42)
    firsts = [pick_next(rpg_fan, count=1, rng=rng)["results"][0]["entry"].game.title for _ in range(600)]
    shooter_share = firsts.count("Puzzle-free shooter") / len(firsts)
    # Weights: each RPG on PC scores 1 + 2 + 1 = 4, the shooter scores 1 -> about 1/9 of draws.
    assert 0.05 < shooter_share < 0.2


def test_picker_returns_distinct_games(user, make_game):
    for i in range(5):
        add_backlog(user, make_game, 100 + i, f"G{i}")
    titles = [p["entry"].game.title for p in pick_next(user, count=5, rng=random.Random(3))["results"]]
    assert sorted(titles) == [f"G{i}" for i in range(5)]


def test_picker_endpoint(auth_client, user, make_game):
    entry = add_backlog(user, make_game, 1, "Short", genres=[RPG], hours=8)
    resp = auth_client.get("/api/recommendations/next/?max_hours=10&count=2&seed=7")
    assert resp.status_code == 200
    assert resp.data["results"][0]["entry"]["id"] == entry.id
    assert resp.data["results"][0]["entry"]["game"]["ttb_normally"] == 8 * 3600
    assert auth_client.get("/api/recommendations/next/?max_hours=abc").status_code == 200


def test_picker_endpoint_requires_auth(client):
    assert client.get("/api/recommendations/next/").status_code == 401
