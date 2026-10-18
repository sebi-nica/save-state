import pytest

from conftest import igdb_raw
from games import igdb
from games.models import Game
from library.models import UserGameList

pytestmark = pytest.mark.django_db
GAMES_URL = f"{igdb.API_URL}/games"


def test_map_game_builds_cover_url_and_date():
    data = igdb.map_game(igdb_raw(42, "Hades", genres=[(12, "RPG")], platforms=[(6, "PC")]))
    assert data["igdb_id"] == 42
    assert data["cover_url"].endswith("/t_cover_big/co42.jpg")
    assert data["release_date"].year == 2017
    assert data["genres"] == [{"id": 12, "name": "RPG"}]


def test_query_escapes_search_text(mock_igdb):
    mock_igdb.post(GAMES_URL, json=[])
    igdb.search_games('say "hi"')
    body = mock_igdb.calls[-1].request.body.decode()
    assert 'search "say \\"hi\\""' in body


def test_search_requires_auth(client):
    assert client.get("/api/games/search/?q=hades").status_code == 401


def test_search_annotates_library_status(auth_client, user, make_game, mock_igdb):
    stored = make_game(1, "Hades")
    UserGameList.objects.create(user=user, game=stored, status="Playing")
    mock_igdb.post(GAMES_URL, json=[igdb_raw(1, "Hades"), igdb_raw(2, "Hades II")])

    resp = auth_client.get("/api/games/search/?q=hades")
    assert resp.status_code == 200
    first, second = resp.data["results"]
    assert first["id"] == stored.id and first["library_status"] == "Playing"
    assert second["id"] is None and second["library_status"] is None
    # Search results are not stored locally.
    assert not Game.objects.filter(igdb_id=2).exists()


def test_search_is_cached(auth_client, mock_igdb):
    mock_igdb.post(GAMES_URL, json=[igdb_raw(1, "Hades")])
    auth_client.get("/api/games/search/?q=Hades")
    auth_client.get("/api/games/search/?q=hades")
    assert sum(1 for c in mock_igdb.calls if c.request.url == GAMES_URL) == 1


def test_search_returns_503_when_igdb_down(auth_client, mock_igdb):
    mock_igdb.post(GAMES_URL, status=500)
    assert auth_client.get("/api/games/search/?q=hades").status_code == 503


def test_retries_once_with_fresh_token_on_401(mock_igdb):
    mock_igdb.post(GAMES_URL, status=401)
    mock_igdb.post(GAMES_URL, json=[igdb_raw(1, "Hades")])
    assert igdb.search_games("hades")[0]["title"] == "Hades"


def test_import_stores_game_once(auth_client, mock_igdb):
    mock_igdb.post(GAMES_URL, json=[igdb_raw(7, "Celeste", genres=[(8, "Platform")])])
    resp = auth_client.post("/api/games/import/", {"igdb_id": 7}, format="json")
    assert resp.status_code == 201
    assert resp.data["title"] == "Celeste"
    again = auth_client.post("/api/games/import/", {"igdb_id": 7}, format="json")
    assert again.data["id"] == resp.data["id"]
    assert Game.objects.count() == 1
    assert sum(1 for c in mock_igdb.calls if c.request.url == GAMES_URL) == 1


def test_import_unknown_game(auth_client, mock_igdb):
    mock_igdb.post(GAMES_URL, json=[])
    assert auth_client.post("/api/games/import/", {"igdb_id": 999}, format="json").status_code == 404


def test_detail_shows_only_public_reviews(client, user, other_user, make_game):
    game = make_game(1, "Hades")
    UserGameList.objects.create(user=user, game=game, status="Completed", rating=5, review="Great")
    # Rated earlier, then moved back to Playing: hidden.
    UserGameList.objects.create(user=other_user, game=game, status="Playing", rating=1, review="Meh")

    resp = client.get(f"/api/games/{game.id}/")
    assert resp.status_code == 200
    assert [r["username"] for r in resp.data["reviews"]] == ["alice"]
    assert resp.data["rating_average"] == 5
    assert resp.data["rating_count"] == 1
    assert resp.data["my_entry"] is None


def test_igdb_not_configured(settings):
    settings.IGDB_CLIENT_ID = ""
    with pytest.raises(igdb.IGDBError):
        igdb.search_games("x")


def test_discover_query_shape(mock_igdb):
    mock_igdb.post(GAMES_URL, json=[])
    igdb.discover_games([12, 31], [6])
    body = mock_igdb.calls[-1].request.body.decode()
    assert "genres = (12,31)" in body and "platforms = (6)" in body
