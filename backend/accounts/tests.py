import pytest
from django.conf import settings

COOKIE = settings.REFRESH_COOKIE["key"]
pytestmark = pytest.mark.django_db


def register(client, username="carol", email="carol@example.com", password="S3cure-pass!"):
    return client.post("/api/auth/register/", {"username": username, "email": email, "password": password}, format="json")


def test_register_returns_access_token_and_sets_httponly_cookie(client):
    resp = register(client)
    assert resp.status_code == 201
    assert resp.data["access"]
    assert resp.data["user"]["username"] == "carol"
    cookie = resp.cookies[COOKIE]
    assert cookie["httponly"]
    assert cookie["path"] == "/api/auth/"
    assert cookie["samesite"] == "Lax"


def test_register_rejects_duplicate_email_case_insensitive(client, user):
    resp = register(client, username="alice2", email="ALICE@example.com")
    assert resp.status_code == 400
    assert "email" in resp.data


def test_register_rejects_weak_password(client):
    resp = register(client, password="123")
    assert resp.status_code == 400
    assert "password" in resp.data


def test_login_and_me(client, user):
    resp = client.post("/api/auth/login/", {"username": "alice", "password": "S3cure-pass!"}, format="json")
    assert resp.status_code == 200
    assert COOKIE in resp.cookies
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["email"] == "alice@example.com"


def test_login_wrong_password(client, user):
    resp = client.post("/api/auth/login/", {"username": "alice", "password": "nope"}, format="json")
    assert resp.status_code == 401


def test_refresh_rotates_and_old_token_is_blacklisted(client, user):
    login = client.post("/api/auth/login/", {"username": "alice", "password": "S3cure-pass!"}, format="json")
    old_refresh = login.cookies[COOKIE].value

    resp = client.post("/api/auth/refresh/")
    assert resp.status_code == 200
    assert resp.data["access"]
    assert resp.data["user"]["username"] == "alice"
    new_refresh = resp.cookies[COOKIE].value
    assert new_refresh != old_refresh

    client.cookies[COOKIE] = old_refresh
    reused = client.post("/api/auth/refresh/")
    assert reused.status_code == 401


def test_refresh_without_cookie_is_anonymous_not_error(client):
    resp = client.post("/api/auth/refresh/")
    assert resp.status_code == 200
    assert resp.data == {"access": None, "user": None}


def test_refresh_with_garbage_cookie(client):
    client.cookies[COOKIE] = "not-a-token"
    resp = client.post("/api/auth/refresh/")
    assert resp.status_code == 401
    assert resp.cookies[COOKIE].value == ""


def test_login_is_rate_limited(client, user):
    for _ in range(10):
        assert client.post("/api/auth/login/", {"username": "alice", "password": "nope"}, format="json").status_code == 401
    assert client.post("/api/auth/login/", {"username": "alice", "password": "nope"}, format="json").status_code == 429


def test_logout_clears_cookie_and_blacklists(client, user):
    client.post("/api/auth/login/", {"username": "alice", "password": "S3cure-pass!"}, format="json")
    token = client.cookies[COOKIE].value
    resp = client.post("/api/auth/logout/")
    assert resp.status_code == 204
    assert resp.cookies[COOKIE].value == ""
    client.cookies[COOKIE] = token
    assert client.post("/api/auth/refresh/").status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me/").status_code == 401


def test_update_profile(auth_client, other_user):
    resp = auth_client.patch("/api/auth/me/", {"username": "alice_new"}, format="json")
    assert resp.status_code == 200
    assert resp.data["username"] == "alice_new"
    taken = auth_client.patch("/api/auth/me/", {"email": "bob@example.com"}, format="json")
    assert taken.status_code == 400


def test_profile_cannot_self_promote(auth_client, user):
    auth_client.patch("/api/auth/me/", {"is_staff": True}, format="json")
    user.refresh_from_db()
    assert not user.is_staff


def test_change_password(auth_client, user):
    bad = auth_client.post("/api/auth/me/password/", {"current_password": "x", "new_password": "N3w-pass-123!"}, format="json")
    assert bad.status_code == 400
    ok = auth_client.post(
        "/api/auth/me/password/", {"current_password": "S3cure-pass!", "new_password": "N3w-pass-123!"}, format="json"
    )
    assert ok.status_code == 200
    user.refresh_from_db()
    assert user.check_password("N3w-pass-123!")


def test_delete_account_requires_password(auth_client, user, django_user_model):
    assert auth_client.delete("/api/auth/me/", {"password": "wrong"}, format="json").status_code == 400
    assert auth_client.delete("/api/auth/me/", {"password": "S3cure-pass!"}, format="json").status_code == 204
    assert not django_user_model.objects.filter(pk=user.pk).exists()


def test_ensure_superuser_command(monkeypatch, django_user_model):
    from django.core.management import call_command

    monkeypatch.setenv("DJANGO_SUPERUSER_USERNAME", "root")
    monkeypatch.setenv("DJANGO_SUPERUSER_EMAIL", "root@example.com")
    monkeypatch.setenv("DJANGO_SUPERUSER_PASSWORD", "R00t-pass!")
    call_command("ensure_superuser")
    call_command("ensure_superuser")  # idempotent
    root = django_user_model.objects.get(username="root")
    assert root.is_superuser and root.is_staff
