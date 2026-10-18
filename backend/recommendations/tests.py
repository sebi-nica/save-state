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
