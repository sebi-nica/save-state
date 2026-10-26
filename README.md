# SaveState

A video game tracker that helps players beat "backlog fatigue": keep track of every game, rate and review what you play, and get suggestions for what to play next.

**Live:** [save-state-rust.vercel.app](https://save-state-rust.vercel.app)

## Features

### Accounts
- Sign up, log in and stay logged in across visits.
- Edit your profile: change your username, email or password, or delete your account.

### Game search
- Search a live database of games with covers, release years, genres and platforms.
- Results leave out DLC, bundles, mods and special editions.
- Each result shows whether the game is already in your library.

### Library
- Track every game as **Playing**, **Backlog**, **Completed** or **Dropped**.
- Filter by status with tabs that show how many games each status holds.
- Sort by recently updated, title, shortest time to beat or highest rating.
- Add or edit a game in one dialog: pick a status from four buttons, and the change saves when you close it.
- Moving a game to Completed or Dropped opens the dialog so you can rate it right away.

### Ratings and reviews
- Rate games from 1 to 5 stars and write a review while you're playing, after you finish, or after you drop a game.
- Reviews are public on each game's page, together with the game's average rating.
- If a game goes back to your Backlog, its rating and review are kept but hidden.

### Game pages
- Cover, release date, summary, genres and platforms.
- Time-to-beat estimates for a rushed playthrough, the main story and a completionist run.
- All public reviews and ratings, plus quick access to your own entry.

### Recommendations
- Personalised suggestions based on the genres and platforms of the games you rate 4 or 5 stars.
- Each suggestion shows which of your favourite genres it matches.
- Games already in your library are never suggested.
- Add any suggestion to your Backlog with one click.

### "What should I play next?"
- Picks three games from your own Backlog, favouring the ones that fit your taste.
- Shuffle for a new set, or limit picks to games under 10, 25 or 50 hours.
- "Start playing" moves a pick straight to Playing.

### Administration (admins only)
- **Users:** search, deactivate, promote to admin, or delete accounts.
- **Games:** browse every stored game, refresh its data, or delete it.
- **Reviews:** moderate ratings and reviews and remove inappropriate ones.

## Tech

| Part | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios. Hosted on **Vercel** |
| Backend | Python 3.13, Django 5.2, Django REST Framework, SimpleJWT (JWT login). Hosted on **Render** |
| Database | PostgreSQL on **Neon** |
| Game data | [IGDB API](https://api-docs.igdb.com/) (Twitch) |
| Testing | pytest (backend) and Vitest with React Testing Library (frontend) |

Vercel serves the website and forwards every `/api/` request to the Django backend on Render, which stores data in Neon and fetches game information from IGDB. Every push to `main` redeploys both services automatically, and a [cron-job.org](https://cron-job.org) job pings the backend every 10 minutes so Render's free tier never puts it to sleep.

---
Game data provided by [IGDB.com](https://www.igdb.com).
