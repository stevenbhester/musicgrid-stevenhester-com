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
| `/grid-builder/apple-music` | `grid-builder/apple-music.html` | `js/gb-appleMusic.js` (artists from Apple Music) |
| `/admin.html` | `admin.html` | `js/adminCode.js` (password-locked: flagged answers, daily grid maker, uploads, answers and clips, leaderboard screening) |

Icons: `img/logo.svg` is the logo (gold tile, blue beamed notes with square heads for the grid). `/favicon.ico` (16, 32, 48), `img/favicon.png` (64), `img/logo-96.png`, `img/apple-touch-icon.png` (180, full-bleed) and `img/og-card.png` (the link preview) are made from it. Pages link the icons with `?v=2` so browsers drop the old cached ones; bump it when the logo changes.

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

On phones (under 600px) the header is compact so the whole board fits on the first screen, and once a browser has played a grid (`returning` on `<body>`) the intro sentence is hidden, leaving the no-repeats line. The share text shades each square by points (🟩 🟨 🟧, 🟥 missed, ⬛ untried); a square solved in easy mode is a circle of the same color (🟢 🟡 🟠). The results panel and the Stats history draw their little grids the same way (`.mini i.ez` is round).

Game progress is saved in `localStorage` under `musicgrid:<mode>:<gridId>`, so a refresh doesn't lose a game in progress. Each saved game also records its grid's date, title and the day it was finished (`playedOn`). The stats page reads every saved game back, so stats are per browser. A daily grid counts toward a streak when it was finished before the next daily grid went live, so days with no new grid don't break a streak.

## Daily rotation, clips and difficulty (server)

- **Rotation.** A day with no grid scheduled replays an older daily grid instead of repeating yesterday's. The first visit after midnight Central copies the grid that played longest ago (preferring ones not played in 30 days) under a new grid id, so it gets its own leaderboard. The copy remembers its original in `musicgrid_templates.rerun_of`, and the game shows "Rerun of the Oct 3 grid". Turn it off with the Heroku config var `ROTATE_DAILY=off`; change the 30 days with `RERUN_MIN_GAP_DAYS`.
- **Song clips.** Spotify stopped returning 30-second previews to development-mode apps, so easy-mode hints now come from the iTunes Search API, with Deezer as a backup. Clips found on iTunes are saved onto the answer. `POST /artist-clips` checks whether artists have clips at all (results kept in the `artist_clips` table). Daily uploads skip artists without clips, rotation skips grids that have one, and the grid builder has an "Only artists with song clips" toggle.
- **Difficulty.** Browse cards show Easy, Medium, Hard or Expert. It blends players' median best score with an estimate from how many songs each square accepts. The more players, the more their scores count.
- **Uploading onto a taken day.** A new grid for a future day that already has one moves the old grid to the next open day.
- **Uploading for a past day.** A grid dated in the past goes into the archive. A past day that already has a grid someone made keeps it, and the new grid takes the nearest earlier day that's free; only a rerun copy gives way. The reply lists any grid that landed on a different day (`shifted`). `/grids/daily` lists the day's other grids under `also`, so a player who finished a replaced rerun keeps their streak.

## Categories

The server knows three kinds of category (`GET /categories` lists them):

- **Spotify** (always right): debut, latest, title track, opening and closing tracks, singles, features, explicit, self-titled, soundtrack, over 5 minutes, under 2:30, one-word and long titles, titles with a number, question, color, love, body part, time of day, weather or holiday, and release decade. Worked out from each artist's albums and singles.
- **AI** (facts the AI checks): top 10 and #1 on the Hot 100, Grammy-nominated, heard in a movie or TV show, covers, real places, people's names, went viral on TikTok.
- **Opinion** (judgment calls): breakup, love, party, sad, road trip, confidence, nostalgic and revenge songs.

For AI and opinion categories the AI only sorts the artist's real Spotify songs, so it can't invent titles. `POST /artist-categories` returns every category with at least 2 songs for one artist. The grid builder checks every category for every artist live, then the player picks 3 artists and 3 categories that work. Admins do the same in the daily grid maker. AI and opinion categories are saved as `CategoryKind` template rows and show an "AI" or "Opinion" tag on the grid.

## Flags, editing and admin

- **Flags.** After a wrong guess a player can tap "I think it fits". Flags go in the `answer_complaints` table (one per player per song per square). Once a grid is finished, a "Songs players flagged" card under the results shows the most-flagged songs and whether each was approved or rejected.
- **Review.** Flagged songs wait in the admin page's "Flagged answers" queue. Approving adds the song as an answer and re-scores that square (a daily grid's reruns too).
- **Creator editing.** Building a grid returns an edit token, saved in the creator's browser (`musicgrid:edit:<id>`; only a hash is stored, in `custom_grid_editors`). The creator sees "Edit answers" on their grid and can add or remove songs; saving re-scores those squares.
- **Admin lock.** Admin endpoints need the Heroku config var `ADMIN_KEY`, sent as `x-admin-key`. The admin page asks for it and remembers it in that browser until "Lock admin page".

## One song, one square

Each song counts in one square per grid. In the game, a song already used in a solved square shows as "Used in another square" in search. A same-titled song counts as the same song in the same artist's column, and across columns only when the track credits both artists (a collab). Hints skip songs used elsewhere (`exclude` on the hint endpoints).

Every grid must be fillable with 9 different songs (a matching from squares to songs, `repeatProblems` on the server, mirrored in the builder and admin page). The builder greys out categories that would break it, `POST /custom-grids` and `/admin/create-grids` refuse grids that would, the upload preview stops them, the answers tool flags existing ones, and reruns skip them.

## Song titles

`cleanSongName` finds the title players know before any title check (word counts, numbers, colors, questions): everything after a spaced dash goes ("- Live at Fenway", "- 2011 Remaster"), as do trailing "feat." credits and bracketed version notes like "(Ceelo Version)" or "[Live]". Bracketed words that are part of the title ("(To Party)", "(I Can't Get No)") stay. When an artist has several versions of a song, the cleanest name is used.

## Players and leaderboards

- **Player code.** Each browser gets a random id (`localStorage` `musicgrid:player`) that's sent with scores and flags. Leaderboards group by it, never by name, and never show it. Scores from before ids existed are grouped by name.
- **More than one device.** The Stats page shows "Your player code". Its link (`/stats#code=…`) or the pasted code moves that browser onto the other device's id (`POST /link-player`), merging its scores, flags and stats. The All-time card's "?" explains this.
- **Your own code.** Players can type a code they made up (8+ characters, like a password) instead of copying one. Capitals and extra spaces don't matter. The browser hashes it (SHA-256 of `musicgrid:` + the code, kept as `p-` + 40 hex characters) and links to that id the same way, so typing the same code on every device makes them one player. The server never sees the code itself; the browser keeps it in `musicgrid:playerPhrase` so "Show code" can show it.
- **All-time board.** It opens with the top 25 (`all_time_limit` on `/leaderboards`). Scrolling to the bottom of the list, or "Show more", loads 50 more (`POST /leaderboards/all-time` with `offset` and `limit`). Your own row stays pinned at the bottom until the list reaches it. It shows no player count.
- **Quiet days.** A grid's board only shows its player count from 25 players. When today's daily board has fewer than 5 players, it waits until you finish before showing, and a "Recent top scores" list (each player's best score on the daily grids of the last 30 days, `recent: true` on `/leaderboards`, `RECENT_BOARD_DAYS` to change) sits under it. All-time rows no longer show how many grids each player has played. Every name and score shown is real.
- **Stats follow the code.** Finished games are saved under the player code (`POST /player-games/sync`, table `player_games`). The Stats page merges them with this browser's games; when a grid was finished on more than one device, the higher score counts.
- **Name reviews.** When screening changes a leaderboard name, the player can ask for a review (`POST /name-appeal`). The admin page's "Name appeals" (and the renamed-names list) can restore a name, which gives every score that used it the name back and allow-lists it (`name_allowlist`), or keep the change. Players see the verdict on the grid.

## Slow requests

Heroku drops any request that takes 30 seconds. Checking an artist's categories, saving a built grid, saving answer edits, the admin answers-and-clips check and the clip check answer `202 { pending: true }` after 20 seconds (`SLOW_REPLY_MS`) and keep working. Sending the same request again joins the work and gets the result. Saving a built grid takes a `request_id`, so a retry returns the same grid instead of a copy. The builder also retries dropped connections, so the page has to stay open only until the checks finish. Daily grid uploads reply "scored: pending" and finish scoring in the background.

## AI (Claude)

Claude is the only AI the server uses. Grid titles, AI and opinion categories, leaderboard name screening and the wedding Q&A (`/fetch-ai-weddingresponse`) all need the Heroku config var `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL` overrides the default, `claude-haiku-5-5`). Without it, titles fall back to the artist names, AI and opinion categories are skipped, and names only go through the word list. The wedding Q&A takes its instructions from `WEDDING_ASSISTANT_PROMPT` and keeps each conversation in memory for `WEDDING_THREAD_HOURS` (default 6).

## Apple Music sign-in

`/grid-builder/apple-music` signs in with MusicKit on the Web, ranks artists from heavy rotation, recently played music and library artists, matches them to Spotify artists, and fills the "Pick any artists" list. The server mints the MusicKit developer token (`GET /apple-music/token`) from `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the .p8 file); `APPLE_TOKEN_ORIGINS` limits where it works (default: the site). The build page only shows the option when `GET /apple-music/status` says it's set up.

## Spotify sign-in

Since February 2026 a Development Mode Spotify app only works for a few accounts added by hand in the Spotify Developer Dashboard ([Spotify's announcement](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)). The builder says so, links Spotify's developer forum thread, and the Connect Spotify page has a request form (`POST /spotify-access-request`, table `spotify_access_requests`). Requests show on the admin page under "Spotify sign-in requests".

## Local development

Any static server works, but GitHub Pages resolves extensionless URLs (`/play-custom-grid`) to `.html` files, so use one that does the same, or open the `.html` paths directly.

```
npx eslint .
```
