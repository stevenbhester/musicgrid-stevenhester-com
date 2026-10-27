// Browse: past daily grids and player-made grids, with your own results.

const API = "https://music-grid-io-42616e204fd3.herokuapp.com";
const PAGE = 24;

const $ = selector => document.querySelector(selector);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function savedGame(mode, id) {
  try {
    return JSON.parse(window.localStorage.getItem(`musicgrid:${mode}:${id}`));
  } catch (error) {
    return null;
  }
}

// What you did on this grid, from the game's saved progress
function statusFor(mode, id) {
  const state = savedGame(mode, id);
  if (!state || !state.cells) return { label: "Not played yet", cls: "" };
  if (state.over) {
    const score = Number(state.score);
    return { label: `You scored ${score} ${score === 1 ? "point" : "points"}`, cls: "done" };
  }
  const started = Object.values(state.cells).some(cell => cell.status === "solved" || (cell.misses && cell.misses.length));
  return started ? { label: "In progress", cls: "started" } : { label: "Not played yet", cls: "" };
}

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function prettyDate(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: day.slice(0, 4) === today().slice(0, 4) ? undefined : "numeric" });
}

function playersText(n) {
  return n ? `${n} ${n === 1 ? "player" : "players"}` : "No scores yet";
}

function card(kind, grid) {
  const link = el("a", `grid-card ${kind}`);
  const top = el("div", "gc-top");
  if (kind === "daily") {
    link.href = `/?grid=${encodeURIComponent(grid.grid_id)}`;
    top.append(el("span", "gc-tag", grid.day === today() ? "Today" : prettyDate(grid.day)));
  } else {
    link.href = `/play-custom-grid?custom_grid_id=${encodeURIComponent(grid.custom_grid_id)}`;
    top.append(el("span", "gc-tag", "Player-made"));
  }
  top.append(el("span", "gc-players", playersText(grid.players)));
  link.append(top);
  link.append(el("b", "gc-title", grid.title || (kind === "daily" ? "Daily grid" : "Custom grid")));
  link.append(el("span", "gc-artists", (grid.artists || []).join(", ")));
  const status = statusFor(kind, kind === "daily" ? grid.grid_id : grid.custom_grid_id);
  link.append(el("span", `gc-status ${status.cls}`, status.label));
  return link;
}

const lists = {
  daily: { offset: 0, path: "/grids/daily", empty: "No daily grids have played yet. Check back tomorrow." },
  custom: { offset: 0, path: "/grids/custom", empty: "Nobody has built a grid yet. Be the first." }
};

async function load(kind) {
  const list = lists[kind];
  const holder = $(`#${kind}List`);
  const more = $(`#${kind}More`);
  const note = $(`#${kind}Note`);
  more.disabled = true;
  more.textContent = "Loading…";
  try {
    const response = await fetch(`${API}${list.path}?limit=${PAGE}&offset=${list.offset}`);
    if (!response.ok) throw new Error(`${list.path} returned ${response.status}`);
    const data = await response.json();
    data.grids.forEach(grid => holder.append(card(kind, grid)));
    list.offset += data.grids.length;
    note.hidden = list.offset > 0;
    note.textContent = list.empty;
    more.hidden = !data.hasMore;
  } catch (error) {
    note.hidden = false;
    note.textContent = "These grids didn't load. The server might be waking up, so try again in a few seconds.";
    more.hidden = false;
  } finally {
    more.disabled = false;
    more.textContent = "Show more";
  }
}

function showTab(kind) {
  ["daily", "custom"].forEach(name => {
    $(`#${name}Section`).hidden = name !== kind;
    $(`#${name}Tab`).setAttribute("aria-selected", String(name === kind));
  });
  if (window.location.hash !== (kind === "custom" ? "#player-made" : "")) {
    window.history.replaceState(null, "", kind === "custom" ? "#player-made" : window.location.pathname);
  }
}

$("#dailyTab").addEventListener("click", () => showTab("daily"));
$("#customTab").addEventListener("click", () => showTab("custom"));
$("#dailyMore").addEventListener("click", () => load("daily"));
$("#customMore").addEventListener("click", () => load("custom"));
showTab(window.location.hash === "#player-made" ? "custom" : "daily");
load("daily");
load("custom");
