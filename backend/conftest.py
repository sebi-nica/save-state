import pytest
import responses
from django.core.cache import cache
from rest_framework.test import APIClient

from games import igdb
from games.models import Game


@pytest.fixture(autouse=True)
def _isolated(settings):
    settings.IGDB_CLIENT_ID = "test-client"
    settings.IGDB_CLIENT_SECRET = "test-secret"
    igdb.MIN_INTERVAL = 0
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def mock_igdb():
    """Activate `responses` with a valid Twitch token endpoint; tests register IGDB responses."""
    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
        rsps.post(igdb.TOKEN_URL, json={"access_token": "tok", "expires_in": 5000000})
        yield rsps


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(username="alice", email="alice@example.com", password="S3cure-pass!")


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(username="bob", email="bob@example.com", password="S3cure-pass!")


@pytest.fixture
def admin_user(django_user_model):
    return django_user_model.objects.create_user(
        username="admin", email="admin@example.com", password="S3cure-pass!", is_staff=True
    )


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(admin_user)
    return c


def igdb_raw(igdb_id, name, genres=(), platforms=()):
    """Shape of a raw IGDB /games record. genres/platforms are (id, name) pairs."""
    return {
        "id": igdb_id,
        "name": name,
        "slug": name.lower().replace(" ", "-"),
        "summary": f"{name} summary",
        "first_release_date": 1500000000,
        "cover": {"id": 1, "image_id": f"co{igdb_id}"},
        "genres": [{"id": i, "name": n} for i, n in genres],
        "platforms": [{"id": i, "name": n} for i, n in platforms],
    }


@pytest.fixture
def make_game(db):
    def _make(igdb_id, title=None, genres=(), platforms=()):
        return Game.objects.create(
            igdb_id=igdb_id,
            title=title or f"Game {igdb_id}",
            genres=[{"id": i, "name": n} for i, n in genres],
            platforms=[{"id": i, "name": n} for i, n in platforms],
        )

    return _make
