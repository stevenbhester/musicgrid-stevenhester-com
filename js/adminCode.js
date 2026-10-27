// Start running code on page load
window.onload = function() {
  initializeSite();
};

const ADMIN_API = "https://music-grid-io-42616e204fd3.herokuapp.com";

// Admin-only endpoints need the ADMIN_KEY config var from Heroku, sent as a header
function adminHeaders() {
  return { "Content-Type": "application/json", "x-admin-key": localStorage.getItem("musicgrid:adminKey") || "" };
}

async function adminFetch(path, options) {
  const response = await fetch(ADMIN_API + path, Object.assign({ headers: adminHeaders() }, options || {}));
  if (response.status === 401) throw new Error("Admin key is missing or wrong. Paste ADMIN_KEY from your Heroku config vars above.");
  if (!response.ok) throw new Error(path + " failed with " + response.status);
  return response.json();
}

function toolOutput(text) {
  document.getElementById("toolOutput").textContent = text;
}

// Log functionality and ask to fetch grid summary
function initializeSite() {
  console.log("Initializing Site");
  const keyInput = document.getElementById("adminKey");
  keyInput.value = localStorage.getItem("musicgrid:adminKey") || "";
  document.getElementById("saveKey").addEventListener("click", () => {
    localStorage.setItem("musicgrid:adminKey", keyInput.value.trim());
    document.getElementById("keyNote").textContent = "Saved in this browser";
    loadModerationLog();
  });
  document.getElementById("retitleBtn").addEventListener("click", retitleCustomGrids);
  document.getElementById("gridFile").addEventListener("change", loadGridFile);
  document.getElementById("checkGrids").addEventListener("click", checkGrids);
  document.getElementById("createGrids").addEventListener("click", createGrids);
  document.getElementById("gridJson").addEventListener("input", () => { document.getElementById("createGrids").disabled = true; });
  document.getElementById("screenBtn").addEventListener("click", screenLeaderboard);
  document.getElementById("checkAnswers").addEventListener("click", checkAnswers);
  loadGridData();
  loadCalendar();
  loadModerationLog();
}

let calendarData = null;
let checkedGrids = null;
let gridSummary = [];
let checkRun = 0;

// ---------- Add daily grids (paste or upload JSON) ----------

function loadGridFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById("gridJson").value = reader.result;
    checkGrids();
  };
  reader.readAsText(file);
}

function gridProblems(grid, index) {
  const where = "Grid " + (index + 1);
  const problems = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(grid.date || "")) problems.push(where + ": date must look like 2026-11-03");
  ["artists", "categories"].forEach(key => {
    if (!Array.isArray(grid[key]) || grid[key].length !== 3) problems.push(where + ": needs exactly 3 " + key);
  });
  if (!problems.length) {
    grid.categories.forEach(category => {
      grid.artists.forEach(artist => {
        const songs = grid.answers && grid.answers[category] && grid.answers[category][artist];
        if (!Array.isArray(songs) || !songs.length) problems.push(where + ": no answers for " + artist + " / " + category);
        else if (songs.some(song => String(song).includes("\""))) problems.push(where + ": an answer for " + artist + " / " + category + " contains a double quote");
      });
    });
  }
  return problems;
}

// The grid summary joins names with ", " (and names can contain commas),
// so check that every name is in there and nothing else is
function sameNames(joined, names) {
  const text = String(joined || "").toLowerCase();
  const wanted = names.map(name => String(name).trim().toLowerCase());
  const length = wanted.reduce((sum, name) => sum + name.length, 0) + 2 * (wanted.length - 1);
  return text.length === length && wanted.every(name => text.includes(name));
}

function findDuplicate(grid) {
  return gridSummary.find(row => sameNames(row.num_artist_cells, grid.artists) && sameNames(row.num_category_cells, grid.categories));
}

// Artists with no song clips anywhere can't use easy mode, so daily grids skip them
async function clipCheck(artists) {
  const results = {};
  for (let i = 0; i < artists.length; i += 12) {
    try {
      const data = await adminFetch("/artist-clips", { method: "POST", body: JSON.stringify({ artists: artists.slice(i, i + 12) }) });
      data.artists.forEach(item => { results[item.name.trim().toLowerCase()] = item.clips; });
    } catch (error) {
      // Older server or a hiccup: leave these unknown
    }
  }
  return results;
}

async function checkGrids() {
  const run = ++checkRun;
  const preview = document.getElementById("gridPreview");
  const createButton = document.getElementById("createGrids");
  createButton.disabled = true;
  checkedGrids = null;
  preview.innerHTML = "";
  let parsed;
  try {
    parsed = JSON.parse(document.getElementById("gridJson").value);
  } catch (error) {
    preview.textContent = "That isn't valid JSON: " + error.message;
    return;
  }
  const grids = Array.isArray(parsed) ? parsed : parsed.grids;
  if (!Array.isArray(grids) || !grids.length) {
    preview.textContent = "Expected { \"grids\": [ ... ] } with at least one grid.";
    return;
  }
  const problems = [].concat(...grids.map(gridProblems));
  if (problems.length) {
    preview.textContent = problems.join("\n");
    return;
  }

  toolOutput("Checking song clips for each artist…");
  const artists = [...new Set([].concat(...grids.map(grid => grid.artists.map(name => name.trim()))))];
  const [clips, calendar] = await Promise.all([
    clipCheck(artists),
    fetch(ADMIN_API + "/grid-calendar?days=90", { headers: adminHeaders() }).then(r => r.json()).catch(() => calendarData)
  ]);
  if (run !== checkRun) return;

  const today = calendar ? calendar.today : "";
  const uploadDays = new Set(grids.map(grid => grid.date));
  const ready = [];
  const skipped = [];
  grids.forEach(grid => {
    const box = document.createElement("div");
    box.className = "grid-preview";
    const date = new Date(grid.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const heading = document.createElement("b");
    heading.textContent = date + ": " + (grid.title || "Untitled grid");
    box.appendChild(heading);

    const stops = [];
    const notes = [];
    const noClips = grid.artists.filter(name => clips[name.trim().toLowerCase()] === false);
    const unknown = grid.artists.filter(name => clips[name.trim().toLowerCase()] === undefined || clips[name.trim().toLowerCase()] === null);
    if (noClips.length) stops.push(noClips.join(" and ") + (noClips.length === 1 ? " has" : " have") + " no song clips, so easy mode wouldn't work");
    const duplicate = findDuplicate(grid);
    if (duplicate) stops.push("this grid is already uploaded as grid " + duplicate.grid_id);
    if (unknown.length) notes.push("couldn't check song clips for " + unknown.join(", "));
    if (today && grid.date < today) notes.push("this date is in the past");
    const taken = calendar && calendar.calendar && calendar.calendar.find(day => day.date === grid.date && day.scheduled && !day.rerun);
    if (taken && grid.date > today) {
      // The server moves the old grid to the next open day
      let next = new Date(grid.date + "T00:00:00Z");
      let nextDay = "";
      do {
        next = new Date(next.getTime() + 86400000);
        nextDay = next.toISOString().slice(0, 10);
      } while (uploadDays.has(nextDay) || (calendar.calendar.find(day => day.date === nextDay && day.scheduled && !day.rerun)));
      const label = new Date(nextDay + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      notes.push((taken.title || "grid " + taken.grid_id) + " is already on this day and will move to " + label);
    } else if (taken) {
      notes.push("grid " + taken.grid_id + " already plays that day; the new one will win");
    }
    [[stops, "grid-stop", "Won't be created: "], [notes, "grid-warn", "Heads up: "]].forEach(([list, cls, lead]) => {
      if (!list.length) return;
      const line = document.createElement("div");
      line.className = cls;
      line.textContent = lead + list.join("; ");
      box.appendChild(line);
    });

    const table = document.createElement("table");
    const head = document.createElement("tr");
    head.appendChild(document.createElement("th"));
    grid.artists.forEach(artist => {
      const th = document.createElement("th");
      const mark = clips[artist.trim().toLowerCase()];
      th.textContent = artist + (mark === true ? " ✓ clips" : mark === false ? " ✗ no clips" : "");
      head.appendChild(th);
    });
    table.appendChild(head);
    grid.categories.forEach(category => {
      const row = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = category;
      row.appendChild(th);
      grid.artists.forEach(artist => {
        const songs = grid.answers[category][artist];
        const td = document.createElement("td");
        td.textContent = songs.length + (songs.length === 1 ? " answer" : " answers");
        td.title = songs.join(", ");
        row.appendChild(td);
      });
      table.appendChild(row);
    });
    box.appendChild(table);
    if (stops.length) box.classList.add("is-skipped");
    preview.appendChild(box);
    (stops.length ? skipped : ready).push(grid);
  });
  checkedGrids = ready.length ? ready : null;
  createButton.disabled = !ready.length;
  const summary = ready.length + (ready.length === 1 ? " grid is" : " grids are") + " ready to create."
    + (skipped.length ? " " + skipped.length + " won't be created (see the red notes)." : "")
    + " Hover a count to see the answers.";
  toolOutput(summary);
}

async function createGrids() {
  if (!checkedGrids) return;
  const createButton = document.getElementById("createGrids");
  createButton.disabled = true;
  try {
    const data = await adminFetch("/admin/create-grids", { method: "POST", body: JSON.stringify({ grids: checkedGrids }) });
    const lines = data.created.map(grid => "Created grid " + grid.grid_id + " for " + grid.date + (grid.title ? " (" + grid.title + ")" : ""));
    (data.moved || []).forEach(grid => lines.push("Moved grid " + grid.grid_id + (grid.title ? " (" + grid.title + ")" : "") + " from " + grid.from + " to " + grid.to));
    toolOutput(lines.join("\n") + "\nScoring answers now. This takes a minute or two per grid, so leave this tab open.");
    loadGridData();
    loadCalendar();
    for (let i = 0; i < data.created.length; i++) {
      const grid = data.created[i];
      lines.push("Scoring grid " + grid.grid_id + " (" + (i + 1) + " of " + data.created.length + ")…");
      toolOutput(lines.join("\n"));
      const ok = await encodeAnswers(grid.grid_id);
      lines[lines.length - 1] = ok ? "Scored grid " + grid.grid_id : "Scoring grid " + grid.grid_id + " failed; use its Encode button to retry";
      toolOutput(lines.join("\n"));
    }
    lines.push("All done.");
    toolOutput(lines.join("\n"));
    document.getElementById("gridJson").value = "";
    document.getElementById("gridPreview").innerHTML = "";
    checkedGrids = null;
    loadGridData();
  } catch (error) {
    toolOutput(error.message);
    createButton.disabled = false;
  }
}

// Which grid plays on each of the next three weeks
async function loadCalendar() {
  const holder = document.getElementById("calendar");
  try {
    const response = await fetch(ADMIN_API + "/grid-calendar?days=21", { headers: adminHeaders() });
    const data = await response.json();
    calendarData = data;
    const idBox = document.getElementById("answerGridId");
    if (idBox && !idBox.value && data.calendar[0] && data.calendar[0].grid_id) idBox.value = data.calendar[0].grid_id;
    holder.innerHTML = "";
    data.calendar.forEach(day => {
      const row = document.createElement("div");
      row.className = "cal-row" + (day.scheduled ? "" : " cal-repeat");
      const date = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const details = (day.title ? ": " + day.title : "") + (day.artists ? " (" + day.artists + ")" : "");
      let what;
      if (day.rerun && day.grid_id === null) what = "Nothing scheduled, so an older grid reruns (picked at midnight)";
      else if (day.grid_id === null) what = "Nothing scheduled";
      else if (day.rerun) what = "Rerun of grid " + day.rerun_of + " as grid " + day.grid_id + details;
      else what = (day.scheduled ? "Grid " + day.grid_id : "Repeats grid " + day.grid_id) + details;
      row.textContent = date + (day.date === data.today ? " (today)" : "") + " \u2014 " + what;
      holder.appendChild(row);
    });
  } catch (error) {
    holder.textContent = "Calendar didn't load: " + error.message;
  }
}

async function scheduleGrid(gridId, day) {
  try {
    await adminFetch("/schedule-grid", { method: "POST", body: JSON.stringify({ grid_id: gridId, reporting_day: day }) });
    toolOutput("Grid " + gridId + " scheduled for " + day);
    loadGridData();
    loadCalendar();
  } catch (error) {
    toolOutput(error.message);
  }
}

async function retitleCustomGrids() {
  toolOutput("Retitling custom grids, this can take a minute…");
  try {
    const data = await adminFetch("/admin/retitle-custom-grids", { method: "POST", body: JSON.stringify({ limit: 20 }) });
    const lines = data.updated.map(grid => "#" + grid.custom_grid_id + ": " + grid.title);
    toolOutput((lines.length ? lines.join("\n") : "No grids needed new titles.") + (data.remaining ? "\n" + data.remaining + " left, click again to keep going." : ""));
  } catch (error) {
    toolOutput(error.message);
  }
}

async function screenLeaderboard() {
  toolOutput("Screening leaderboard names…");
  try {
    const data = await adminFetch("/admin/screen-leaderboard", { method: "POST", body: "{}" });
    toolOutput("Checked " + data.scanned + " names, renamed " + data.renamed.length + ".");
    loadModerationLog();
  } catch (error) {
    toolOutput(error.message);
  }
}

async function loadModerationLog() {
  const holder = document.getElementById("modLog");
  try {
    const rows = await adminFetch("/admin/moderation-log");
    holder.innerHTML = "";
    if (!rows.length) {
      holder.textContent = "No names have been changed.";
      return;
    }
    rows.forEach(entry => {
      const row = document.createElement("div");
      row.className = "cal-row";
      row.textContent = entry.original_name + " \u2192 " + entry.player_name + " (" + entry.moderation_reason + ", grid " + entry.owning_grid_id + ")";
      holder.appendChild(row);
    });
  } catch (error) {
    holder.textContent = error.message;
  }
}

// Grab summary of all grids entered from Heroku
function loadGridData() {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/fetch-grid-summary")
    .then(response => response.json())
    .then(data => {
      console.log("Grid data summary dump fetched");
      gridSummary = Array.isArray(data) ? data : [];
      displayGridsSumm(data);
    })
    .catch(error => console.error("Error fetching live grid id:", error));
}

// Display fetched grid summary data
function displayGridsSumm(data) {
  const gridContainer = document.getElementById("data-dump");
  gridContainer.innerHTML = ""; // Clear existing content
  
  const summRow = document.createElement("div");
  summRow.classList.add("row");
  summRow.appendChild(createCell("cellheader","Grid ID"));
  summRow.appendChild(createCell("cellheader","Grid Created Date"));
  summRow.appendChild(createCell("cellheader","Grid Post Date"));
  summRow.appendChild(createCell("cellheader","Answers Updated PST"));
  summRow.appendChild(createCell("cellheader","Artists"));
  summRow.appendChild(createCell("cellheader","Categories"));
  summRow.appendChild(createCell("cellheader","Num Raw Answers"));
  summRow.appendChild(createCell("cellheader","Num Encoded Answers"));
  summRow.appendChild(createCell("cellheader","Num Field W Encoded Answer"));
  summRow.appendChild(createCell("cellheader","Load Grid"));
  summRow.appendChild(createCell("cellheader","Encode Answers"));
  summRow.appendChild(createCell("cellheader","Play Today"));
  summRow.appendChild(createCell("cellheader","Schedule"));
  gridContainer.appendChild(summRow);
  
  data.forEach(item => {
    //Create summary row for each
    console.log("Creating summary row for id: "+item.grid_id);
    const summRow = document.createElement("div");
    summRow.classList.add("row");
    summRow.appendChild(createCell("genre-header",item.grid_id));
    summRow.appendChild(createCell("summCell",String(item.create_date || "").slice(0, 10)));
    summRow.appendChild(createCell("summCell",String(item.post_date || "").slice(0, 10)));
    summRow.appendChild(createCell("summCell",String(item.answers_last_updated_pst || "").slice(0, 16).replace("T", " ")));
    summRow.appendChild(createCell("summCell",item.num_artist_cells));
    summRow.appendChild(createCell("summCellLong",item.num_category_cells));
    summRow.appendChild(createCell("summCell",item.num_raw_answer_cells));
    summRow.appendChild(createCell("summCell",item.num_encoded_answer));
    summRow.appendChild(createCell("summCell",item.num_fields_w_encoded_answers));
    summRow.appendChild(createLoadCell("loadCell","fetchGridData","Load grid id "+item.grid_id,item.grid_id));
    summRow.appendChild(createLoadCell("loadCell","encodeAnswers","Encode grid id "+item.grid_id,item.grid_id));
    summRow.appendChild(createLoadCell("loadCell","setLive","Play grid "+item.grid_id+" today",item.grid_id));
    summRow.appendChild(createScheduleCell(item.grid_id, item.post_date));
    gridContainer.appendChild(summRow);
  });
}

// Generic cell creator
function createCell(className, text = "") {
  const cell = document.createElement("div");
  cell.classList.add("cell", className);
  cell.textContent = text;
  return cell;
}

// Button creator to load grid data
function createLoadCell(className, calledFunction, text = "", params = "") {
  const cell = document.createElement("div");
  cell.classList.add("cell", "song-cell");
  const button = document.createElement("input");
  button.type = "button";
  button.setAttribute("value", text);
  button.setAttribute("onclick", calledFunction+"("+params+")");
  cell.appendChild(button);
  return cell;
}

// Get data to populate a selected MusicGrid
function fetchGridData(gridId) {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/grid-data", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ grid_id: gridId })
  })
    .then(response => response.json())
    .then(data => buildGrid(data))
    .catch(error => console.error("Error fetching grid data:", error));
}

// Date picker + save button for a grid's play date
function createScheduleCell(gridId, postDate) {
  const cell = document.createElement("div");
  cell.classList.add("cell", "song-cell");
  const input = document.createElement("input");
  input.type = "date";
  if (postDate) input.value = String(postDate).slice(0, 10);
  const button = document.createElement("input");
  button.type = "button";
  button.value = "Save date";
  button.addEventListener("click", () => scheduleGrid(gridId, input.value));
  cell.appendChild(input);
  cell.appendChild(button);
  return cell;
}

// Play a grid today. Grids scheduled for later days still take over then.
async function setLive(gridId) {
  try {
    await adminFetch("/set-grid-live", { method: "POST", body: JSON.stringify({ grid_id: gridId }) });
    toolOutput("Grid " + gridId + " is playing today");
    loadGridData();
    loadCalendar();
  } catch (error) {
    toolOutput(error.message);
  }
}

function buildGrid(data) {
  const gridContainer = document.getElementById("grid-container");
  gridContainer.innerHTML = ""; // Clear existing content

  // Separate the data into categories, artists, and answers
  const categories = {};
  const artists = {};
  const answers = {};

  data.forEach(item => {
    if (item.field_type === "Category") {
      categories[item.field] = item.field_value;
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
    } else if (item.field_type === "Answer") {
      answers[item.field] = item.field_value.split(", ").map(answer => answer.replace(/"/g, ""));
    }
  });

  // Create artist row
  const artistRow = document.createElement("div");
  artistRow.classList.add("row");
  artistRow.appendChild(createCell("invisible")); // Invisible cell for alignment
  Object.keys(artists).forEach(key => artistRow.appendChild(createCell("artist", artists[key])));
  gridContainer.appendChild(artistRow);

  // Create rows for each category
  Object.keys(categories).forEach(categoryKey => {
    const categoryRow = document.createElement("div");
    categoryRow.classList.add("row");

    // Category cell
    categoryRow.appendChild(createCell("genre-header", categories[categoryKey]));

    // Song cells
    console.log("Appending answer cells");
    Object.keys(artists).forEach(artistKey => {
      const cellKey = `${categoryKey} ${artistKey}`;
      console.log("Gen answers for: "+cellKey);
      const songAnswers = answers[cellKey] || [];
      console.log("Gen answers for parsed: "+cellKey);
      categoryRow.appendChild(createCell("song-cell", `${JSON.stringify(songAnswers)}`));
      console.log("Appended "+songAnswers);
      console.log(`Appended parsed ${JSON.stringify(songAnswers)}`);
    });

    gridContainer.appendChild(categoryRow);
  });
}

// Get answer data to encode
async function encodeAnswers(gridId) {
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/grid-data", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ grid_id: gridId })
    });

    const data = await response.json();
    return await answerEncoder(data, gridId);
  } catch (error) {
    console.error("Error encoding answers for grid:", error);
    return false;
  }
}

async function answerEncoder(data, gridId) {
  console.log("Parsing grid data for grid ID:", gridId);
  const answersUnscored = {};
  const artists = {};

  // Parse the answers and artists from the data
  data.forEach(item => {
    if (item.field_type === "Answer") {
      answersUnscored[item.field] = item.field_value.split("\", \"").map(answer => answer.trim().replace(/^'|'$/g, ""));
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
    }
  });

  const answerPops = {};
  for (const [fieldKey, songs] of Object.entries(answersUnscored)) {
    const nestedSongPops = [];
    const [category, artistKey] = fieldKey.split(" ");
    const artistName = artists[artistKey];

    for (const songData of songs) {
      let songParsed = songData;
      if (songParsed.slice(0,1) == "\"") {
        songParsed = songParsed.slice(1,songParsed.length);
      }
      if (songParsed.slice(songParsed.length-1,songParsed.length) == "\"") {
        songParsed = songParsed.slice(0,songParsed.length-1);
      }
      try {
        const searchTerm = `${songParsed}`; 
        const artistSearch = `${artistName}`;
        console.log(`Fetching data for ${searchTerm} by ${artistSearch}`);
        const resultsObj = await searchSpotify(searchTerm, artistSearch);
        console.log("Received passback resultsObj");
        console.dir(resultsObj);
        console.log(resultsObj.popularity);
        console.log(resultsObj.preview_url);
        const popularity = resultsObj.popularity || -1;
        const previewUrl = resultsObj.preview_url || "";
        nestedSongPops.push({ song: songParsed, popularity, previewUrl });
      } catch (error) {
        console.error("Error fetching Spotify data for song:", songParsed, error);
      }
    }
    answerPops[fieldKey] = nestedSongPops;
  }

  console.log("Encoded answers ready for update:", answerPops);
  return calculateAnswerScores(answerPops, gridId);
}

// TODO: Check for all matching song names by artist (bypass track limitation) and pick most popular version
async function searchSpotify(searchTerm, artistSearch) {
  let easyModeBool = true;
  let encoderReq = true;
  const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/search-encoding-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchTerm, easyModeBool, artistSearch, encoderReq })
  });
  console.log("Received response: "+response);
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
}

// Calculate how many points each answer will be worth
async function calculateAnswerScores(answersUnscored, gridId) {
  console.log("Calculating answer scores for Answer pops");
  let gridIdString = gridId.toString();
  const answersWithScores = [];

  for (const [fieldKey, nestedSongPopsArr] of Object.entries(answersUnscored)) {
    console.log(`Calculating scores for ${fieldKey}`);
    const filteredSongPopsArr = [];
    for (const songPopElement of nestedSongPopsArr) {
      if(songPopElement.popularity > 0) {
        filteredSongPopsArr.push(songPopElement);
      }
    }
    // Calculate max and min popularity in the field
    let fieldScoreMax = Math.max(...filteredSongPopsArr.map(o => o.popularity));
    let fieldScoreMin = Math.min(...filteredSongPopsArr.map(o => o.popularity));

    // Calculate scores for each song
    for (const { song, popularity, previewUrl } of nestedSongPopsArr) {
      let normedAnswerScore = 11;
      if( popularity == -1 ) {
        normedAnswerScore = 11;
      } else {
        normedAnswerScore = (fieldScoreMin === fieldScoreMax) ? 11 : 6 + 5 * Math.round(10 * (1 - ((popularity - fieldScoreMin) / (fieldScoreMax - fieldScoreMin)))) / 10;
      }
      answersWithScores.push({
        fieldKey,
        song,
        popularity,
        normedAnswerScore,
        previewUrl,
        gridId: gridIdString
      });
    }
  }

  return updateEncodedAnswers(answersWithScores);
}


async function updateEncodedAnswers(encodedAnswers) {
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/update-encoded-answers", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ encodedAnswers })
    });

    if (!response.ok) {
      throw new Error("Failed to update encoded answers");
    }

    console.log("Encoded answers updated successfully");
    return true;
  } catch (error) {
    console.error("Error updating encoded answers:", error);
    return false;
  }
}


// ---------- Answers and song clips for one grid ----------

async function checkAnswers() {
  const kind = document.getElementById("answerKind").value;
  const gridId = document.getElementById("answerGridId").value.trim();
  const report = document.getElementById("answerReport");
  if (!gridId) {
    report.textContent = "Enter a grid id (today's is filled in from the calendar).";
    return;
  }
  report.textContent = "Checking each square. Finding clips can take a few seconds…";
  try {
    const data = await adminFetch("/admin/grid-answers", { method: "POST", body: JSON.stringify({ kind, grid_id: gridId }) });
    report.innerHTML = "";
    if (!data.squares.length) {
      report.textContent = "That grid has no scored answers.";
      return;
    }
    data.squares.forEach(square => {
      const box = document.createElement("div");
      box.className = "answer-square";
      const head = document.createElement("h3");
      head.textContent = square.artist + " \u00d7 " + square.category + " (" + square.field + ")";
      box.appendChild(head);
      const clip = document.createElement("div");
      if (square.clip) {
        clip.className = "clip-ok";
        clip.append("Hint clip found (" + square.clip.source + "): ");
        const link = document.createElement("a");
        link.href = square.clip.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "listen";
        clip.appendChild(link);
      } else {
        clip.className = "clip-missing";
        const tried = square.tried.map(item => item.song).join(", ");
        clip.textContent = "No hint clip found" + (tried ? " (tried " + tried + ")" : "") + ". Easy mode can't hint this square.";
      }
      box.appendChild(clip);
      const list = document.createElement("div");
      square.answers.forEach(answer => {
        const chip = document.createElement("span");
        chip.className = "answer-chip";
        chip.append(answer.song + " \u00b7 " + answer.points);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "\u00d7";
        remove.setAttribute("aria-label", "Remove " + answer.song);
        remove.addEventListener("click", () => removeAnswer(kind, gridId, square.field, answer.song, chip));
        chip.appendChild(remove);
        list.appendChild(chip);
      });
      box.appendChild(list);
      report.appendChild(box);
    });
  } catch (error) {
    report.textContent = error.message;
  }
}

async function removeAnswer(kind, gridId, field, song, chip) {
  if (!window.confirm("Remove \"" + song + "\" as an answer for this square?")) return;
  try {
    const data = await adminFetch("/admin/remove-answer", { method: "POST", body: JSON.stringify({ kind, grid_id: gridId, field, song }) });
    chip.remove();
    toolOutput("Removed \"" + song + "\" from " + (data.grids.length === 1 ? "grid " : "grids ") + data.grids.join(", "));
  } catch (error) {
    toolOutput(error.message);
  }
}
