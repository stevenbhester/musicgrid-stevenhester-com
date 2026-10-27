/**
 * Grid builder from Apple Music. MusicKit on the Web signs the player in,
 * then we read their heavy rotation, recently played music and library
 * artists, rank the artists, match them to Spotify artists (the song data
 * comes from Spotify) and hand them to the pick-artists page.
 * https://developer.apple.com/documentation/musickitjs
 */

const API = "https://music-grid-io-42616e204fd3.herokuapp.com";
const APPLE_API = "https://api.music.apple.com";
const MUSICKIT_SRC = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
const IMPORT_KEY = "musicgrid:importedArtists";
const WANTED = 10;

const $ = id => document.getElementById(id);
let developerToken = null;
let music = null;

function setStatus(text) {
  $("appleStatus").textContent = text;
}

function showNotice(text) {
  const notice = $("appleNotice");
  notice.textContent = text;
  notice.hidden = !text;
}

function loadMusicKit() {
  return new Promise((resolve, reject) => {
    if (window.MusicKit) {
      resolve(window.MusicKit);
      return;
    }
    const timer = setTimeout(() => reject(new Error("MusicKit took too long to load")), 20000);
    document.addEventListener("musickitloaded", () => {
      clearTimeout(timer);
      resolve(window.MusicKit);
    }, { once: true });
    const script = document.createElement("script");
    script.src = MUSICKIT_SRC;
    script.async = true;
    script.setAttribute("data-web-components", "");
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("MusicKit didn't load"));
    };
    document.head.appendChild(script);
  });
}

async function prepare() {
  const button = $("appleConnect");
  try {
    const response = await fetch(API + "/apple-music/token");
    if (response.status === 503) {
      showNotice("Apple Music sign-in isn't switched on yet. You can pick artists by hand for now.");
      button.textContent = "Not available yet";
      return;
    }
    if (!response.ok) throw new Error("apple-music/token returned " + response.status);
    developerToken = (await response.json()).token;
    const MusicKit = await loadMusicKit();
    await MusicKit.configure({ developerToken, app: { name: "MusicGrid", build: "2026.10" } });
    music = MusicKit.getInstance();
    button.textContent = "Connect Apple Music";
    button.disabled = false;
  } catch (error) {
    console.error("Apple Music setup failed:", error);
    showNotice("Apple Music isn't responding right now. Reload to try again, or pick artists by hand.");
    button.textContent = "Not available right now";
  }
}

async function appleGet(path, userToken) {
  const response = await fetch(APPLE_API + path, {
    headers: { "Authorization": "Bearer " + developerToken, "Music-User-Token": userToken }
  });
  if (!response.ok) throw new Error(path + " returned " + response.status);
  return response.json();
}

// Heavy rotation counts most, then recent plays, then library artists
// (alphabetical, so they only fill gaps)
async function rankedArtists(userToken) {
  const scores = new Map();
  let seen = 0;
  const add = (name, points) => {
    const clean = String(name || "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    const entry = scores.get(key) || { name: clean, score: 0, first: seen++ };
    entry.score += points;
    scores.set(key, entry);
  };
  const read = path => appleGet(path, userToken).catch(() => ({ data: [] }));
  const [heavy, recent, tracks1, tracks2, tracks3, library] = await Promise.all([
    read("/v1/me/history/heavy-rotation?limit=10"),
    read("/v1/me/recent/played?limit=10"),
    read("/v1/me/recent/played/tracks?limit=10"),
    read("/v1/me/recent/played/tracks?limit=10&offset=10"),
    read("/v1/me/recent/played/tracks?limit=10&offset=20"),
    read("/v1/me/library/artists?limit=100")
  ]);
  const attrs = item => (item && item.attributes) || {};
  (heavy.data || []).forEach(item => add(attrs(item).artistName, 5));
  (recent.data || []).forEach(item => add(attrs(item).artistName, 3));
  [tracks1, tracks2, tracks3].forEach(page => (page.data || []).forEach(item => add(attrs(item).artistName, 3)));
  const listened = scores.size;
  (library.data || []).forEach(item => add(attrs(item).name, 1));
  const names = [...scores.values()].sort((a, b) => b.score - a.score || a.first - b.first).map(entry => entry.name);
  return { names, listened };
}

function sameName(a, b) {
  const norm = text => String(text).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  return norm(a) === norm(b);
}

// Find the same artist on Spotify. Credits like "A & B" or "A feat. B" fall
// back to the first name. No exact match means we skip the artist rather
// than guess.
async function spotifyArtist(name) {
  const tries = [name];
  const lead = name.split(/\s+(?:&|feat\.?|ft\.?|with|x)\s+|,\s*/i)[0].trim();
  if (lead && lead !== name) tries.push(lead);
  for (const query of tries) {
    try {
      const response = await fetch(API + "/search-artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) continue;
      const artists = await response.json();
      const match = artists.find(artist => sameName(artist.name, query));
      if (match) return { id: match.id, name: match.name, img: match.img || "" };
    } catch (error) {
      // Try the next spelling
    }
  }
  return null;
}

async function matchArtists(names) {
  const found = [];
  const ids = new Set();
  for (let i = 0; i < names.length && i < 25 && found.length < WANTED; i += 5) {
    setStatus(`Matching your artists… ${found.length} so far`);
    const batch = await Promise.all(names.slice(i, i + 5).map(spotifyArtist));
    batch.forEach(artist => {
      if (artist && !ids.has(artist.id) && found.length < WANTED) {
        ids.add(artist.id);
        found.push(artist);
      }
    });
  }
  return found;
}

async function connect() {
  const button = $("appleConnect");
  if (!music) return;
  button.disabled = true;
  showNotice("");
  let userToken;
  try {
    userToken = await music.authorize();
  } catch (error) {
    button.disabled = false;
    showNotice("Apple Music sign-in didn't finish. Try again whenever you're ready.");
    return;
  }
  if (!userToken) {
    button.disabled = false;
    showNotice("Apple Music didn't allow access. Try again, or pick artists by hand.");
    return;
  }
  button.textContent = "Reading your music…";
  setStatus("Looking at your heavy rotation and recent plays…");
  const { names, listened } = await rankedArtists(userToken);
  if (!names.length) {
    button.textContent = "Connect Apple Music";
    button.disabled = false;
    setStatus("");
    showNotice("We couldn't find any listening history or library artists on this account. Pick artists by hand instead.");
    return;
  }
  const artists = await matchArtists(names);
  if (!artists.length) {
    button.textContent = "Connect Apple Music";
    button.disabled = false;
    setStatus("");
    showNotice("We couldn't match your Apple Music artists to the song data we use. Pick artists by hand instead.");
    return;
  }
  // Fewer than 3 is fine: the picker asks for the rest
  handOff(artists, listened);
}

function handOff(artists, listened) {
  try {
    sessionStorage.setItem(IMPORT_KEY, JSON.stringify({ source: listened ? "Apple Music" : "Apple Music library", artists }));
  } catch (error) {
    // Private mode: the pick page just starts empty
  }
  setStatus(`Found ${artists.length} artists. Opening the picker…`);
  window.location.href = "/grid-builder/manual-artist-pick?from=apple-music";
}

$("appleConnect").addEventListener("click", connect);
prepare();
