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
| `/admin.html` | `admin.html` | `js/adminCode.js` (password-locked: flagged answers, daily grid maker, uploads, answers and clips, leaderboard screening) |

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

## Categories

The server knows three kinds of category (`GET /categories` lists them):

- **Spotify** (always right): debut, latest, title track, opening and closing tracks, singles, features, explicit, self-titled, soundtrack, over 5 minutes, under 2:30, one-word and long titles, titles with a number, question, color, love, body part, time of day, weather or holiday, and release decade. Worked out from each artist's albums and singles.
- **AI** (facts the AI checks): top 10 and #1 on the Hot 100, Grammy-nominated, heard in a movie or TV show, covers, real places, people's names, went viral on TikTok.
- **Opinion** (judgment calls): breakup, love, party, sad, road trip, confidence, nostalgic and revenge songs.

For AI and opinion categories the AI only sorts the artist's real Spotify songs, so it can't invent titles. `POST /artist-categories` returns every category with at least 2 songs for one artist. The grid builder checks every category for every artist live, then the player picks 3 artists and 3 categories that work. Admins do the same in the daily grid maker. AI and opinion categories are saved as `CategoryKind` template rows and show an "AI" or "Opinion" tag on the grid.

## Flags, editing and admin

- **Flags.** After a wrong guess a player can tap "I think it fits". Flags go in the `answer_complaints` table (one per player per song per square). Once a grid is finished, players see the most-flagged songs and whether each was approved or rejected.
- **Review.** Flagged songs wait in the admin page's "Flagged answers" queue. Approving adds the song as an answer and re-scores that square (a daily grid's reruns too).
- **Creator editing.** Building a grid returns an edit token, saved in the creator's browser (`musicgrid:edit:<id>`; only a hash is stored, in `custom_grid_editors`). The creator sees "Edit answers" on their grid and can add or remove songs; saving re-scores those squares.
- **Admin lock.** Admin endpoints need the Heroku config var `ADMIN_KEY`, sent as `x-admin-key`. The admin page asks for it and remembers it in that browser until "Lock admin page".

## Players and leaderboards

- **Player code.** Each browser gets a random id (`localStorage` `musicgrid:player`) that's sent with scores and flags. Leaderboards group by it, never by name, and never show it. Scores from before ids existed are grouped by name.
- **More than one device.** The Stats page shows "Your player code". Its link (`/stats#code=…`) or the pasted code moves that browser onto the other device's id (`POST /link-player`), merging its scores and flags. The All-time card's "?" explains this.

## Slow requests

Heroku drops any request that takes 30 seconds. Checking an artist's categories, saving a built grid, saving answer edits, the admin answers-and-clips check and the clip check answer `202 { pending: true }` after 20 seconds (`SLOW_REPLY_MS`) and keep working. Sending the same request again joins the work and gets the result. Saving a built grid takes a `request_id`, so a retry returns the same grid instead of a copy. The builder also retries dropped connections, so the page has to stay open only until the checks finish. Daily grid uploads reply "scored: pending" and finish scoring in the background.

## Spotify sign-in

Since February 2026 a Development Mode Spotify app only works for a few accounts added by hand in the Spotify Developer Dashboard ([Spotify's announcement](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)). The builder says so, links Spotify's developer forum thread, and the Connect Spotify page has a request form (`POST /spotify-access-request`, table `spotify_access_requests`). Requests show on the admin page under "Spotify sign-in requests".

## Local development

Any static server works, but GitHub Pages resolves extensionless URLs (`/play-custom-grid`) to `.html` files, so use one that does the same, or open the `.html` paths directly.

```
npx eslint .
```
