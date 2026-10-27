# MusicGrid

The daily music trivia grid at [musicgrid.stevenhester.com](https://musicgrid.stevenhester.com). Name a song for every square that fits both its artist and its category. Deeper cuts score more.

Static site on GitHub Pages. All data comes from the MusicGrid API on Heroku (`music-grid-io-42616e204fd3.herokuapp.com`).

## Pages

| URL | File | Script |
| --- | --- | --- |
| `/` | `index.html` | `js/grid-game.js` (daily mode) |
| `/?grid=N` | `index.html` | `js/grid-game.js` (a past daily grid) |
| `/play-custom-grid?custom_grid_id=N` | `play-custom-grid.html` | `js/grid-game.js` (custom mode) |
| `/browse` | `browse.html` | `js/browse.js` (past daily grids and player-made grids) |
| `/stats` | `stats.html` | `js/stats.js` (streaks, averages, score chart, game history) |
| `/grid-builder/` | `grid-builder/index.html` | none |
| `/grid-builder/spotify-login` | `grid-builder/spotify-login.html` | `js/gb-spotifyLogin.js` |
| `/grid-builder/artist-selection` | `grid-builder/artist-selection.html` | `js/gb-artistSelect.js` |
| `/grid-builder/manual-artist-pick` | `grid-builder/manual-artist-pick.html` | `js/gb-artistSelect.js` (pick any artists) |
| `/admin.html` | `admin.html` | `js/adminCode.js` (scheduling, grid uploads, leaderboard screening) |

All of these share one stylesheet, `css/mg.css`, and the self-hosted Archivo font in `fonts/` (SIL Open Font License, see `fonts/ARCHIVO-OFL.txt`).

Older pages (`old.html`, `v2.html`, `grid-builder/interactTest.html`) still use their original CSS and scripts.

## How the game talks to the API

`js/grid-game.js` picks its endpoints from `<body data-mode="...">`:

| | Daily | Custom |
| --- | --- | --- |
| Grid id | `GET /latest-grid` | `custom_grid_id` URL param |
| Grid data | `POST /grid-data` | `POST /custom-grid-data` |
| Check a guess | `POST /check-answer` | `POST /check-custom-answer` |
| Easy-mode hint | `POST /get-cheat-preview-url` | `POST /get-custom-cheat-preview-url` |
| Leaderboard id | grid id | `custom_grid_id + 100` (string concatenation, kept for existing leaderboards) |

Search (`POST /search`), scores (`POST /scores`) and score submission (`POST /submit-score`) are shared.

Game progress is saved in `localStorage` under `musicgrid:<mode>:<gridId>`, so a refresh doesn't lose a game in progress. Each saved game also records its grid's date, title and the day it was finished (`playedOn`). The stats page reads every saved game back, so stats are per browser. A daily grid counts toward a streak when it was finished before the next daily grid went live, so days with no new grid don't break a streak.

## Daily rotation, clips and difficulty (server)

- **Rotation.** A day with no grid scheduled replays an older daily grid instead of repeating yesterday's. The first visit after midnight Central copies the grid that played longest ago (preferring ones not played in 30 days) under a new grid id, so it gets its own leaderboard. The copy remembers its original in `musicgrid_templates.rerun_of`, and the game shows "Rerun of the Oct 3 grid". Turn it off with the Heroku config var `ROTATE_DAILY=off`; change the 30 days with `RERUN_MIN_GAP_DAYS`.
- **Song clips.** Spotify stopped returning 30-second previews to development-mode apps, so easy-mode hints now come from the iTunes Search API, with Deezer as a backup. Clips found on iTunes are saved onto the answer. `POST /artist-clips` checks whether artists have clips at all (results kept in the `artist_clips` table). Daily uploads skip artists without clips, rotation skips grids that have one, and the grid builder has an "Only artists with song clips" toggle.
- **Difficulty.** Browse cards show Easy, Medium, Hard or Expert. It blends players' median best score with an estimate from how many songs each square accepts. The more players, the more their scores count.
- **Uploading onto a taken day.** A new grid for a future day that already has one moves the old grid to the next open day.

## Local development

Any static server works, but GitHub Pages resolves extensionless URLs (`/play-custom-grid`) to `.html` files, so use one that does the same, or open the `.html` paths directly.

```
npx eslint .
```
