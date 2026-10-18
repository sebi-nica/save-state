"""Minimal IGDB (Twitch) API client.

Auth uses the Twitch client-credentials flow; the app token is cached until shortly before it
expires. IGDB allows ~4 requests/second, so calls are spaced out per process and 429s are retried.
"""

import logging
import threading
import time
from datetime import datetime, timezone

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

TOKEN_URL = "https://id.twitch.tv/oauth2/token"
API_URL = "https://api.igdb.com/v4"
COVER_URL = "https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"
TOKEN_CACHE_KEY = "igdb:token"
GAME_FIELDS = "name,slug,summary,first_release_date,cover.image_id,genres.name,platforms.name"
# Keep real, standalone games: main games, standalone expansions, remakes, remasters,
# expanded games and ports. Drops DLC, bundles, mods, episodes, updates and editions
# (GOTY/Deluxe editions are versions of a parent game).
GAME_FILTER = "game_type = (0,4,8,9,10,11) & version_parent = null"
MIN_INTERVAL = 0.26  # seconds between requests (just under 4 req/s)
TIMEOUT = 10

_lock = threading.Lock()
_last_request = 0.0


class IGDBError(Exception):
    """Raised when IGDB is unreachable, misconfigured, or returns an error."""


def _get_token(force_refresh=False):
    token = None if force_refresh else cache.get(TOKEN_CACHE_KEY)
    if token:
        return token
    if not settings.IGDB_CLIENT_ID or not settings.IGDB_CLIENT_SECRET:
        raise IGDBError("IGDB credentials are not configured.")
    try:
        resp = requests.post(
            TOKEN_URL,
            params={
                "client_id": settings.IGDB_CLIENT_ID,
                "client_secret": settings.IGDB_CLIENT_SECRET,
                "grant_type": "client_credentials",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise IGDBError(f"Could not get an IGDB token: {exc}") from exc
    token = data["access_token"]
    cache.set(TOKEN_CACHE_KEY, token, timeout=max(int(data.get("expires_in", 3600)) - 300, 60))
    return token


def _throttle():
    global _last_request
    with _lock:
        wait = MIN_INTERVAL - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()


def query(endpoint, body, _retries=3):
    """POST an Apicalypse query to an IGDB endpoint and return the parsed JSON list."""
    token = _get_token()
    for attempt in range(_retries):
        _throttle()
        try:
            resp = requests.post(
                f"{API_URL}/{endpoint}",
                data=body.encode("utf-8"),
                headers={
                    "Client-ID": settings.IGDB_CLIENT_ID,
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
                timeout=TIMEOUT,
            )
        except requests.RequestException as exc:
            raise IGDBError(f"IGDB request failed: {exc}") from exc
        if resp.status_code == 401 and attempt == 0:
            token = _get_token(force_refresh=True)
            continue
        if resp.status_code == 429:
            time.sleep(0.5 * (attempt + 1))
            continue
        if resp.status_code >= 400:
            logger.warning("IGDB %s returned %s: %s", endpoint, resp.status_code, resp.text[:300])
            raise IGDBError(f"IGDB returned HTTP {resp.status_code}.")
        try:
            return resp.json()
        except ValueError as exc:
            raise IGDBError("IGDB returned invalid JSON.") from exc
    raise IGDBError("IGDB is rate limiting requests; try again shortly.")


def _quote(text):
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _id_list(ids):
    return "(" + ",".join(str(int(i)) for i in ids) + ")"


def map_game(raw):
    """Convert an IGDB game record into Game model field values."""
    release = raw.get("first_release_date")
    cover = raw.get("cover") or {}
    return {
        "igdb_id": raw["id"],
        "title": raw.get("name", "Untitled"),
        "slug": raw.get("slug", "")[:255],
        "summary": raw.get("summary", ""),
        "release_date": datetime.fromtimestamp(release, tz=timezone.utc).date() if release else None,
        "cover_url": COVER_URL.format(image_id=cover["image_id"]) if cover.get("image_id") else "",
        "genres": [{"id": g["id"], "name": g.get("name", "")} for g in raw.get("genres", [])],
        "platforms": [{"id": p["id"], "name": p.get("name", "")} for p in raw.get("platforms", [])],
    }


TTB_FIELDS = ("hastily", "normally", "completely")


def fetch_time_to_beat(igdb_ids):
    """Return {igdb_id: {"ttb_hastily": s, "ttb_normally": s, "ttb_completely": s}} for the ids
    IGDB has estimates for. Best effort: time-to-beat is optional, so IGDB errors yield {}."""
    ids = [int(i) for i in igdb_ids]
    if not ids:
        return {}
    body = f"fields game_id,{','.join(TTB_FIELDS)}; where game_id = {_id_list(ids)}; limit 500;"
    try:
        rows = query("game_time_to_beats", body)
    except IGDBError as exc:
        logger.info("Time-to-beat lookup failed: %s", exc)
        return {}
    return {row["game_id"]: {f"ttb_{f}": row.get(f) for f in TTB_FIELDS} for row in rows}


def with_time_to_beat(games):
    """Attach time-to-beat fields to mapped games (in place) and return them."""
    ttb = fetch_time_to_beat(g["igdb_id"] for g in games)
    for game in games:
        game.update(ttb.get(game["igdb_id"], {}))
    return games


def search_games(text, limit=20):
    body = f"search {_quote(text)}; fields {GAME_FIELDS}; where {GAME_FILTER}; limit {int(limit)};"
    return [map_game(raw) for raw in query("games", body)]


def get_game(igdb_id):
    body = f"fields {GAME_FIELDS}; where id = {int(igdb_id)};"
    results = query("games", body)
    return with_time_to_beat([map_game(results[0])])[0] if results else None


def discover_games(genre_ids, platform_ids, limit=40):
    """Well-rated games matching any of the genres and any of the platforms."""
    conditions = [GAME_FILTER, "total_rating_count > 100"]
    if genre_ids:
        conditions.append(f"genres = {_id_list(genre_ids)}")
    if platform_ids:
        conditions.append(f"platforms = {_id_list(platform_ids)}")
    body = (
        f"fields {GAME_FIELDS}; where {' & '.join(conditions)}; "
        f"sort total_rating desc; limit {int(limit)};"
    )
    return with_time_to_beat([map_game(raw) for raw in query("games", body)])
