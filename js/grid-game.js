// MusicGrid game engine.
// Shared by the daily grid (index.html, data-mode="daily") and custom grids
// (play-custom-grid.html, data-mode="custom"). Every request below sends the
// same payload the original client sent, so the Heroku API needs no changes.

const API = "https://music-grid-io-42616e204fd3.herokuapp.com";
const SITE = "https://musicgrid.stevenhester.com";
const HEARTS = 3; // three hearts, then one sudden-death miss
const MAX_MISSES = HEARTS + 1;
const MIN_SEARCH = 3;
const EASY_PENALTY = 3; // points off each square solved with easy mode on
const SEARCH_DELAY = 220;

const mode = document.body.dataset.mode === "custom" ? "custom" : "daily";
const params = new URLSearchParams(window.location.search);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- API ----------

async function request(path, body, signal) {
  const options = body === undefined
    ? { signal }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal };
  const started = Date.now();
  for (;;) {
    const response = await fetch(API + path, options);
    // 202: slow work (like re-scoring) is still running; asking again picks it up
    if (response.status === 202 && Date.now() - started < 3 * 60000) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    if (!response.ok || response.status === 202) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }
}

const modes = {
  daily: {
    resolveId: async () => {
      const requested = params.get("grid");
      if (requested) {
        try {
          const data = await request(`/latest-grid?grid_id=${encodeURIComponent(requested)}`);
          game.day = data.reportingDay || null;
          game.rerunOf = data.rerunOf || null;
          game.past = Boolean(game.day && game.day < chicagoToday());
          return data.latestGridId;
        } catch (error) {
          game.notice = "That grid isn't available, so here's today's.";
        }
      }
      const data = await request("/latest-grid");
      game.day = data.reportingDay || null;
      game.rerunOf = data.rerunOf || null;
      game.past = false;
      return data.latestGridId;
    },
    loadGrid: id => request("/grid-data", { grid_id: id }),
    check: (id, song, field) => request("/check-answer", { songGuess: song, fieldGuessed: field, gridId: id }),
    hint: (id, field, fresh) => request("/get-cheat-preview-url", { gridId: id, fieldKey: field, fresh: Boolean(fresh) }),
    leaderboardId: id => id,
    shareUrl: id => (game.past ? `${SITE}/?grid=${encodeURIComponent(id)}` : SITE + "/"),
    fallbackTitle: () => (game.past ? "Daily grid" : "Today's grid"),
    board: "daily",
    boardTitle: "Today"
  },
  custom: {
    resolveId: () => Promise.resolve(params.get("custom_grid_id") || 1),
    loadGrid: id => request("/custom-grid-data", { custom_grid_id: id }),
    check: (id, song, field) => request("/check-custom-answer", { songGuess: song, fieldGuessed: field, customGridId: id }),
    hint: (id, field, fresh) => request("/get-custom-cheat-preview-url", { customGridId: id, fieldKey: field, fresh: Boolean(fresh) }),
    // Kept identical to the original client. The id from the URL is a string,
    // so this concatenates ("12" + 100 -> "12100"), and existing custom-grid
    // leaderboards are stored under those ids.
    leaderboardId: id => id + 100,
    shareUrl: id => `${SITE}/play-custom-grid?custom_grid_id=${encodeURIComponent(id)}`,
    fallbackTitle: () => "Custom grid",
    board: "custom",
    boardTitle: "This grid"
  }
};
const api = modes[mode];

// ---------- Small helpers ----------

const $ = selector => document.querySelector(selector);

function chicagoToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    });
  }
  (children || []).forEach(child => {
    if (child !== null && child !== undefined) node.append(child);
  });
  return node;
}

const ICONS = {
  plus: "<path d=\"M12 5v14M5 12h14\"/>",
  search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>",
  close: "<path d=\"M6 6l12 12M18 6 6 18\"/>",
  play: "<path d=\"M8 5.5v13l10-6.5z\" fill=\"currentColor\" stroke=\"none\"/>",
  pause: "<path d=\"M8 5h3v14H8zM13 5h3v14h-3z\" fill=\"currentColor\" stroke=\"none\"/>",
  share: "<path d=\"M12 3v12M7 8l5-5 5 5\"/><path d=\"M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6\"/>",
  note: "<path d=\"M9 18V5l11-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"17\" cy=\"16\" r=\"3\"/>",
  heart: "<path d=\"M12 20.5s-7.5-4.6-9.3-9.6C1.5 7.4 3.7 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.5 0 5.7 3.4 4.5 6.9-1.8 5-9.3 9.6-9.3 9.6z\" fill=\"currentColor\" stroke=\"none\"/>",
  heartOff: "<path d=\"M12 20.5s-7.5-4.6-9.3-9.6C1.5 7.4 3.7 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.5 0 5.7 3.4 4.5 6.9-1.8 5-9.3 9.6-9.3 9.6z\"/>"
};

function icon(name, cls) {
  return `<svg class="${cls || "icon"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

let toastTimer = null;
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
}

function announce(message) {
  const node = $("#announcer");
  node.textContent = "";
  window.setTimeout(() => { node.textContent = message; }, 30);
}

function replay(node, cls) {
  if (reduceMotion || !node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  node.addEventListener("animationend", () => node.classList.remove(cls), { once: true });
}

const storage = {
  get(key) {
    try { return JSON.parse(window.localStorage.getItem(key)); } catch (e) { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }
};

// Anonymous per-device id. All-time totals follow this instead of the typed
// name, so two people called "Sam" don't share a score. Never shown.
function playerId() {
  let id = storage.get("musicgrid:player");
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    storage.set("musicgrid:player", id);
  }
  return id;
}

// ---------- Game state ----------

const game = {
  id: null,
  day: null,
  rerunOf: null,
  past: false,
  notice: null,
  title: "",
  artists: [],
  categories: [],
  state: null
};
const pending = new Set();
const searchCache = new Map();
const hintCache = new Map();
let saveKey = "";

function cellKey(category, artist) {
  return `${category.key} ${artist.key}`;
}

function freshState() {
  const cells = {};
  game.categories.forEach(category => {
    game.artists.forEach(artist => {
      cells[cellKey(category, artist)] = { status: "open", song: null, points: 0, misses: [] };
    });
  });
  return { cells, score: 1, livesLost: 0, over: false, endReason: null, easy: false, submitted: false, name: null };
}

function restoreState() {
  const saved = storage.get(saveKey);
  const fresh = freshState();
  if (!saved || !saved.cells) return fresh;
  const keysMatch = Object.keys(fresh.cells).every(key => saved.cells[key]);
  return keysMatch ? Object.assign(fresh, saved) : fresh;
}

function save() {
  storage.set(saveKey, game.state);
}

function solvedCount() {
  return Object.values(game.state.cells).filter(cell => cell.status === "solved").length;
}

function totalCells() {
  return Object.keys(game.state.cells).length;
}

// Mirrors the original parsing: fields are keyed by name, in server order.
function parseGrid(data) {
  const categories = {};
  const artists = {};
  const kinds = {};
  let title = null;
  data.forEach(item => {
    if (item.field_type === "CategoryKind") {
      kinds[item.field] = item.field_value;
    } else if (item.field_type === "Category") {
      categories[item.field] = item.field_value;
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
    } else if (item.field_type === "Title") {
      title = item.field_value;
    }
    if (item.grid_title) title = item.grid_title;
  });
  game.categories = Object.keys(categories).map(key => ({ key, name: categories[key], kind: kinds[key] || "spotify" }));
  game.artists = Object.keys(artists).map(key => ({ key, name: artists[key] }));
  game.title = title || api.fallbackTitle(game.id);
}

// ---------- Rendering: header + HUD ----------

function renderHead() {
  $("#gridTitle").textContent = game.title;
  if (mode === "daily" && game.past) {
    $("#lbTitle").textContent = "This grid";
    const nav = document.querySelector(".topnav a[href='/']");
    if (nav) nav.removeAttribute("aria-current");
  }
  const dateLine = $("#gridDate");
  if (dateLine && game.day) {
    const date = new Date(`${game.day}T12:00:00`);
    let line = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (game.rerunOf) {
      const first = new Date(`${game.rerunOf}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      line += ` · Rerun of the ${first} grid`;
    }
    dateLine.textContent = line;
    dateLine.hidden = false;
  }
  document.title = `${game.title} | MusicGrid`;
  const judged = game.categories.filter(category => category.kind === "ai" || category.kind === "opinion");
  const note = $("#gridNote");
  if (note && judged.length) {
    note.textContent = "Categories marked AI or Opinion had their answers picked by AI. If a song you know fits gets rejected, flag it.";
    note.hidden = false;
  }
  const editButton = $("#editAnswers");
  if (editButton && editToken()) editButton.hidden = false;
}

let shownScore = 1;
function renderScore(animate) {
  const node = $("#score");
  const target = game.state.score;
  $("#scoreLabel").textContent = target === 1 ? "point" : "points";
  if (!animate || reduceMotion || target === shownScore) {
    node.textContent = target;
    shownScore = target;
    return;
  }
  const from = shownScore;
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / 450);
    node.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
  shownScore = target;
  replay(node, "bump");
}

function renderLives(popIndex) {
  const wrap = $("#lives");
  wrap.innerHTML = "";
  const lost = Math.min(game.state.livesLost, HEARTS);
  for (let i = 0; i < HEARTS; i += 1) {
    const isLost = i >= HEARTS - lost;
    const heart = el("span", { class: "life" + (isLost ? " lost" : ""), html: icon(isLost ? "heartOff" : "heart", "") });
    wrap.append(heart);
    if (popIndex === i) replay(heart, "pop");
  }
  $("#sudden").hidden = !(game.state.livesLost === HEARTS && !game.state.over);
  const left = Math.max(0, HEARTS - game.state.livesLost);
  wrap.setAttribute("aria-label", game.state.livesLost >= HEARTS ? "No hearts left. Next miss ends the game." : `${left} of ${HEARTS} hearts left`);
}

function renderHud(animateScore, popIndex) {
  renderScore(animateScore);
  renderLives(popIndex);
  renderEasyToggle();
  $("#giveUp").hidden = game.state.over;
}

// Easy mode costs points, so it asks first and then stays on for the grid
// (otherwise you could play a hint, switch it off and answer for full points)
function renderEasyToggle() {
  const box = $("#easyMode");
  box.checked = game.state.easy;
  box.disabled = game.state.over || game.state.easy;
  const note = $("#easyNote");
  if (note) {
    note.textContent = game.state.easy
      ? `On for the rest of this grid. Squares score ${EASY_PENALTY} fewer points.`
      : `Song hints and relaxed search rules, for ${EASY_PENALTY} fewer points a square`;
  }
}

function askForEasyMode() {
  const dialog = $("#easyConfirm");
  if (dialog && dialog.showModal) {
    dialog.showModal();
    $("#easyYes").focus();
  } else if (window.confirm(`Easy mode gives you song hints and relaxed search rules, but every square you solve from now on scores ${EASY_PENALTY} fewer points. Turn it on?`)) {
    turnOnEasyMode();
  }
}

function turnOnEasyMode() {
  if (!game.state || game.state.over || game.state.easy) return;
  game.state.easy = true;
  save();
  renderEasyToggle();
  toast(`Easy mode on. Squares now score ${EASY_PENALTY} fewer points.`);
}

// ---------- Rendering: board ----------

function lightHeads(r, c) {
  document.querySelectorAll(".head.lit").forEach(node => node.classList.remove("lit"));
  if (r === undefined) return;
  const row = document.querySelector(`.head-cat[data-r="${r}"]`);
  const col = document.querySelector(`.head-artist[data-c="${c}"]`);
  if (row) row.classList.add("lit");
  if (col) col.classList.add("lit");
}

function buildBoard() {
  const board = $("#board");
  board.innerHTML = "";
  board.className = "board";
  board.removeAttribute("aria-busy");
  board.append(el("div", { class: "head head-corner", "aria-hidden": "true" }));
  game.artists.forEach((artist, c) => {
    board.append(el("div", { class: "head head-artist", "data-c": c, text: artist.name }));
  });
  game.categories.forEach((category, r) => {
    const head = el("div", { class: "head head-cat", "data-r": r }, [el("span", { text: category.name })]);
    if (category.kind === "ai" || category.kind === "opinion") {
      head.classList.add("has-kind");
      head.append(el("span", {
        class: "kind-tag",
        text: category.kind === "ai" ? "AI" : "Opinion",
        title: category.kind === "ai" ? "AI decided which songs count" : "A judgment call: AI picked the songs"
      }));
    }
    board.append(head);
    game.artists.forEach((artist, c) => {
      const holder = el("div", { class: "slot", "data-key": cellKey(category, artist), "data-r": r, "data-c": c });
      board.append(holder);
      renderCell(cellKey(category, artist));
    });
  });
}

function cellLabel(key) {
  const [catKey, artistKey] = key.split(" ");
  const artist = game.artists.find(a => a.key === artistKey);
  const category = game.categories.find(cat => cat.key === catKey);
  return { artist: artist ? artist.name : "", category: category ? category.name : "" };
}

function renderCell(key, effect) {
  const holder = document.querySelector(`.slot[data-key="${CSS.escape(key)}"]`);
  if (!holder) return;
  const cell = game.state.cells[key];
  const label = cellLabel(key);
  const where = `${label.artist}, ${label.category}`;
  let node;

  if (pending.has(key)) {
    node = el("div", { class: "cell", "data-state": "pending", role: "img", "aria-label": `${where}: checking your guess` }, [
      el("span", { class: "spinner" })
    ]);
  } else if (cell.status === "solved") {
    node = el("div", { class: "cell", "data-state": "solved", role: "img", "aria-label": `${where}: ${cell.song}, ${cell.points} points${cell.easy ? " in easy mode" : ""}` }, [
      el("span", { class: "cell-song", text: cell.song }),
      el("span", { class: "cell-points", text: cell.easy ? `+${cell.points} easy` : `+${cell.points}` })
    ]);
  } else if (cell.status === "missed") {
    node = el("div", { class: "cell", "data-state": "missed" }, [
      el("span", { class: "cell-missed", text: "Missed" }),
      el("button", {
        class: "cell-listen", type: "button", "data-listen": key,
        "aria-label": `Hear a song that fits ${where}`,
        html: `${icon("play")}<span>Hear one</span>`
      })
    ]);
  } else {
    const misses = cell.misses.length
      ? el("span", { class: "cell-misses", "aria-hidden": "true" }, cell.misses.map(() => el("i")))
      : null;
    const missText = cell.misses.length ? `, ${cell.misses.length} wrong ${cell.misses.length === 1 ? "guess" : "guesses"}` : "";
    node = el("button", {
      class: "cell", type: "button", "data-state": "open", "data-open": key,
      "aria-label": `${where}${missText}. Guess a song`,
      disabled: game.state.over
    }, [misses, el("span", { html: icon("plus", "cell-plus") })]);
  }
  node.dataset.r = holder.dataset.r;
  node.dataset.c = holder.dataset.c;
  holder.replaceChildren(node);
  if (effect === "flip") replay(node, "flip");
  if (effect === "shake") {
    node.classList.add("flash-miss");
    replay(node, "shake");
    window.setTimeout(() => node.classList.remove("flash-miss"), 600);
  }
}

function renderBoardState(kind, detail) {
  const board = $("#board");
  if (kind === "loading") {
    board.className = "board skeleton";
    board.setAttribute("aria-busy", "true");
    board.innerHTML = "";
    for (let i = 0; i < 16; i += 1) {
      board.append(el("div", { class: i < 4 || i % 4 === 0 ? "head" : "cell" }));
    }
    return;
  }
  board.className = "board-state";
  board.removeAttribute("aria-busy");
  board.innerHTML = "";
  board.append(
    el("strong", { text: kind === "empty" ? "This grid is empty" : "The grid didn't load" }),
    el("span", { text: detail }),
    el("div", {}, [el("button", { class: "btn", type: "button", text: "Try again", onclick: () => boot() })])
  );
}

// ---------- Guess sheet ----------

const sheet = {
  key: null,
  seq: 0,
  timer: null,
  controller: null,
  results: []
};

function openSheet(key) {
  if (game.state.over || pending.has(key)) return;
  const cell = game.state.cells[key];
  if (cell.status !== "open") return;
  const label = cellLabel(key);
  sheet.key = key;
  sheet.results = [];
  $("#sheetArtist").textContent = label.artist;
  $("#sheetCategory").textContent = label.category;
  const input = $("#guessInput");
  input.value = "";
  $("#resultsList").innerHTML = "";
  setSheetMessage(`Search for a song by ${label.artist}.`);
  renderTried(cell);
  renderHintRow();
  const dialog = $("#guessSheet");
  if (!dialog.open) dialog.showModal();
  input.focus();
}

function closeSheet() {
  const dialog = $("#guessSheet");
  stopAudio();
  window.clearTimeout(sheet.timer);
  if (sheet.controller) sheet.controller.abort();
  if (dialog.open) dialog.close();
}

function setSheetMessage(text) {
  const node = $("#sheetMsg");
  node.textContent = text || "";
  node.hidden = !text;
}

function renderTried(cell) {
  const node = $("#tried");
  node.innerHTML = "";
  if (!cell.misses.length) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  node.append("Already tried: ");
  const flagged = cell.flags || [];
  cell.misses.forEach((song, i) => {
    if (i) node.append(", ");
    node.append(el("s", { text: song }));
    if (flagged.includes(song)) {
      node.append(el("span", { class: "flag-done", text: " (flagged)" }));
    } else {
      node.append(" ", el("button", {
        class: "flag-link", type: "button", text: "I think it fits",
        "aria-label": `Flag ${song}: I think it fits`,
        onclick: async event => {
          event.currentTarget.disabled = true;
          const data = await sendFlag(sheet.key, song);
          renderTried(cell);
          toast(data ? flagMessage(data) : "Couldn't send that. Try again in a moment.");
        }
      }));
    }
  });
}

function renderHintRow() {
  const row = $("#hintRow");
  row.hidden = !game.state.easy;
  setHintButton("idle");
  $("#hintNote").textContent = "Plays a preview of a song that fits this square.";
}

function onSearchInput() {
  window.clearTimeout(sheet.timer);
  const query = $("#guessInput").value.trim();
  if (query.length < MIN_SEARCH) {
    sheet.seq += 1;
    if (sheet.controller) sheet.controller.abort();
    $("#resultsList").innerHTML = "";
    sheet.results = [];
    setSheetMessage(query.length ? "Keep typing…" : `Search for a song by ${cellLabel(sheet.key).artist}.`);
    return;
  }
  sheet.timer = window.setTimeout(() => runSearch(query), SEARCH_DELAY);
}

async function runSearch(query) {
  const key = sheet.key;
  const artistName = cellLabel(key).artist;
  const easyModeBool = game.state.easy;
  const cacheKey = `${easyModeBool}|${artistName}|${query.toLowerCase()}`;
  const seq = ++sheet.seq;
  if (sheet.controller) sheet.controller.abort();

  let songs = searchCache.get(cacheKey);
  if (!songs) {
    if (!sheet.results.length) setSheetMessage("Searching…");
    sheet.controller = new AbortController();
    try {
      songs = await request("/search", { searchTerm: query, easyModeBool, artistName }, sheet.controller.signal);
      searchCache.set(cacheKey, songs);
    } catch (error) {
      if (error.name === "AbortError" || seq !== sheet.seq) return;
      setSheetMessage("Search isn't responding right now. Try again in a moment.");
      return;
    }
  }
  if (seq !== sheet.seq || key !== sheet.key) return;
  renderSearchResults(Array.isArray(songs) ? songs : [], query);
}

function artistNames(song) {
  return (song.artists || []).map(artist => artist.name).join(", ");
}

function albumArt(song) {
  const images = song.album && song.album.images;
  if (!images || !images.length) return null;
  return images[images.length - 1].url;
}

function renderSearchResults(songs, query) {
  const list = $("#resultsList");
  const cell = game.state.cells[sheet.key];
  list.innerHTML = "";
  sheet.results = songs;
  if (!songs.length) {
    setSheetMessage(`No songs found for “${query}”. Try another spelling.`);
    return;
  }
  setSheetMessage("");
  songs.forEach(song => {
    const tried = cell.misses.includes(song.name);
    const art = albumArt(song);
    const artNode = art
      ? el("img", { class: "art", src: art, alt: "", loading: "lazy", width: 44, height: 44 })
      : el("span", { class: "art art-blank", html: icon("note") });
    const button = el("button", {
      class: "result", type: "button", disabled: tried,
      onclick: () => chooseSong(song)
    }, [
      artNode,
      el("span", { class: "result-text" }, [el("b", { text: song.name }), el("span", { text: artistNames(song) })]),
      tried ? el("span", { class: "result-tag", text: "Already tried" }) : null
    ]);
    list.append(el("li", {}, [button]));
  });
}

function chooseSong(song) {
  const key = sheet.key;
  closeSheet();
  submitGuess(key, song.name);
}

function onSheetKeydown(event) {
  const buttons = [...document.querySelectorAll("#resultsList .result:not([disabled])")];
  const index = buttons.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
  } else if (event.key === "Enter" && document.activeElement === $("#guessInput")) {
    event.preventDefault();
    if (buttons[0]) buttons[0].click();
  } else if (event.key === "ArrowDown" && buttons.length) {
    event.preventDefault();
    buttons[Math.min(buttons.length - 1, index + 1)].focus();
  } else if (event.key === "ArrowUp" && buttons.length) {
    event.preventDefault();
    if (index <= 0) $("#guessInput").focus();
    else buttons[index - 1].focus();
  }
}

// ---------- Hints (song previews) ----------

const audio = new Audio();
audio.preload = "none";
let audioOwner = null;

function stopAudio() {
  audio.pause();
  audio.removeAttribute("src");
  if (audioOwner === "sheet") setHintButton("idle");
  if (audioOwner && audioOwner !== "sheet") updateListenButton(audioOwner, false);
  audioOwner = null;
}

audio.addEventListener("ended", stopAudio);

async function previewUrl(key, fresh) {
  if (!fresh && hintCache.has(key)) return hintCache.get(key);
  let data = null;
  try {
    data = await api.hint(game.id, key, fresh);
  } catch (error) {
    data = null; // 404: no clip for this square
  }
  const url = data && data.previewUrl ? data.previewUrl : null;
  hintCache.set(key, url);
  return url;
}

function noPreview(owner) {
  audioOwner = null;
  if (owner === "sheet") {
    setHintButton("idle");
    $("#hintNote").textContent = "No preview is available for this square.";
  } else {
    updateListenButton(owner, false);
    toast("No preview is available for this square.");
  }
}

async function playPreview(key, owner) {
  if (audioOwner === owner) {
    stopAudio();
    return;
  }
  stopAudio();
  audioOwner = owner;
  if (owner === "sheet") setHintButton("loading");
  else updateListenButton(owner, true);
  let url = null;
  try {
    url = await previewUrl(key);
  } catch (error) {
    url = null;
  }
  if (audioOwner !== owner) return;
  if (!url) {
    noPreview(owner);
    return;
  }
  const start = (src, retried) => {
    audio.src = src;
    audio.play().then(() => {
      if (owner === "sheet") setHintButton("playing");
    }).catch(async error => {
      if (audioOwner !== owner) return;
      if (error && error.name === "NotAllowedError") {
        stopAudio();
        toast("Your browser blocked the preview. Tap again to play it.");
        return;
      }
      // The saved clip is gone or won't play here: ask for a fresh one once
      const next = retried ? null : await previewUrl(key, true).catch(() => null);
      if (audioOwner !== owner) return;
      if (next && next !== src) start(next, true);
      else noPreview(owner);
    });
  };
  start(url, false);
}

function setHintButton(status) {
  const button = $("#hintBtn");
  if (status === "playing") button.innerHTML = `${icon("pause")}<span>Pause hint</span>`;
  else if (status === "loading") button.innerHTML = "<span class=\"spinner\" style=\"width:18px;height:18px;border-width:2px\"></span><span>Loading hint</span>";
  else button.innerHTML = `${icon("play")}<span>Play a hint</span>`;
}

function updateListenButton(key, playing) {
  const button = document.querySelector(`[data-listen="${CSS.escape(key)}"]`);
  if (!button) return;
  button.innerHTML = playing ? `${icon("pause")}<span>Stop</span>` : `${icon("play")}<span>Hear one</span>`;
}

// ---------- Guessing ----------

async function submitGuess(key, songName) {
  const cell = game.state.cells[key];
  if (game.state.over || cell.status !== "open" || pending.has(key)) return;
  pending.add(key);
  renderCell(key);

  let points = 0;
  let failed = false;
  try {
    const data = await api.check(game.id, songName, key);
    (Array.isArray(data) ? data : []).forEach(scoreObj => { points = scoreObj.guessscore; });
    points = Number(points) || 0;
  } catch (error) {
    failed = true;
  }
  pending.delete(key);

  if (game.state.over) {
    renderCell(key);
    return;
  }
  if (failed) {
    renderCell(key);
    toast("Couldn't check that guess. It didn't cost a heart, so try again.");
    return;
  }

  if (points > 0) {
    const earned = game.state.easy ? Math.max(0, points - EASY_PENALTY) : points;
    cell.status = "solved";
    cell.song = songName;
    cell.points = earned;
    if (game.state.easy) {
      cell.easy = true;
      cell.base = points;
    }
    game.state.score += earned;
    save();
    renderCell(key, "flip");
    renderHud(true);
    announce(game.state.easy
      ? `Correct. ${songName} scores ${earned} points, ${points} minus ${EASY_PENALTY} for easy mode.`
      : `Correct. ${songName} scores ${points} points.`);
  } else {
    cell.misses.push(songName);
    game.state.livesLost += 1;
    save();
    renderCell(key, "shake");
    const popIndex = HEARTS - Math.min(game.state.livesLost, HEARTS);
    renderHud(false, game.state.livesLost <= HEARTS ? popIndex : undefined);
    const left = HEARTS - game.state.livesLost;
    announce(left > 0 ? `${songName} doesn't fit. ${left} ${left === 1 ? "heart" : "hearts"} left.` : `${songName} doesn't fit.`);
    offerFlag(key, songName, game.state.livesLost === HEARTS ? "Out of hearts: your next miss ends the game." : "");
  }

  if (game.state.livesLost >= MAX_MISSES) endGame("lives");
  else if (solvedCount() === totalCells()) endGame("perfect");
}

// ---------- Ending ----------

function endGame(reason) {
  if (game.state.over) return;
  closeSheet();
  $("#toast").classList.remove("show");
  game.state.over = true;
  game.state.endReason = reason;
  // Streaks count a daily grid only if it was finished before the next one went live
  game.state.playedOn = chicagoToday();
  game.state.finishedAt = new Date().toISOString();
  Object.values(game.state.cells).forEach(cell => {
    if (cell.status === "open") cell.status = "missed";
  });
  save();
  Object.keys(game.state.cells).forEach(key => { if (!pending.has(key)) renderCell(key); });
  renderHud(false);
  renderEndPanel();
  const panel = $("#results");
  if (window.matchMedia("(max-width: 959px)").matches) {
    window.setTimeout(() => panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), 450);
  }
}

const giveUp = {
  armed: false,
  timer: null,
  click() {
    const button = $("#giveUp");
    if (!this.armed) {
      this.armed = true;
      button.textContent = "Tap again to give up";
      this.timer = window.setTimeout(() => this.reset(), 3500);
      return;
    }
    this.reset();
    endGame("quit");
  },
  reset() {
    this.armed = false;
    window.clearTimeout(this.timer);
    $("#giveUp").textContent = "Give up";
  }
};

function renderEndPanel() {
  const state = game.state;
  const panel = $("#results");
  const solved = solvedCount();
  const total = totalCells();
  const headings = { perfect: "Perfect grid", lives: "Out of hearts", quit: "Game over" };
  panel.hidden = false;
  $("#resultsTitle").textContent = headings[state.endReason] || "Game over";
  $("#finalScore").textContent = state.score;
  const finalLabel = $("#finalLabel");
  if (finalLabel) finalLabel.textContent = Number(state.score) === 1 ? "point" : "points";
  let summary = `You filled ${solved} of ${total} squares.`;
  const easyCost = Object.values(state.cells).reduce((sum, cell) => sum + (cell.easy ? (Number(cell.base) || 0) - (Number(cell.points) || 0) : 0), 0);
  if (easyCost > 0) summary += ` Easy mode cost you ${easyCost} ${easyCost === 1 ? "point" : "points"}.`;
  if (solved < total) summary += " Tap play on a missed square to hear a song that fit.";
  $("#summary").textContent = summary;

  const mini = $("#mini");
  mini.innerHTML = "";
  mini.style.gridTemplateColumns = `repeat(${game.artists.length}, 22px)`;
  game.categories.forEach(category => {
    game.artists.forEach(artist => {
      const cell = game.state.cells[cellKey(category, artist)];
      const shade = cell.status === "solved" ? (cell.points >= 10 ? "deep" : cell.points >= 8 ? "on" : "easy") : (cell.misses.length ? "miss" : "");
      mini.append(el("i", { class: shade }));
    });
  });

  loadFlags();
  const form = $("#submitForm");
  const done = $("#submitDone");
  form.hidden = state.submitted;
  done.hidden = !state.submitted;
  done.textContent = state.renamed
    ? `That name isn't allowed on the leaderboard, so you're on it as ${state.name}.`
    : "Your score is on the leaderboard.";
  if (!state.submitted) {
    $("#playerName").value = state.name || storage.get("musicgrid:name") || "";
  }
}

// Share squares: shade by points (deeper cuts score more), red for a square
// you guessed wrong on, black for one you never tried.
function shareSquare(cell) {
  if (cell.status === "solved") {
    if (cell.points >= 10) return "🟩";
    if (cell.points >= 8) return "🟨";
    return "🟧";
  }
  return cell.misses.length ? "🟥" : "⬛";
}

function shareHeadline() {
  const solved = solvedCount();
  const total = totalCells();
  const score = game.state.score;
  const points = `${score} ${score === 1 ? "point" : "points"}`;
  const where = game.state.easy ? "MusicGrid in easy mode" : "MusicGrid";
  if (solved === total) return `Perfect ${where}, ${points}. You could never.`;
  if (solved >= total - 2) return `I scored ${points} on ${where}. You could never.`;
  if (solved >= Math.ceil(total / 2)) return `I scored ${points} on ${where}. Your turn.`;
  if (solved > 0) return `I scored ${points} on ${where}. Be nice.`;
  return "MusicGrid won today. Avenge me.";
}

function shareText() {
  const rows = game.categories.map(category => game.artists.map(artist => (
    shareSquare(game.state.cells[cellKey(category, artist)])
  )).join("")).join("\n");
  let label = game.title;
  if (mode === "daily" && game.day) {
    const date = new Date(`${game.day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    label = `${game.title}, ${date}`;
  }
  return `${shareHeadline()}\n${label}\n${rows}`;
}

async function share() {
  // The link goes inside the text, after a blank line, so it always lands
  // on its own line (a separate url field gets glued onto the last line).
  const text = `${shareText()}\n\n${api.shareUrl(game.id)}`;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (navigator.share && touch) {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Results copied. Paste them anywhere.");
  } catch (error) {
    toast("Couldn't copy automatically. Your score is " + game.state.score + ".");
  }
}

async function submitScore(event) {
  event.preventDefault();
  const input = $("#playerName");
  const button = $("#submitBtn");
  const name = input.value.trim().slice(0, 24);
  if (!name) {
    input.focus();
    $("#submitNote").textContent = "Add a name so people know who to beat.";
    return;
  }
  button.disabled = true;
  button.textContent = "Submitting…";
  try {
    const result = await request("/submit-score", {
      name,
      score: game.state.score,
      lb_id: api.leaderboardId(game.id),
      player_id: playerId(),
      board: api.board
    });
    const finalName = result && result.name ? result.name : name;
    game.state.submitted = true;
    game.state.name = finalName;
    game.state.renamed = Boolean(result && result.renamed);
    if (!game.state.renamed) storage.set("musicgrid:name", finalName);
    save();
    renderEndPanel();
    toast(game.state.renamed ? "Score submitted under a new name" : "Score submitted");
    loadLeaderboard();
  } catch (error) {
    $("#submitNote").textContent = "Couldn't submit right now. Try again in a moment.";
  } finally {
    button.disabled = false;
    button.textContent = "Submit score";
  }
}

// ---------- "I think it fits": flag a rejected guess ----------

let flagTimer = null;
let flagTarget = null;

function flagMessage(data) {
  return data.status === "approved"
    ? "That one counts now. Thanks!"
    : "Sent for review. You'll see the verdict when you finish.";
}

function hideFlagBar() {
  $("#flagBar").hidden = true;
  flagTarget = null;
}

function offerFlag(key, song, extra) {
  const bar = $("#flagBar");
  if (!bar) {
    if (extra) toast(extra);
    return;
  }
  flagTarget = { key, song };
  $("#flagText").textContent = `“${song}” doesn't count here.${extra ? " " + extra : ""}`;
  const button = $("#flagBtn");
  button.hidden = false;
  button.disabled = false;
  bar.hidden = false;
  window.clearTimeout(flagTimer);
  flagTimer = window.setTimeout(hideFlagBar, 9000);
}

async function sendFlag(key, song) {
  const cell = game.state.cells[key];
  cell.flags = cell.flags || [];
  try {
    const data = await request("/complaints", { kind: mode, grid_id: game.id, field: key, song, player_id: playerId() });
    if (!cell.flags.includes(song)) cell.flags.push(song);
    save();
    return data;
  } catch (error) {
    return null;
  }
}

async function flagFromBar() {
  if (!flagTarget) return;
  const { key, song } = flagTarget;
  const button = $("#flagBtn");
  button.disabled = true;
  const data = await sendFlag(key, song);
  $("#flagText").textContent = data ? flagMessage(data) : "Couldn't send that. You can flag it from the square.";
  button.hidden = true;
  window.clearTimeout(flagTimer);
  flagTimer = window.setTimeout(hideFlagBar, 4000);
}

const FLAG_STATUS = {
  pending: { text: "Waiting for review", cls: "pending" },
  approved: { text: "Approved: now counts", cls: "approved" },
  rejected: { text: "Rejected", cls: "rejected" }
};

// After the game: the songs players flagged most on this grid, with verdicts
async function loadFlags() {
  const box = $("#flagged");
  if (!box) return;
  let data;
  try {
    data = await request(`/complaints?kind=${mode}&grid_id=${encodeURIComponent(game.id)}`);
  } catch (error) {
    return;
  }
  const list = $("#flagList");
  list.innerHTML = "";
  const items = (data.complaints || []).slice(0, 8);
  box.hidden = !items.length;
  items.forEach(item => {
    const where = cellLabel(item.field);
    const mine = ((game.state.cells[item.field] || {}).flags || []).some(song => song.toLowerCase() === String(item.song).toLowerCase());
    const status = FLAG_STATUS[item.status] || FLAG_STATUS.pending;
    const who = `${item.players} ${item.players === 1 ? "player" : "players"}${mine ? ", including you" : ""}`;
    list.append(el("li", {}, [
      el("span", { class: "fl-main" }, [
        el("b", { text: item.song }),
        el("span", { text: where ? `${where.artist} · ${where.category}` : item.field })
      ]),
      el("span", { class: "fl-side" }, [
        el("span", { class: `fl-status ${status.cls}`, text: status.text }),
        el("small", { text: who })
      ])
    ]));
  });
}

// ---------- Editing answers (whoever built this grid) ----------

const editor = { squares: [], complaints: [], lists: {}, changed: new Set(), timer: null, seq: 0 };

function editToken() {
  if (mode !== "custom" || !game.id) return null;
  try {
    return window.localStorage.getItem(`musicgrid:edit:${game.id}`);
  } catch (error) {
    return null;
  }
}

function looseKey(text) {
  return String(text || "").toLowerCase().replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+-\s+.*$/, "").replace(/[^a-z0-9]/g, "");
}

function plainSongName(name) {
  return String(name || "")
    .replace(/\s+-\s+(\d{4}\s+)?(remaster(ed)?|re-?recorded|single version|radio edit|album version|mono|stereo|edit)\b.*$/i, "")
    .replace(/\s*[([](feat\.?|ft\.?|with|featuring|from)\s[^)\]]*[)\]]/gi, "")
    .replace(/"/g, "'")
    .trim();
}

async function openEditor() {
  const dialog = $("#editSheet");
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  $("#editBody").textContent = "Loading answers…";
  $("#saveEdit").disabled = true;
  try {
    const data = await request("/grid-answers", { kind: "custom", grid_id: game.id, token: editToken(), clips: false });
    editor.squares = data.squares || [];
    editor.complaints = data.complaints || [];
    editor.lists = {};
    editor.squares.forEach(square => { editor.lists[square.field] = square.answers.map(answer => answer.song); });
    editor.changed = new Set();
    renderEditor();
  } catch (error) {
    $("#editBody").textContent = "Couldn't load the answers. Try again in a moment.";
  }
}

function changeSquare(field, songs) {
  if (!songs.length) {
    toast("Every square needs at least one answer.");
    return;
  }
  editor.lists[field] = songs;
  editor.changed.add(field);
  renderEditor(field);
}

function renderEditor(focusField) {
  const body = $("#editBody");
  body.innerHTML = "";
  editor.squares.forEach(square => {
    const songs = editor.lists[square.field];
    const box = el("section", { class: "edit-square", "data-field": square.field });
    box.append(el("h3", { text: `${square.artist} · ${square.category}` }));
    const chips = el("div", { class: "edit-chips" });
    songs.forEach(song => {
      chips.append(el("span", { class: "edit-chip" }, [
        el("span", { text: song }),
        el("button", {
          type: "button", "aria-label": `Remove ${song}`, html: icon("close", "icon"),
          onclick: () => changeSquare(square.field, songs.filter(other => other !== song))
        })
      ]));
    });
    box.append(chips);
    const flags = editor.complaints.filter(item => item.field === square.field && !songs.some(song => looseKey(song) === looseKey(item.song)));
    if (flags.length) {
      const suggest = el("div", { class: "edit-suggest" }, [el("span", { text: "Players think these fit:" })]);
      flags.forEach(item => suggest.append(el("button", {
        type: "button", class: "edit-add", text: `+ ${item.song} (${item.players})`,
        onclick: () => changeSquare(square.field, [...songs, item.song])
      })));
      box.append(suggest);
    }
    const input = el("input", {
      class: "field edit-input", type: "text", autocomplete: "off", spellcheck: "false",
      placeholder: `Add a ${square.artist} song`, "aria-label": `Add a ${square.artist} song for ${square.category}`
    });
    const results = el("div", { class: "edit-results" });
    input.addEventListener("input", () => {
      window.clearTimeout(editor.timer);
      const query = input.value.trim();
      if (query.length < 2) {
        results.innerHTML = "";
        return;
      }
      editor.timer = window.setTimeout(() => searchForEditor(square, query, results), 250);
    });
    box.append(input, results);
    body.append(box);
    if (focusField === square.field) input.focus();
  });
  const count = editor.changed.size;
  $("#saveEdit").disabled = count === 0;
  $("#editNote").textContent = count ? `${count} ${count === 1 ? "square" : "squares"} changed` : "No changes yet";
}

async function searchForEditor(square, query, results) {
  const seq = ++editor.seq;
  results.textContent = "Searching…";
  let songs = [];
  try {
    songs = await request("/search", { searchTerm: query, easyModeBool: true, artistName: square.artist });
  } catch (error) {
    results.textContent = "Search isn't responding right now.";
    return;
  }
  if (seq !== editor.seq) return;
  results.innerHTML = "";
  const current = editor.lists[square.field].map(looseKey);
  const seen = new Set();
  (Array.isArray(songs) ? songs : []).forEach(song => {
    const name = plainSongName(song.name);
    const key = looseKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const added = current.includes(key);
    results.append(el("button", {
      type: "button", class: "edit-add", text: added ? `${name} (already in)` : `+ ${name}`, disabled: added,
      onclick: () => changeSquare(square.field, [...editor.lists[square.field], name])
    }));
  });
  if (!results.children.length) results.textContent = `No ${square.artist} songs match that.`;
}

async function saveEditor() {
  const button = $("#saveEdit");
  button.disabled = true;
  button.textContent = "Saving…";
  const cells = {};
  editor.changed.forEach(field => { cells[field] = editor.lists[field]; });
  try {
    await request("/grid-answers/save", { kind: "custom", grid_id: game.id, token: editToken(), cells });
    editor.changed = new Set();
    $("#editSheet").close();
    toast("Saved. Scores for those squares were updated.");
  } catch (error) {
    toast("Couldn't save right now. Try again in a moment.");
    button.disabled = false;
  } finally {
    button.textContent = "Save changes";
  }
}

// ---------- Leaderboards ----------

function boardRows(list, entries, valueOf, detailOf) {
  list.innerHTML = "";
  let lastRank = 0;
  entries.forEach(entry => {
    if (entry.me && entry.rank > lastRank + 1 && lastRank > 0) {
      list.append(el("li", { class: "gap", "aria-hidden": "true", text: "…" }));
    }
    lastRank = entry.rank;
    const who = el("span", { class: "who" }, [entry.player_name]);
    const detail = detailOf ? detailOf(entry) : null;
    if (detail) who.append(el("small", { text: detail }));
    list.append(el("li", { class: entry.me ? "me" : "" }, [
      el("span", { class: "rank", text: `${entry.rank}` }),
      who,
      el("span", { class: "pts", text: `${valueOf(entry)}` })
    ]));
  });
}

function boardCount(node, players, noun) {
  node.textContent = players ? `${players} ${players === 1 ? "player" : "players"}${noun ? " " + noun : ""}` : "";
}

function renderBoards(grid, allTime) {
  const list = $("#leaderboardList");
  const note = $("#leaderboardNote");
  boardCount($("#lbCount"), grid.players, mode === "daily" && !game.past ? "today" : "");
  if (grid.entries.length) {
    note.hidden = true;
    boardRows(list, grid.entries, entry => entry.player_score);
  } else {
    list.innerHTML = "";
    note.hidden = false;
    note.textContent = "No scores yet. Finish the grid to claim the top spot.";
  }

  const atList = $("#allTimeList");
  const atNote = $("#allTimeNote");
  if (!allTime) {
    $("#allTimeCard").hidden = true;
    return;
  }
  $("#allTimeCard").hidden = false;
  boardCount($("#atCount"), allTime.players, "");
  if (allTime.entries.length) {
    atNote.hidden = true;
    boardRows(atList, allTime.entries, entry => entry.total, entry => `${entry.grids} ${entry.grids === 1 ? "grid" : "grids"}`);
  } else {
    atList.innerHTML = "";
    atNote.hidden = false;
    atNote.textContent = "All-time totals show up after the first daily scores.";
  }
}

async function loadLeaderboard() {
  const lbId = api.leaderboardId(game.id);
  try {
    const data = await request("/leaderboards", { lb_id: lbId, board: api.board, player_id: playerId() });
    renderBoards(data.grid, data.allTime);
    return;
  } catch (error) {
    // Older server without /leaderboards: fall back to the single board.
  }
  try {
    const scores = await request("/scores", { lb_id: lbId });
    const me = game.state && game.state.submitted ? { name: game.state.name, score: game.state.score } : null;
    let marked = false;
    const entries = (Array.isArray(scores) ? scores : []).map(({ rank, player_name, player_score }) => {
      const isMe = !marked && me && player_name === me.name && Number(player_score) === Number(me.score);
      if (isMe) marked = true;
      return { rank: Number(rank), player_name, player_score, me: Boolean(isMe) };
    });
    renderBoards({ players: entries.length, entries }, null);
  } catch (error) {
    const note = $("#leaderboardNote");
    note.hidden = false;
    note.textContent = "The leaderboard didn't load.";
  }
}

// ---------- Countdown to the next daily grid (midnight Central) ----------

function secondsToNextGrid() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(new Date());
  const part = type => Number(parts.find(p => p.type === type).value);
  return 86400 - (part("hour") * 3600 + part("minute") * 60 + part("second"));
}

function clock(seconds) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

function shortClock(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return "less than a minute";
}

let countdownTimer = null;

async function startCountdown() {
  if (mode !== "daily" || game.past) return;
  // Only count down when tomorrow brings a new grid (scheduled, or a rerun)
  try {
    const data = await request("/grid-calendar?days=2");
    const tomorrow = data.calendar && data.calendar[1];
    if (tomorrow && !tomorrow.scheduled && !tomorrow.rerun) return;
  } catch (error) {
    // Older server without the calendar: count down anyway
  }
  const head = $("#nextGridHead");
  const panel = $("#nextGridPanel");
  let last = secondsToNextGrid();
  const tick = () => {
    const left = secondsToNextGrid();
    const wrapped = left > last + 5; // the clock passed midnight
    last = left;
    if (wrapped || left <= 0) {
      window.clearInterval(countdownTimer);
      head.hidden = false;
      head.innerHTML = "";
      head.append("A new grid is live. ", el("a", { href: "/", text: "Play it" }));
      $("#nextGridClock").textContent = "Now";
      return;
    }
    $("#nextGridShort").textContent = shortClock(left);
    $("#nextGridClock").textContent = clock(left);
  };
  tick();
  head.hidden = false;
  panel.hidden = false;
  countdownTimer = window.setInterval(tick, 1000);
}

// ---------- Boot ----------

let slowTimer = null;

async function boot() {
  renderBoardState("loading");
  const note = $("#loadingNote");
  note.hidden = true;
  window.clearTimeout(slowTimer);
  slowTimer = window.setTimeout(() => {
    note.hidden = false;
  }, 3500);

  try {
    game.id = await api.resolveId();
    const data = await api.loadGrid(game.id);
    if (!Array.isArray(data)) throw new Error("Unexpected grid data");
    parseGrid(data);
  } catch (error) {
    window.clearTimeout(slowTimer);
    note.hidden = true;
    renderBoardState("error", "The server might be waking up. Give it a few seconds and try again.");
    return;
  }
  window.clearTimeout(slowTimer);
  note.hidden = true;

  if (!game.artists.length || !game.categories.length) {
    renderBoardState("empty", "This grid has no artists or categories yet.");
    return;
  }

  saveKey = `musicgrid:${mode}:${game.id}`;
  const hadSave = Boolean(storage.get(saveKey));
  game.state = restoreState();
  // The stats page reads these back, so a saved game knows what it was
  game.state.title = game.title;
  if (mode === "daily" && game.day) game.state.day = game.day;
  if (hadSave) save();
  shownScore = game.state.score;
  renderHead();
  buildBoard();
  renderHud(false);
  if (game.state.over) renderEndPanel();
  loadLeaderboard();
  startCountdown();
  if (game.notice) toast(game.notice);
  if (window.location.hash === "#edit" && editToken()) openEditor();
}

function wire() {
  const board = $("#board");
  board.addEventListener("click", event => {
    const listen = event.target.closest("[data-listen]");
    if (listen) {
      playPreview(listen.dataset.listen, listen.dataset.listen);
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open) openSheet(open.dataset.open);
  });
  const light = event => {
    const node = event.target.closest(".cell");
    if (node && node.dataset.r !== undefined) lightHeads(node.dataset.r, node.dataset.c);
  };
  board.addEventListener("pointerover", light);
  board.addEventListener("focusin", light);
  board.addEventListener("pointerleave", () => lightHeads());
  board.addEventListener("focusout", () => lightHeads());

  $("#guessInput").addEventListener("input", onSearchInput);
  $("#guessSheet").addEventListener("keydown", onSheetKeydown);
  $("#guessSheet").addEventListener("close", () => {
    stopAudio();
    sheet.key = null;
  });
  $("#guessSheet").addEventListener("click", event => {
    if (event.target === $("#guessSheet")) closeSheet();
  });
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#hintBtn").addEventListener("click", () => {
    if (sheet.key) playPreview(sheet.key, "sheet");
  });

  $("#easyMode").addEventListener("change", event => {
    if (!game.state) return;
    // Nothing changes until they confirm in the dialog
    event.target.checked = game.state.easy;
    if (!game.state.easy && !game.state.over) askForEasyMode();
  });
  const easyDialog = $("#easyConfirm");
  if (easyDialog) {
    $("#easyYes").addEventListener("click", () => {
      easyDialog.close();
      turnOnEasyMode();
    });
    $("#easyNo").addEventListener("click", () => easyDialog.close());
    easyDialog.addEventListener("click", event => {
      if (event.target === easyDialog) easyDialog.close();
    });
  }
  $("#giveUp").addEventListener("click", () => giveUp.click());
  if ($("#flagBtn")) $("#flagBtn").addEventListener("click", flagFromBar);
  if ($("#flagClose")) $("#flagClose").addEventListener("click", hideFlagBar);
  if ($("#atInfoBtn")) {
    $("#atInfoBtn").addEventListener("click", () => {
      const info = $("#atInfo");
      info.hidden = !info.hidden;
      $("#atInfoBtn").setAttribute("aria-expanded", String(!info.hidden));
    });
  }
  if ($("#editAnswers")) $("#editAnswers").addEventListener("click", openEditor);
  if ($("#editSheet")) {
    $("#closeEdit").addEventListener("click", () => $("#editSheet").close());
    $("#saveEdit").addEventListener("click", saveEditor);
  }
  $("#shareBtn").addEventListener("click", share);
  $("#submitForm").addEventListener("submit", submitScore);
}

wire();
boot();
