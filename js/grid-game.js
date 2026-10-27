// MusicGrid game engine.
// Shared by the daily grid (index.html, data-mode="daily") and custom grids
// (play-custom-grid.html, data-mode="custom"). Every request below sends the
// same payload the original client sent, so the Heroku API needs no changes.

const API = "https://music-grid-io-42616e204fd3.herokuapp.com";
const SITE = "https://musicgrid.stevenhester.com";
const HEARTS = 3; // three hearts, then one sudden-death miss
const MAX_MISSES = HEARTS + 1;
const MIN_SEARCH = 3;
const SEARCH_DELAY = 220;

const mode = document.body.dataset.mode === "custom" ? "custom" : "daily";
const params = new URLSearchParams(window.location.search);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- API ----------

async function request(path, body, signal) {
  const options = body === undefined
    ? { signal }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal };
  const response = await fetch(API + path, options);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

const modes = {
  daily: {
    resolveId: () => request("/latest-grid").then(data => data.latestGridId),
    loadGrid: id => request("/grid-data", { grid_id: id }),
    check: (id, song, field) => request("/check-answer", { songGuess: song, fieldGuessed: field, gridId: id }),
    hint: (id, field) => request("/get-cheat-preview-url", { gridId: id, fieldKey: field }),
    leaderboardId: id => id,
    shareUrl: () => SITE + "/",
    fallbackTitle: () => "Today's grid"
  },
  custom: {
    resolveId: () => Promise.resolve(params.get("custom_grid_id") || 1),
    loadGrid: id => request("/custom-grid-data", { custom_grid_id: id }),
    check: (id, song, field) => request("/check-custom-answer", { songGuess: song, fieldGuessed: field, customGridId: id }),
    hint: (id, field) => request("/get-custom-cheat-preview-url", { customGridId: id, fieldKey: field }),
    // Kept identical to the original client. The id from the URL is a string,
    // so this concatenates ("12" + 100 -> "12100"), and existing custom-grid
    // leaderboards are stored under those ids.
    leaderboardId: id => id + 100,
    shareUrl: id => `${SITE}/play-custom-grid?custom_grid_id=${encodeURIComponent(id)}`,
    fallbackTitle: () => "Custom grid"
  }
};
const api = modes[mode];

// ---------- Small helpers ----------

const $ = selector => document.querySelector(selector);

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

// ---------- Game state ----------

const game = {
  id: null,
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
  let title = null;
  data.forEach(item => {
    if (item.field_type === "Category") {
      categories[item.field] = item.field_value;
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
    }
    if (item.grid_title) title = item.grid_title;
  });
  game.categories = Object.keys(categories).map(key => ({ key, name: categories[key] }));
  game.artists = Object.keys(artists).map(key => ({ key, name: artists[key] }));
  game.title = title || api.fallbackTitle(game.id);
}

// ---------- Rendering: header + HUD ----------

function renderHead() {
  $("#gridTitle").textContent = game.title;
  document.title = `${game.title} | MusicGrid`;
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
  $("#easyMode").checked = game.state.easy;
  $("#easyMode").disabled = game.state.over;
  $("#giveUp").hidden = game.state.over;
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
    board.append(el("div", { class: "head head-cat", "data-r": r, text: category.name }));
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
    node = el("div", { class: "cell", "data-state": "solved", role: "img", "aria-label": `${where}: ${cell.song}, ${cell.points} points` }, [
      el("span", { class: "cell-song", text: cell.song }),
      el("span", { class: "cell-points", text: `+${cell.points}` })
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
  cell.misses.forEach((song, i) => {
    if (i) node.append(", ");
    node.append(el("s", { text: song }));
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

async function previewUrl(key) {
  if (hintCache.has(key)) return hintCache.get(key);
  const data = await api.hint(game.id, key);
  const url = data && data.previewUrl ? data.previewUrl : null;
  hintCache.set(key, url);
  return url;
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
    audioOwner = null;
    if (owner === "sheet") {
      setHintButton("idle");
      $("#hintNote").textContent = "No preview is available for this square.";
    } else {
      updateListenButton(owner, false);
      toast("No preview is available for this square.");
    }
    return;
  }
  audio.src = url;
  audio.play().then(() => {
    if (owner === "sheet") setHintButton("playing");
  }).catch(() => {
    stopAudio();
    toast("Your browser blocked the preview. Tap again to play it.");
  });
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
    cell.status = "solved";
    cell.song = songName;
    cell.points = points;
    game.state.score += points;
    save();
    renderCell(key, "flip");
    renderHud(true);
    announce(`Correct. ${songName} scores ${points} points.`);
  } else {
    cell.misses.push(songName);
    game.state.livesLost += 1;
    save();
    renderCell(key, "shake");
    const popIndex = HEARTS - Math.min(game.state.livesLost, HEARTS);
    renderHud(false, game.state.livesLost <= HEARTS ? popIndex : undefined);
    const left = HEARTS - game.state.livesLost;
    announce(left > 0 ? `${songName} doesn't fit. ${left} ${left === 1 ? "heart" : "hearts"} left.` : `${songName} doesn't fit.`);
    if (game.state.livesLost === HEARTS) toast("Out of hearts. Your next miss ends the game.");
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
  let summary = `You filled ${solved} of ${total} squares.`;
  if (solved < total) summary += " Tap play on a missed square to hear a song that fit.";
  $("#summary").textContent = summary;

  const mini = $("#mini");
  mini.innerHTML = "";
  mini.style.gridTemplateColumns = `repeat(${game.artists.length}, 22px)`;
  game.categories.forEach(category => {
    game.artists.forEach(artist => {
      mini.append(el("i", { class: game.state.cells[cellKey(category, artist)].status === "solved" ? "on" : "" }));
    });
  });

  const form = $("#submitForm");
  const done = $("#submitDone");
  form.hidden = state.submitted;
  done.hidden = !state.submitted;
  if (!state.submitted) {
    $("#playerName").value = state.name || storage.get("musicgrid:name") || "";
  }
}

function shareText() {
  const rows = game.categories.map(category => game.artists.map(artist => (
    game.state.cells[cellKey(category, artist)].status === "solved" ? "🟨" : "⬛"
  )).join("")).join("\n");
  return `I scored ${game.state.score} on MusicGrid. You could never.\n${game.title}\n${rows}`;
}

async function share() {
  const text = shareText();
  const url = api.shareUrl(game.id);
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (navigator.share && touch) {
    try {
      await navigator.share({ title: "My MusicGrid results", text, url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
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
    await request("/submit-score", { name, score: game.state.score, lb_id: api.leaderboardId(game.id) });
    game.state.submitted = true;
    game.state.name = name;
    storage.set("musicgrid:name", name);
    save();
    renderEndPanel();
    toast("Score submitted");
    loadLeaderboard();
  } catch (error) {
    $("#submitNote").textContent = "Couldn't submit right now. Try again in a moment.";
  } finally {
    button.disabled = false;
    button.textContent = "Submit score";
  }
}

// ---------- Leaderboard ----------

async function loadLeaderboard() {
  const list = $("#leaderboardList");
  const note = $("#leaderboardNote");
  try {
    const scores = await request("/scores", { lb_id: api.leaderboardId(game.id) });
    list.innerHTML = "";
    if (!Array.isArray(scores) || !scores.length) {
      note.hidden = false;
      note.textContent = "No scores yet. Finish the grid to claim the top spot.";
      return;
    }
    note.hidden = true;
    const me = game.state && game.state.submitted ? { name: game.state.name, score: game.state.score } : null;
    let marked = false;
    scores.forEach(({ rank, player_name, player_score }) => {
      const isMe = !marked && me && player_name === me.name && Number(player_score) === Number(me.score);
      if (isMe) marked = true;
      list.append(el("li", { class: isMe ? "me" : "" }, [
        el("span", { class: "rank", text: `${rank}` }),
        el("span", { class: "who", text: player_name }),
        el("span", { class: "pts", text: `${player_score}` })
      ]));
    });
  } catch (error) {
    note.hidden = false;
    note.textContent = "The leaderboard didn't load.";
  }
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
  game.state = restoreState();
  shownScore = game.state.score;
  renderHead();
  buildBoard();
  renderHud(false);
  if (game.state.over) renderEndPanel();
  loadLeaderboard();
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
    game.state.easy = event.target.checked;
    save();
    toast(game.state.easy ? "Easy mode on. Each square now has a song hint." : "Easy mode off");
  });
  $("#giveUp").addEventListener("click", () => giveUp.click());
  $("#shareBtn").addEventListener("click", share);
  $("#submitForm").addEventListener("submit", submitScore);
}

wire();
boot();
