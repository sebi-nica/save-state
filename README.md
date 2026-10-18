# SaveState

A video game tracker for beating "backlog fatigue". Users track games as **Playing**, **Backlog**, **Completed** or **Dropped**. They can rate and review what they finish and get content-based recommendations. Admins moderate users, games and reviews.

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, Axios | Vercel |
| Backend | Python 3.13, Django 5.2, Django REST Framework, SimpleJWT | Render |
| Database | PostgreSQL | Neon (AWS eu-central-1) |
| Game data | [IGDB API](https://api-docs.igdb.com/) (Twitch) | — |

```
backend/    Django project (savestate) + apps: accounts, games, library, recommendations, moderation
frontend/   React SPA
```

## Changes from the original specification

- **IGDB instead of RAWG.** RAWG proved unreliable. `Game.rawg_id` is now `igdb_id`. Search goes through the backend, so the API secret never reaches the browser.
- **Ratings and reviews** are allowed for Completed *and* Dropped games. If an entry moves back to Playing or Backlog, its rating and review are kept but hidden from the game page and ignored by the recommender.
- **Recommendations** first score local games against the user's taste. If there are too few, they fall back to an IGDB query using the user's top genres and platforms. Games already in the user's library, Backlog included, are never suggested.
- **Reviews are public** on each game's page.
- **Refresh-token cookie.** Vercel rewrites `/api/*` to Render, so the browser only talks to one origin. The HTTP-only refresh cookie is therefore first-party (`SameSite=Lax`), which Safari and other privacy-focused browsers don't block.
- **Profile editing** (username, email, password, account deletion) is included. Password reset is out of scope for now.

## Local development

Prerequisites: Python 3.12+ (`py -3.13` on Windows) and Node 20+.

### Backend

```bash
cd backend
py -3.13 -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/pip
cp .env.example .env                                   # then fill in the values
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py createcachetable
.venv/Scripts/python manage.py createsuperuser
.venv/Scripts/python manage.py runserver 8000
```

`backend/.env` values:

| Variable | Notes |
|---|---|
| `DEBUG` | `True` locally |
| `SECRET_KEY` | `python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"` |
| `DATABASE_URL` | Neon **dev** branch, pooled connection string. Leave empty to use local SQLite. |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | From your app at [dev.twitch.tv/console](https://dev.twitch.tv/console) |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | Defaults work for local development |

Without IGDB credentials, you can load a few demo games with `manage.py seed_demo` to try the UI.

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173; /api is proxied to localhost:8000
```

### Tests

```bash
cd backend
.venv/Scripts/python -m pytest
```

Tests run on in-memory SQLite and mock every IGDB call, so they need no network access or credentials. To run them against Postgres instead, set `TEST_DATABASE_URL`.

### Frontend tests

```bash
cd frontend
npm test            # single run; `npm run test:watch` re-runs on save
```

Vitest and React Testing Library run in jsdom with a fake HTTP layer. They cover:
- The API client: token refresh on 401, sharing one refresh between concurrent calls, the cross-tab Web Lock, and cold-start retries with the "waking up" signal.
- Rating rules in the library editor.
- The star rating control.
- Library tabs and status changes.
- The route guards.

## API overview

All endpoints are under `/api/`. Authenticated endpoints expect `Authorization: Bearer <access token>`.

| Method & path | Description |
|---|---|
| `POST auth/register/`, `POST auth/login/` | Return `{access, user}` and set the `refresh_token` cookie |
| `POST auth/refresh/` | Issue a new access token and rotate the refresh cookie |
| `POST auth/logout/` | Blacklist the refresh token and clear the cookie |
| `GET/PATCH/DELETE auth/me/`, `POST auth/me/password/` | Profile management; DELETE requires `{password}` |
| `GET games/search/?q=` | Live IGDB search, annotated with the user's library status |
| `POST games/import/ {igdb_id}` | Store a selected IGDB game locally |
| `GET games/{id}/` | Game details, public reviews, average rating, and the caller's own entry (public endpoint) |
| `GET/POST library/`, `PATCH/DELETE library/{id}/` | The user's tracked games; `?status=` filters. POST accepts `game_id` or `igdb_id`. |
| `GET recommendations/` | Personalized suggestions, plus the genres and platforms they're based on |
| `GET recommendations/next/?max_hours=&count=` | "What should I play next?": weighted random picks from the user's Backlog |
| `admin/users/`, `admin/games/`, `admin/reviews/` | Staff only: list (`?search=`, `?page=`), update, delete; `POST admin/games/{id}/resync/` |

The Django admin panel is also available as a fallback at `/django-admin/` on the backend.

### Time to beat
Each game stores IGDB's community time-to-beat estimates (rushed, main story, completionist), fetched when the game is imported or discovered. `manage.py backfill_time_to_beat` fills in missing estimates and runs on every deploy. The Library can sort by shortest main-story time.

### Backlog picker
`recommendations/next/` draws up to `count` distinct games from the user's Backlog. Each game's weight is `1 + taste score`, where the taste score is the same genre/platform score the recommender uses. Games the user is likely to enjoy come up more often, but every backlog game keeps a chance. `max_hours` keeps only games whose main-story estimate is known and fits.

### Caching
The cache is Django's database cache (the `django_cache` table, created by `createcachetable`), so all gunicorn workers share cached IGDB searches, the IGDB token and rate-limit counters. Vercel serves the hashed `/assets/*` files with a one-year immutable `Cache-Control` header.

### Recommendation algorithm

1. Take the user's 4★ and 5★ entries that are Completed or Dropped. Count genres and platforms, and keep the top 3 genres and the top 2 platforms.
2. Score every local game not in the user's library: `2 × genre matches + 1 × platform matches`. Games need at least one genre match.
3. If fewer than 20 games qualify, query IGDB for well-rated games with those genres and platforms (cached for an hour). Store the results locally and merge them in.

## Deployment

### 1. Neon
Create a project in **AWS Europe Central 1 (Frankfurt)**. Use the `production` branch for Render and the `dev` branch for local work, and copy the **pooled** connection strings.

### 2. Render (backend)
New **Web Service** from the GitHub repo:
- Root directory: `backend`
- Runtime: Python
- Build command: `bash build.sh`. It installs packages, runs `collectstatic`, `migrate` and `createcachetable`, creates the admin account through `ensure_superuser`, and backfills missing time-to-beat estimates.
- Start command: `gunicorn savestate.wsgi`
- Health check path: `/api/health/`
- Environment variables:

| Variable | Value |
|---|---|
| `PYTHON_VERSION` | `3.13.0` or newer |
| `DEBUG` | `False` |
| `SECRET_KEY` | A newly generated key, different from your local one |
| `DATABASE_URL` | Neon `production` pooled connection string |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Twitch app credentials |
| `ALLOWED_HOSTS` | `<service>.onrender.com` |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | `https://<project>.vercel.app` |
| `DJANGO_SUPERUSER_USERNAME` / `_EMAIL` / `_PASSWORD` | The first admin account |

Render's free tier sleeps after about 15 minutes of inactivity, so the first request after that can take up to a minute.

### 3. Vercel (frontend)
1. `frontend/vercel.json` rewrites `/api/*` to `https://save-state-api.onrender.com`. Update it if the Render service is renamed.
2. Import the repo in Vercel with root directory `frontend` and framework preset **Vite**. No environment variables are needed.
3. After the first deploy, put the Vercel URL into Render's `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.

Pushes to `main` redeploy both services automatically.

---
Game data provided by [IGDB.com](https://www.igdb.com).
