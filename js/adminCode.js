// Start running code on page load
window.onload = function() {
  initializeSite();
};

// Log functionality and ask to fetch grid summary
function initializeSite() {
  console.log("Initializing Site");
  console.log("Loading grid");
  loadGridData();
}

// Grab summary of all grids entered from Heroku
function loadGridData() {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/fetch-grid-summary")
    .then(response => response.json())
    .then(data => {
      console.log("Grid data summary dump fetched");
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
  gridContainer.appendChild(summRow);
  
  data.forEach(item => {
    //Create summary row for each
    console.log("Creating summary row for id: "+item.grid_id);
    const summRow = document.createElement("div");
    summRow.classList.add("row");
    summRow.appendChild(createCell("genre-header",item.grid_id));
    summRow.appendChild(createCell("summCell",item.create_date));
    summRow.appendChild(createCell("summCell",item.post_date));
    summRow.appendChild(createCell("summCell",item.answers_last_updated_pst));
    summRow.appendChild(createCell("summCell",item.num_artist_cells));
    summRow.appendChild(createCell("summCell",item.num_category_cells));
    summRow.appendChild(createCell("summCell",item.num_raw_answer_cells));
    summRow.appendChild(createCell("summCell",item.num_encoded_answer));
    summRow.appendChild(createCell("summCell",item.num_fields_w_encoded_answers));
    summRow.appendChild(createLoadCell("loadCell","fetchGridData","Load grid id "+item.grid_id,item.grid_id));
    summRow.appendChild(createLoadCell("loadCell","encodeAnswers","Encode grid id "+item.grid_id,item.grid_id));
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grid_id: gridId })
  })
    .then(response => response.json())
    .then(data => buildGrid(data))
    .catch(error => console.error("Error fetching grid data:", error));
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid_id: gridId })
    });

    const data = await response.json();
    await answerEncoder(data, gridId);
  } catch (error) {
    console.error("Error encoding answers for grid:", error);
  }
}

async function answerEncoder(data, gridId) {
  console.log("Parsing grid data for grid ID:", gridId);
  const answersUnscored = {};
  const artists = {};

  // Parse the answers and artists from the data
  data.forEach(item => {
    if (item.field_type === "Answer") {
      answersUnscored[item.field] = item.field_value.split(", ").map(answer => answer.trim().replace(/^'|'$/g, ""));
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
      let songParsed = songData.slice(1,songData.length -1);
      try {
        const searchTerm = `${songParsed} by ${artistName}`; // Combines song name and artist
        console.log(`Fetching data for ${searchTerm}`);
        const { popularity, previewUrl } = await searchSpotify(searchTerm);
        if (popularity !== null) {
          nestedSongPops.push({ song: songParsed, popularity, previewUrl });
        }
      } catch (error) {
        console.error("Error fetching Spotify data for song:", songParsed, error);
      }
    }
    answerPops[fieldKey] = nestedSongPops;
  }

  console.log("Encoded answers ready for update:", answerPops);
  calculateAnswerScores(answerPops, gridId);
}

// TODO: Check for all matching song names by artist (bypass track limitation) and pick most popular version
async function searchSpotify(searchTerm) {
  let easyModeBool = true;
  try {
    console.log("Searching for " + searchTerm);
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchTerm, easyModeBool })
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Spotify data for: " + searchTerm);
    }

    const songs = await response.json();
    if (songs.length > 0) {
      const firstSong = songs[0];
      return {
        popularity: firstSong.popularity,
        previewUrl: firstSong.preview_url
      };
    }

    return { popularity: null, previewUrl: null };
  } catch (error) {
    console.error("Error in searchSpotify:", error);
    return { popularity: null, previewUrl: null };
  }
}

// Calculate how many points each answer will be worth
async function calculateAnswerScores(answersUnscored, gridId) {
  console.log("Calculating answer scores for Answer pops");
  let gridIdString = gridId.toString();
  const answersWithScores = [];

  for (const [fieldKey, nestedSongPopsArr] of Object.entries(answersUnscored)) {
    console.log(`Calculating scores for ${fieldKey}`);

    // Calculate max and min popularity in the field
    let fieldScoreMax = Math.max(...nestedSongPopsArr.map(o => o.popularity));
    let fieldScoreMin = Math.min(...nestedSongPopsArr.map(o => o.popularity));

    // Calculate scores for each song
    for (const { song, popularity, previewUrl } of nestedSongPopsArr) {
      let normedAnswerScore = (fieldScoreMin === fieldScoreMax) ? 11 : 6 + 5 * Math.round(10 * (1 - ((popularity - fieldScoreMin) / (fieldScoreMax - fieldScoreMin)))) / 10;

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

  await updateEncodedAnswers(answersWithScores);
}


async function updateEncodedAnswers(encodedAnswers) {
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/update-encoded-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encodedAnswers })
    });

    if (!response.ok) {
      throw new Error("Failed to update encoded answers");
    }

    console.log("Encoded answers updated successfully");
  } catch (error) {
    console.error("Error updating encoded answers:", error);
  }
}

