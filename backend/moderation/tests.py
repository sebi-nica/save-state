import pytest

from conftest import igdb_raw
from games import igdb
from games.models import Game
from library.models import UserGameList

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("url", ["/api/admin/users/", "/api/admin/games/", "/api/admin/reviews/"])
def test_regular_users_are_forbidden(auth_client, client, url):
    assert auth_client.get(url).status_code == 403
    assert client.get(url).status_code == 401


def test_list_and_search_users(admin_client, user, other_user):
    resp = admin_client.get("/api/admin/users/?search=ali")
    assert resp.status_code == 200
    assert [u["username"] for u in resp.data["results"]] == ["alice"]


def test_deactivate_and_promote_user(admin_client, user):
    resp = admin_client.patch(f"/api/admin/users/{user.id}/", {"is_active": False, "is_staff": True}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert not user.is_active and user.is_staff


def test_admin_cannot_modify_self(admin_client, admin_user):
    resp = admin_client.patch(f"/api/admin/users/{admin_user.id}/", {"is_staff": False}, format="json")
    assert resp.status_code == 400
    assert admin_client.delete(f"/api/admin/users/{admin_user.id}/").status_code == 400


def test_staff_cannot_modify_superuser(admin_client, django_user_model):
    root = django_user_model.objects.create_superuser(username="root", email="root@example.com", password="x")
    assert admin_client.delete(f"/api/admin/users/{root.id}/").status_code == 403


def test_delete_user(admin_client, user, django_user_model):
    assert admin_client.delete(f"/api/admin/users/{user.id}/").status_code == 204
    assert not django_user_model.objects.filter(pk=user.pk).exists()


def test_games_list_delete_and_resync(admin_client, make_game, mock_igdb):
    game = make_game(7, "Old title")
    listed = admin_client.get("/api/admin/games/").data["results"]
    assert listed[0]["entry_count"] == 0

    mock_igdb.post(f"{igdb.API_URL}/games", json=[igdb_raw(7, "New title")])
    resp = admin_client.post(f"/api/admin/games/{game.id}/resync/")
    assert resp.status_code == 200
    assert resp.data["title"] == "New title"

    assert admin_client.delete(f"/api/admin/games/{game.id}/").status_code == 204
    assert not Game.objects.exists()


def test_reviews_list_and_delete_clears_rating_only(admin_client, user, make_game):
    reviewed = UserGameList.objects.create(user=user, game=make_game(1), status="Completed", rating=2, review="Rude")
    UserGameList.objects.create(user=user, game=make_game(2), status="Backlog")
    resp = admin_client.get("/api/admin/reviews/")
    assert [r["id"] for r in resp.data["results"]] == [reviewed.id]

    assert admin_client.delete(f"/api/admin/reviews/{reviewed.id}/").status_code == 204
    reviewed.refresh_from_db()
    assert reviewed.rating is None and reviewed.review is None
    assert reviewed.status == "Completed"
