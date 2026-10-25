import pytest

from conftest import igdb_raw
from games import igdb
from library.models import UserGameList

pytestmark = pytest.mark.django_db
URL = "/api/library/"


def test_add_by_game_id(auth_client, make_game):
    game = make_game(1)
    resp = auth_client.post(URL, {"game_id": game.id, "status": "Backlog"}, format="json")
    assert resp.status_code == 201
    assert resp.data["game"]["title"] == game.title
    assert resp.data["status"] == "Backlog"


def test_add_by_igdb_id_imports_game(auth_client, mock_igdb):
    mock_igdb.post(f"{igdb.API_URL}/games", json=[igdb_raw(5, "Celeste")])
    resp = auth_client.post(URL, {"igdb_id": 5, "status": "Playing"}, format="json")
    assert resp.status_code == 201
    assert resp.data["game"]["igdb_id"] == 5


def test_duplicate_add_rejected(auth_client, make_game):
    game = make_game(1)
    auth_client.post(URL, {"game_id": game.id, "status": "Backlog"}, format="json")
    resp = auth_client.post(URL, {"game_id": game.id, "status": "Playing"}, format="json")
    assert resp.status_code == 400


def test_requires_a_game(auth_client):
    assert auth_client.post(URL, {"status": "Backlog"}, format="json").status_code == 400


def test_invalid_status(auth_client, make_game):
    resp = auth_client.post(URL, {"game_id": make_game(1).id, "status": "Wishlist"}, format="json")
    assert resp.status_code == 400


@pytest.mark.parametrize("rating", [0, 6])
def test_rating_out_of_range(auth_client, make_game, rating):
    resp = auth_client.post(URL, {"game_id": make_game(1).id, "status": "Completed", "rating": rating}, format="json")
    assert resp.status_code == 400


@pytest.mark.parametrize("status", ["Playing", "Completed", "Dropped"])
def test_can_rate_playing_completed_and_dropped(auth_client, make_game, status):
    resp = auth_client.post(
        URL, {"game_id": make_game(1).id, "status": status, "rating": 4, "review": "Fun"}, format="json"
    )
    assert resp.status_code == 201
    assert resp.data["rating"] == 4 and resp.data["review_visible"]


def test_cannot_rate_backlog_games(auth_client, make_game):
    resp = auth_client.post(URL, {"game_id": make_game(1).id, "status": "Backlog", "rating": 4}, format="json")
    assert resp.status_code == 400
    resp = auth_client.post(URL, {"game_id": make_game(2).id, "status": "Backlog", "review": "text"}, format="json")
    assert resp.status_code == 400


def test_moving_back_to_backlog_keeps_but_hides_rating(auth_client, make_game):
    entry = auth_client.post(
        URL, {"game_id": make_game(1).id, "status": "Completed", "rating": 5, "review": "Loved it"}, format="json"
    ).data
    resp = auth_client.patch(f"{URL}{entry['id']}/", {"status": "Backlog"}, format="json")
    assert resp.status_code == 200
    assert resp.data["rating"] == 5
    assert resp.data["review_visible"] is False
    # But a new rating can't be set while in the Backlog.
    assert auth_client.patch(f"{URL}{entry['id']}/", {"rating": 3}, format="json").status_code == 400


def test_review_while_playing_then_finish(auth_client, make_game):
    entry = auth_client.post(
        URL, {"game_id": make_game(1).id, "status": "Playing", "rating": 4, "review": "Great so far"}, format="json"
    ).data
    assert entry["review_visible"] is True
    resp = auth_client.patch(f"{URL}{entry['id']}/", {"status": "Completed", "rating": 5}, format="json")
    assert resp.status_code == 200
    assert (resp.data["rating"], resp.data["review"]) == (5, "Great so far")


def test_blank_review_is_stored_as_null(auth_client, make_game):
    resp = auth_client.post(URL, {"game_id": make_game(1).id, "status": "Backlog", "review": "   "}, format="json")
    assert resp.status_code == 201
    assert resp.data["review"] is None


def test_list_is_scoped_to_user_and_filterable(auth_client, user, other_user, make_game):
    g1, g2, g3 = make_game(1), make_game(2), make_game(3)
    UserGameList.objects.create(user=user, game=g1, status="Playing")
    UserGameList.objects.create(user=user, game=g2, status="Backlog")
    UserGameList.objects.create(user=other_user, game=g3, status="Playing")
    assert len(auth_client.get(URL).data) == 2
    playing = auth_client.get(f"{URL}?status=Playing").data
    assert [e["game"]["id"] for e in playing] == [g1.id]


def test_cannot_touch_other_users_entries(auth_client, other_user, make_game):
    entry = UserGameList.objects.create(user=other_user, game=make_game(1), status="Playing")
    assert auth_client.patch(f"{URL}{entry.id}/", {"status": "Dropped"}, format="json").status_code == 404
    assert auth_client.delete(f"{URL}{entry.id}/").status_code == 404


def test_delete_entry(auth_client, user, make_game):
    entry = UserGameList.objects.create(user=user, game=make_game(1), status="Playing")
    assert auth_client.delete(f"{URL}{entry.id}/").status_code == 204
    assert not UserGameList.objects.exists()


def test_cannot_change_game_of_entry(auth_client, user, make_game):
    g1, g2 = make_game(1), make_game(2)
    entry = UserGameList.objects.create(user=user, game=g1, status="Playing")
    auth_client.patch(f"{URL}{entry.id}/", {"game_id": g2.id}, format="json")
    entry.refresh_from_db()
    assert entry.game == g1
