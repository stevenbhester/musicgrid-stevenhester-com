// Your stats: built from the games saved in this browser by the game page
// (localStorage "musicgrid:daily:<id>" and "musicgrid:custom:<id>"). The
// server is only asked for grid titles, dates and the list of past daily
// grids, which the streak needs.

const API = "https://music-grid-io-42616e204fd3.herokuapp.com";
const TZ = "America/Chicago";
const PAGE = 12;
const PERFECT_SQUARE = 11; // the top score for a square, the deepest cut
const VIEW_KEY = "musicgrid:statsView";

const $ = selector => document.querySelector(selector);
const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function svg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function validDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function dayOf(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleDateString("en-CA", { timeZone: TZ }) : null;
}

function prettyDay(day, withWeekday) {
  if (!day) return "";
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: day.slice(0, 4) === today().slice(0, 4) ? undefined : "numeric"
  });
}

// Scores can land on halves (squares are worth 6 to 11 in half steps)
function num(value, digits = 1) {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

function plural(n, word, many) {
  return `${num(n)} ${Number(n) === 1 ? word : (many || `${word}s`)}`;
}

const store = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { /* private mode */ }
  },
  keys() {
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) keys.push(window.localStorage.key(i));
      return keys;
    } catch (error) {
      return [];
    }
  }
};

// ---------- Reading saved games ----------

function cellOrder(a, b) {
  const [ca, aa] = a.split(" ");
  const [cb, ab] = b.split(" ");
  return ca.localeCompare(cb, undefined, { numeric: true }) || aa.localeCompare(ab, undefined, { numeric: true });
}

function shade(cell) {
  if (cell.status === "solved") {
    if (cell.points >= 10) return "deep";
    if (cell.points >= 8) return "on";
    return "easy";
  }
  return cell.misses.length ? "miss" : "";
}

// One saved game (from this browser or from the server) -> stats row
function parseGame(mode, id, state) {
  if (!state || typeof state !== "object" || !state.cells || typeof state.cells !== "object") return null;
  const keys = Object.keys(state.cells).filter(k => state.cells[k] && typeof state.cells[k] === "object").sort(cellOrder);
  if (!keys.length) return null;
  const cells = keys.map(k => {
    const cell = state.cells[k];
    return {
      key: k,
      status: cell.status,
      points: Number(cell.points) || 0,
      misses: Array.isArray(cell.misses) ? cell.misses : []
    };
  });
  const solved = cells.filter(cell => cell.status === "solved");
  const started = solved.length > 0 || cells.some(cell => cell.misses.length);
  if (!state.over && !started) return null;
  const columns = new Set(keys.map(k => k.split(" ")[1])).size || 3;
  const title = typeof state.title === "string" && state.title && state.title !== "Today's grid" ? state.title : null;
  const finishedAt = Date.parse(state.finishedAt) || null;
  return {
    mode,
    id,
    title,
    day: mode === "daily" ? validDay(state.day) : null,
    playedOn: validDay(state.playedOn) || dayOf(finishedAt),
    finishedAt,
    over: Boolean(state.over),
    score: Number(state.score) || 0,
    solved: solved.length,
    total: cells.length,
    points: solved.map(cell => cell.points),
    easy: Boolean(state.easy),
    columns,
    shades: cells.map(shade)
  };
}

function localStates() {
  const states = [];
  store.keys().forEach(key => {
    const match = /^musicgrid:(daily|custom):(\d+)$/.exec(key || "");
    if (!match) return;
    try {
      states.push({ mode: match[1], grid_id: match[2], state: JSON.parse(store.get(key)) });
    } catch (error) {
      // Skip a damaged save
    }
  });
  return states;
}

function readGames() {
  return localStates().map(item => parseGame(item.mode, item.grid_id, item.state)).filter(Boolean);
}

// ---------- Server lookups ----------

async function getJson(path) {
  const response = await fetch(API + path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

// Every daily grid that has played, newest first
async function fetchDailyGrids() {
  const grids = [];
  for (let page = 0; page < 40; page += 1) {
    const data = await getJson(`/grids/daily?limit=60&offset=${grids.length}`);
    grids.push(...data.grids);
    if (!data.hasMore || !data.grids.length) break;
  }
  return grids;
}

async function fetchCustomTitles(ids) {
  if (!ids.length) return [];
  const data = await getJson(`/grids/custom?limit=60&ids=${ids.slice(0, 100).join(",")}`);
  return data.grids || [];
}

// ---------- Numbers ----------

// A daily grid counts toward a streak when it was finished before the next
// daily grid went live. Days with no new grid don't break it.
function streaks(dailyGrids, finished) {
  if (!dailyGrids.length) return { current: 0, best: 0, currentDone: false };
  const onTime = index => {
    // A day can have more than one grid (a rerun replaced in the archive); any of them counts
    const ids = [dailyGrids[index].grid_id, ...(dailyGrids[index].also || [])].map(String);
    const game = ids.map(id => finished.get(id)).find(Boolean);
    if (!game) return false;
    const nextDay = index > 0 ? dailyGrids[index - 1].day : null;
    return !game.playedOn || !nextDay || game.playedOn < nextDay;
  };
  let current = 0;
  for (let i = 0; i < dailyGrids.length; i += 1) {
    if (onTime(i)) current += 1;
    else if (i > 0) break; // today's grid not finished yet doesn't end the run
  }
  let best = 0;
  let run = 0;
  for (let i = dailyGrids.length - 1; i >= 0; i -= 1) {
    if (onTime(i)) {
      run += 1;
      best = Math.max(best, run);
    } else if (i > 0) {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current), currentDone: onTime(0) };
}

function summarize(games) {
  const done = games.filter(game => game.over);
  const squares = done.reduce((sum, game) => sum + game.solved, 0);
  const points = done.reduce((sum, game) => sum + game.points.reduce((a, b) => a + b, 0), 0);
  const best = done.reduce((top, game) => (!top || game.score > top.score ? game : top), null);
  const sizes = new Set(done.map(game => game.total));
  return {
    played: done.length,
    daily: done.filter(game => game.mode === "daily").length,
    custom: done.filter(game => game.mode === "custom").length,
    best,
    average: done.length ? done.reduce((sum, game) => sum + game.score, 0) / done.length : 0,
    avgSquares: done.length ? squares / done.length : 0,
    squaresOf: sizes.size === 1 ? [...sizes][0] : null,
    avgPoints: squares ? points / squares : 0,
    perfectSquares: done.reduce((sum, game) => sum + game.points.filter(p => p >= PERFECT_SQUARE).length, 0),
    perfectGames: done.filter(game => game.solved === game.total).length
  };
}

// ---------- State ----------

const data = {
  games: [],
  dailyGrids: null, // null while loading, [] if it failed
  dailyFailed: false,
  view: "daily",
  shown: PAGE
};

function titleOf(game) {
  return game.title || (game.mode === "daily" ? "Daily grid" : "Player-made grid");
}

function dateOf(game) {
  return game.mode === "daily" ? (game.day || game.playedOn) : game.playedOn;
}

function urlOf(game) {
  return game.mode === "daily"
    ? `/?grid=${encodeURIComponent(game.id)}`
    : `/play-custom-grid?custom_grid_id=${encodeURIComponent(game.id)}`;
}

function inView(game) {
  return data.view === "all" || game.mode === data.view;
}

// Oldest first; games with no date at all go first so they sit at the bottom of the history
function byDate(a, b) {
  const da = dateOf(a) || "";
  const db = dateOf(b) || "";
  return da.localeCompare(db) || (a.finishedAt || 0) - (b.finishedAt || 0) || Number(a.id) - Number(b.id);
}

// ---------- Rendering: tiles ----------

function tile(label, value, sub, opts = {}) {
  const node = el("div", `stat${opts.cls ? ` ${opts.cls}` : ""}`);
  node.append(el("span", "stat-label", label));
  node.append(el("b", "stat-value", value));
  const subNode = el("span", "stat-sub");
  if (opts.link) {
    subNode.append(el("a", null, opts.link.text));
    subNode.firstChild.href = opts.link.href;
  } else {
    subNode.textContent = sub || "";
  }
  node.append(subNode);
  return node;
}

function renderTiles(summary) {
  const holder = $("#statTiles");
  holder.innerHTML = "";
  holder.dataset.count = data.view === "custom" ? "6" : "8";
  const playedSub = data.view === "all"
    ? `${num(summary.daily)} daily, ${num(summary.custom)} player-made`
    : data.view === "daily" ? "Daily grids finished" : "Player-made grids finished";
  holder.append(tile("Grids played", num(summary.played), playedSub));

  if (data.view !== "custom") {
    const label = data.view === "all" ? "Daily streak" : "Current streak";
    if (data.dailyGrids === null) {
      holder.append(tile(label, "…", "Checking past grids"));
      holder.append(tile("Best streak", "…", "Checking past grids"));
    } else if (data.dailyFailed) {
      holder.append(tile(label, "–", "Couldn't check past grids"));
      holder.append(tile("Best streak", "–", "Couldn't check past grids"));
    } else {
      const finished = new Map(data.games.filter(g => g.mode === "daily" && g.over).map(g => [g.id, g]));
      const streak = streaks(data.dailyGrids, finished);
      let opts = {};
      let sub = streak.current === 1 ? "Daily grid" : "Daily grids in a row";
      if (!streak.currentDone) {
        opts = { link: { href: "/", text: streak.current ? "Play today's grid to keep it" : "Play today's grid to start one" } };
      }
      holder.append(tile(label, num(streak.current), sub, { ...opts, cls: "accent" }));
      holder.append(tile("Best streak", num(streak.best), "Your longest run"));
    }
  }

  holder.append(tile("Highest score", summary.best ? num(summary.best.score) : "–", summary.best ? titleOf(summary.best) : ""));
  holder.append(tile("Squares per grid", num(summary.avgSquares), summary.squaresOf ? `Average, out of ${summary.squaresOf}` : "On average"));
  holder.append(tile("Points per square", summary.avgPoints ? num(summary.avgPoints) : "–", "Average for squares you filled"));
  holder.append(tile("Perfect squares", num(summary.perfectSquares), "11-pointers, the deepest cuts"));
  holder.append(tile("Perfect games", num(summary.perfectGames), "Every square filled"));
}

// ---------- Rendering: chart ----------

const chart = { points: [], active: -1, layout: null };

function chartPoints() {
  return data.games
    .filter(game => game.over && inView(game) && dateOf(game))
    .sort(byDate)
    .map(game => ({ game, score: game.score, day: dateOf(game) }));
}

function renderChartCard(summary) {
  chart.points = chartPoints();
  const card = $("#chartCard");
  card.hidden = chart.points.length === 0;
  if (card.hidden) return;
  const n = chart.points.length;
  $("#chartSub").textContent = `Average ${plural(summary.average, "point")} across ${plural(summary.played, "grid")}. Each dot is one grid, oldest to newest.`;
  $("#chartNote").hidden = n > 2;
  $("#chart").setAttribute("aria-label", `Score chart, ${plural(n, "game")}. Latest ${num(chart.points[n - 1].score)}, best ${num(Math.max(...chart.points.map(p => p.score)))}.`);
  chart.active = -1;
  drawChart();
}

function niceTop(max) {
  return Math.max(100, Math.ceil(max / 25) * 25);
}

function drawChart() {
  const holder = $("#chart");
  const old = holder.querySelector("svg");
  if (old) old.remove();
  const points = chart.points;
  const n = points.length;
  if (!n) return;

  const width = Math.max(260, holder.clientWidth);
  const height = width < 520 ? 210 : 250;
  const m = { top: 24, right: 20, bottom: 30, left: 34 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const top = niceTop(Math.max(...points.map(p => p.score)));
  const x = i => m.left + (n === 1 ? w / 2 : (i * w) / (n - 1));
  const y = v => m.top + h - (v / top) * h;
  chart.layout = { x, y, m, w, h, width, height };

  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, width, height, "aria-hidden": "true" });

  // Gridlines and y ticks
  const grid = svg("g", { class: "chart-grid" });
  for (let v = 0; v <= top; v += 25) {
    grid.append(svg("line", { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v) }));
    const label = svg("text", { x: m.left - 8, y: y(v) + 4, "text-anchor": "end" });
    label.textContent = v;
    grid.append(label);
  }
  root.append(grid);

  // X labels: a handful of dates, never crowded
  const ticks = Math.min(n, Math.max(2, Math.floor(w / 86)));
  const picks = new Set();
  if (n === 1) picks.add(0);
  else for (let k = 0; k < ticks; k += 1) picks.add(Math.round((k * (n - 1)) / (ticks - 1)));
  const xAxis = svg("g", { class: "chart-axis" });
  [...picks].forEach(i => {
    const anchor = n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle";
    const label = svg("text", { x: x(i), y: height - 8, "text-anchor": anchor });
    label.textContent = prettyDay(points[i].day);
    xAxis.append(label);
  });
  root.append(xAxis);

  // Area wash + line
  if (n > 1) {
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join("");
    root.append(svg("path", { class: "chart-area", d: `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` }));
    root.append(svg("path", { class: "chart-line", d: line }));
  }

  // Dots (only while they have room), plus the crosshair layer
  const cross = svg("line", { class: "chart-cross", x1: 0, x2: 0, y1: m.top, y2: m.top + h, visibility: "hidden" });
  root.append(cross);
  const showDots = n <= Math.max(12, Math.floor(w / 12));
  const dots = svg("g", { class: "chart-dots" });
  points.forEach((p, i) => {
    if (showDots || i === n - 1) dots.append(svg("circle", { cx: x(i), cy: y(p.score), r: 4 }));
  });
  root.append(dots);
  const focus = svg("circle", { class: "chart-focus", r: 6, cx: 0, cy: 0, visibility: "hidden" });
  root.append(focus);

  // Direct labels: the best score and the latest one
  let bestIndex = 0;
  points.forEach((p, i) => { if (p.score >= points[bestIndex].score) bestIndex = i; });
  const labels = svg("g", { class: "chart-labels" });
  const label = (i, text) => {
    const px = x(i);
    const py = y(points[i].score);
    const anchor = px > width - m.right - 40 ? "end" : px < m.left + 40 ? "start" : "middle";
    const ty = py - 12 < m.top - 8 ? py + 22 : py - 12;
    const node = svg("text", { x: anchor === "end" ? px + 4 : anchor === "start" ? px - 4 : px, y: ty, "text-anchor": anchor });
    node.textContent = text;
    labels.append(node);
  };
  label(bestIndex, `Best ${num(points[bestIndex].score)}`);
  const last = n - 1;
  const apart = Math.abs(x(last) - x(bestIndex)) > 64 || Math.abs(y(points[last].score) - y(points[bestIndex].score)) > 22;
  if (last !== bestIndex && apart) label(last, num(points[last].score));
  root.append(labels);

  // Hit area covers the whole plot, so the pointer only has to be near a date
  const hit = svg("rect", { class: "chart-hit", x: m.left - 12, y: 0, width: w + 24, height: m.top + h + 8 });
  root.append(hit);
  holder.prepend(root);
  chart.cross = cross;
  chart.focus = focus;
  if (chart.active >= 0) activate(Math.min(chart.active, n - 1));
}

function nearest(clientX) {
  const box = $("#chart").getBoundingClientRect();
  const px = clientX - box.left;
  const { m, w } = chart.layout;
  const n = chart.points.length;
  if (n === 1) return 0;
  return Math.max(0, Math.min(n - 1, Math.round(((px - m.left) / w) * (n - 1))));
}

function activate(index) {
  const point = chart.points[index];
  if (!point || !chart.layout) return;
  chart.active = index;
  const { x, y, width } = chart.layout;
  const px = x(index);
  const py = y(point.score);
  chart.cross.setAttribute("x1", px);
  chart.cross.setAttribute("x2", px);
  chart.cross.setAttribute("visibility", "visible");
  chart.focus.setAttribute("cx", px);
  chart.focus.setAttribute("cy", py);
  chart.focus.setAttribute("visibility", "visible");

  const tip = $("#chartTip");
  tip.innerHTML = "";
  tip.append(el("b", null, plural(point.score, "point")));
  tip.append(el("span", "tip-title", titleOf(point.game)));
  const bits = [prettyDay(point.day, true), `${point.game.solved} of ${point.game.total} squares`];
  if (point.game.mode === "custom") bits.push("Player-made");
  tip.append(el("span", "tip-meta", bits.join(" · ")));
  tip.hidden = false;
  const tipWidth = tip.offsetWidth;
  const left = Math.max(0, Math.min(width - tipWidth, px - tipWidth / 2));
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(0, py - tip.offsetHeight - 16)}px`;
  if (py - tip.offsetHeight - 16 < 0) tip.style.top = `${py + 16}px`;
}

function deactivate() {
  chart.active = -1;
  if (chart.cross) chart.cross.setAttribute("visibility", "hidden");
  if (chart.focus) chart.focus.setAttribute("visibility", "hidden");
  $("#chartTip").hidden = true;
}

function wireChart() {
  const holder = $("#chart");
  holder.addEventListener("pointermove", event => { if (chart.layout) activate(nearest(event.clientX)); });
  holder.addEventListener("pointerdown", event => { if (chart.layout) activate(nearest(event.clientX)); });
  holder.addEventListener("pointerleave", event => { if (event.pointerType === "mouse") deactivate(); });
  holder.addEventListener("focus", () => activate(chart.active >= 0 ? chart.active : chart.points.length - 1));
  holder.addEventListener("blur", deactivate);
  holder.addEventListener("keydown", event => {
    const n = chart.points.length;
    if (!n) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const from = chart.active >= 0 ? chart.active : n - 1;
    activate(Math.max(0, Math.min(n - 1, from + moves[event.key])));
  });
  if (window.ResizeObserver) {
    let lastWidth = 0;
    new ResizeObserver(entries => {
      const widthNow = Math.round(entries[0].contentRect.width);
      if (widthNow !== lastWidth) {
        lastWidth = widthNow;
        drawChart();
      }
    }).observe(holder);
  }
}

// ---------- Rendering: history ----------

function historyRow(game) {
  const item = el("li");
  const link = el("a", `hist-row${game.over ? "" : " unfinished"}`);
  link.href = urlOf(game);

  const mini = el("span", "mini small");
  mini.style.gridTemplateColumns = `repeat(${game.columns}, 12px)`;
  mini.setAttribute("aria-hidden", "true");
  game.shades.forEach(cls => mini.append(el("i", cls)));
  link.append(mini);

  const main = el("span", "hist-main");
  main.append(el("b", "hist-title", titleOf(game)));
  const bits = [];
  const day = dateOf(game);
  if (day) bits.push(prettyDay(day, true));
  if (game.mode === "custom") bits.push("Player-made");
  bits.push(game.over ? `${game.solved} of ${game.total} squares` : `In progress, ${game.solved} of ${game.total} so far`);
  if (game.solved === game.total) bits.push("Perfect");
  if (game.easy) bits.push("Easy mode");
  main.append(el("span", "hist-meta", bits.join(" · ")));
  link.append(main);

  const score = el("span", "hist-score");
  if (game.over) {
    score.append(el("b", null, num(game.score)));
    score.append(el("small", null, game.score === 1 ? "point" : "points"));
  } else {
    score.append(el("small", "keep", "Finish it"));
  }
  link.append(score);
  item.append(link);
  return item;
}

function renderHistory() {
  const games = data.games.filter(inView);
  const unfinished = games.filter(game => !game.over).sort(byDate).reverse();
  const finished = games.filter(game => game.over).sort(byDate).reverse();
  const rows = [...unfinished, ...finished];
  const list = $("#historyList");
  list.innerHTML = "";
  rows.slice(0, data.shown).forEach(game => list.append(historyRow(game)));
  $("#historyMore").hidden = rows.length <= data.shown;
  $("#historyCount").textContent = plural(rows.length, "grid");
}

// ---------- Page ----------

function render() {
  const anyFinished = data.games.some(game => game.over);
  $("#statsEmpty").hidden = anyFinished;
  $("#statsBody").hidden = !data.games.length;
  const hasDaily = data.games.some(game => game.mode === "daily");
  const hasCustom = data.games.some(game => game.mode === "custom");
  $("#statsFilter").hidden = !(hasDaily && hasCustom);
  if (!hasDaily && data.view !== "custom") data.view = "custom";
  if (!hasCustom && data.view !== "daily") data.view = "daily";
  document.querySelectorAll("#statsFilter button").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.view === data.view));
  });
  if (!data.games.length) return;
  const summary = summarize(data.games.filter(inView));
  $("#statTiles").hidden = summary.played === 0;
  renderTiles(summary);
  renderChartCard(summary);
  renderHistory();
}

async function lookUp() {
  const daily = data.games.filter(game => game.mode === "daily");
  const custom = data.games.filter(game => game.mode === "custom" && !game.title);
  const jobs = [];
  if (daily.length) {
    jobs.push(fetchDailyGrids().then(grids => {
      data.dailyGrids = grids;
      const byId = new Map(grids.map(grid => [String(grid.grid_id), grid]));
      daily.forEach(game => {
        const grid = byId.get(game.id);
        if (!grid) return;
        if (!game.day) game.day = grid.day;
        if (!game.title && grid.title) game.title = grid.title;
      });
    }).catch(() => {
      data.dailyGrids = [];
      data.dailyFailed = true;
    }));
  }
  if (custom.length) {
    jobs.push(fetchCustomTitles(custom.map(game => game.id)).then(grids => {
      const byId = new Map(grids.map(grid => [String(grid.custom_grid_id), grid]));
      custom.forEach(game => {
        const grid = byId.get(game.id);
        if (grid && grid.title) game.title = grid.title;
      });
    }).catch(() => { /* keep the generic titles */ }));
  }
  await Promise.all(jobs);
}

// ---------- Player code ----------
// The game saves a random id in this browser ("musicgrid:player") and sends
// it with scores. Leaderboards group by it, never by name, and never show
// it. Linking moves this browser onto another device's id.

const PLAYER_KEY = "musicgrid:player";
const PHRASE_KEY = "musicgrid:playerPhrase";
const CODE_RE = /^[A-Za-z0-9-]{8,64}$/;
// Codes the site makes: a random UUID, the older fallback, or a hashed made-up code
const MADE_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{13}-[a-z0-9]{6,12}|p-[0-9a-f]{40})$/i;
const MIN_PHRASE = 8;
const MAX_PHRASE = 100;

function playerCode() {
  let code = null;
  try { code = JSON.parse(store.get(PLAYER_KEY)); } catch (error) { code = null; }
  if (typeof code !== "string" || !CODE_RE.test(code)) {
    code = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    store.set(PLAYER_KEY, JSON.stringify(code));
  }
  return code;
}

function deviceLink() {
  return `${window.location.origin}/stats#code=${encodeURIComponent(playerCode())}`;
}

// A made-up code the player chose, kept only in this browser so "Show code"
// can show it. The server only ever sees its hash.
function savedPhrase() {
  try {
    const saved = JSON.parse(store.get(PHRASE_KEY));
    return saved && saved.id === playerCode() && typeof saved.phrase === "string" ? saved.phrase : null;
  } catch (error) {
    return null;
  }
}

function showCode() {
  $("#codeText").textContent = savedPhrase() || playerCode();
}

// Same words, same player: case and extra spaces don't matter
function normalPhrase(text) {
  return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function phraseId(phrase) {
  if (!window.crypto || !window.crypto.subtle) throw new Error("no-crypto");
  const bytes = new TextEncoder().encode(`musicgrid:${normalPhrase(phrase)}`);
  const hash = new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes));
  return `p-${[...hash].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40)}`;
}

// Returns { ok, text } for the page. A code copied from another device is
// used as it is; anything else is a made-up code, hashed first.
async function linkTo(rawCode) {
  const typed = String(rawCode || "").trim();
  const madeUp = !MADE_RE.test(typed);
  if (madeUp && normalPhrase(typed).length < MIN_PHRASE) {
    return { ok: false, text: `Make your code at least ${MIN_PHRASE} characters, so nobody else lands on it by accident.` };
  }
  if (madeUp && typed.length > MAX_PHRASE) return { ok: false, text: `Keep your code under ${MAX_PHRASE} characters.` };
  let code = typed;
  if (madeUp) {
    try {
      code = await phraseId(typed);
    } catch (error) {
      return { ok: false, text: "This browser can't set a made-up code. Try another browser." };
    }
  }
  if (!CODE_RE.test(code)) return { ok: false, text: "That doesn't look like a player code. Copy it again from the other device." };
  const current = playerCode();
  if (code === current) return { ok: false, text: "That's already this browser's code." };
  const response = await fetch(`${API}/link-player`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_id: current, to_id: code })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `link-player returned ${response.status}`);
  store.set(PLAYER_KEY, JSON.stringify(code));
  if (madeUp) store.set(PHRASE_KEY, JSON.stringify({ id: code, phrase: typed }));
  showCode();
  const moved = result.moved ? ` ${plural(result.moved, "score")} from this browser moved over.` : "";
  if (madeUp) return { ok: true, text: `Your code is set. Type the same code on any other device to play as you there too.${moved}` };
  return { ok: true, text: `Linked. This browser now counts as the same player as your other device.${moved}` };
}

// Send this browser's finished games and get back every game saved under
// the player code, from any linked device. Where a grid was finished in
// more than one place, the higher score counts.
async function syncGames() {
  const local = localStates().filter(item => item.state && item.state.over === true);
  let saved = null;
  try {
    for (let i = 0; i === 0 || i < local.length; i += 25) {
      const response = await fetch(`${API}/player-games/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerCode(), games: local.slice(i, i + 25) })
      });
      if (!response.ok) return false;
      saved = (await response.json()).games || [];
    }
  } catch (error) {
    return false;
  }
  (saved || []).forEach(row => {
    const game = parseGame(row.mode, String(row.grid_id), row.state);
    if (!game || !game.over) return;
    const index = data.games.findIndex(other => other.mode === game.mode && other.id === game.id);
    if (index < 0) {
      data.games.push(game);
    } else {
      const mine = data.games[index];
      if (!mine.over || game.score > mine.score) data.games[index] = { ...game, title: game.title || mine.title, day: game.day || mine.day };
    }
  });
  return true;
}

// Pull in games from linked devices, then fill in titles and dates
async function refresh() {
  await syncGames();
  if (data.games.length) await lookUp().catch(() => {});
  render();
}

function wirePlayerCode() {
  showCode();
  $("#showCode").addEventListener("click", () => {
    const box = $("#codeBox");
    box.hidden = !box.hidden;
    $("#showCode").setAttribute("aria-expanded", String(!box.hidden));
    $("#showCode").textContent = box.hidden ? "Show code" : "Hide code";
  });
  $("#sendLink").addEventListener("click", async () => {
    const note = $("#deviceNote");
    try {
      await navigator.clipboard.writeText(deviceLink());
      note.textContent = "Link copied. Send it to yourself and open it on your other device.";
    } catch (error) {
      $("#codeBox").hidden = false;
      $("#showCode").setAttribute("aria-expanded", "true");
      $("#showCode").textContent = "Hide code";
      note.textContent = "Couldn't copy automatically. Copy the code above and paste it on your other device.";
    }
  });
  $("#useCodeForm").addEventListener("submit", async event => {
    event.preventDefault();
    const note = $("#deviceNote");
    note.textContent = "Linking…";
    try {
      const result = await linkTo($("#codeInput").value);
      note.textContent = result.text;
      if (result.ok) {
        refresh();
        $("#codeInput").value = "";
      }
    } catch (error) {
      note.textContent = "Couldn't link right now. Try again in a moment.";
    }
  });

  // Arriving from another device's link: ask before switching
  let pendingCode = null;
  const panel = $("#linkConfirm");
  $("#linkNo").addEventListener("click", () => {
    panel.hidden = true;
    pendingCode = null;
  });
  $("#linkYes").addEventListener("click", async () => {
    if (!pendingCode) return;
    $("#linkYes").disabled = true;
    $("#linkConfirmNote").textContent = "Linking…";
    try {
      const result = await linkTo(pendingCode);
      if (result.ok) refresh();
      panel.hidden = true;
      pendingCode = null;
      $("#deviceNote").textContent = result.text;
      $("#player-code").scrollIntoView({ block: "center" });
    } catch (error) {
      $("#linkConfirmNote").textContent = "Couldn't link right now. Try again in a moment.";
    } finally {
      $("#linkYes").disabled = false;
    }
  });
  const checkHash = () => {
    const match = window.location.hash.match(/^#code=([A-Za-z0-9-]{8,64})$/);
    if (!match) return;
    // Keep the code out of the address bar and browser history
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (error) { /* ignore */ }
    if (match[1] === playerCode()) {
      $("#deviceNote").textContent = "That link is for this browser already.";
      return;
    }
    pendingCode = match[1];
    $("#linkConfirmNote").textContent = "";
    panel.hidden = false;
    panel.scrollIntoView({ block: "start" });
  };
  window.addEventListener("hashchange", checkHash);
  checkHash();
}

function boot() {
  wirePlayerCode();
  data.games = readGames();
  const savedView = store.get(VIEW_KEY);
  if (["daily", "custom", "all"].includes(savedView)) data.view = savedView;
  document.querySelectorAll("#statsFilter button").forEach(button => {
    button.addEventListener("click", () => {
      data.view = button.dataset.view;
      data.shown = PAGE;
      store.set(VIEW_KEY, data.view);
      render();
    });
  });
  $("#historyMore").addEventListener("click", () => {
    data.shown += PAGE;
    renderHistory();
  });
  wireChart();
  render();
  refresh();
}

boot();
