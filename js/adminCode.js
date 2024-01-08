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
  summRow.appendChild(createCell("cell cellheader","Grid ID"));
  summRow.appendChild(createCell("cell cellheader","Grid Created Date"));
  summRow.appendChild(createCell("cell cellheader","Grid Post Date"));
  summRow.appendChild(createCell("cell cellheader","Answers Updated PST"));
  summRow.appendChild(createCell("cell cellheader","Artists"));
  summRow.appendChild(createCell("cell cellheader","Categories"));
  summRow.appendChild(createCell("cell cellheader","Num Raw Answers"));
  summRow.appendChild(createCell("cell cellheader","Num Encoded Answers"));
  summRow.appendChild(createCell("cell cellheader","Num Field W Encoded Answer"));
  summRow.appendChild(createCell("cell cellheader","Load Grid"));
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
    summRow.appendChild(createLoadCell("loadCell",item.grid_id));
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
function createLoadCell(className, text = "") {
  const cell = document.createElement("div");
  cell.classList.add("cell", "song-cell");
  const button = document.createElement("input");
  button.type = "button";
  button.setAttribute("value", "Load grid id "+text);
  button.setAttribute("onclick", "loadGrid("+text+")");
  cell.appendChild(button);
  return cell;
}

// Get data to populate a selected MusicGrid
function fetchGridData(gridId) {
  fetch('https://music-grid-io-42616e204fd3.herokuapp.com/grid-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grid_id: gridId })
      })
      .then(response => response.json())
      .then(data => buildGrid(data))
      .catch(error => console.error('Error fetching grid data:', error))
}

function buildGrid(data) {
  const gridContainer = document.getElementById('grid-container');
  gridContainer.innerHTML = ''; // Clear existing content

  // Separate the data into categories, artists, and answers
  const categories = {};
  const artists = {};
  const answers = {};

  data.forEach(item => {
      if (item.field_type === 'Category') {
          categories[item.field] = item.field_value;
      } else if (item.field_type === 'Artist') {
          artists[item.field] = item.field_value;
      } else if (item.field_type === 'Answer') {
          answers[item.field] = item.field_value.split(', ').map(answer => answer.replace(/'/g, ""));
      }
  });

  // Create artist row
  const artistRow = document.createElement('div');
  artistRow.classList.add('row');
  artistRow.appendChild(createCell('invisible')); // Invisible cell for alignment
  Object.keys(artists).forEach(key => artistRow.appendChild(createCell('artist', artists[key])));
  gridContainer.appendChild(artistRow);

  // Create rows for each category
  Object.keys(categories).forEach(categoryKey => {
      const categoryRow = document.createElement('div');
      categoryRow.classList.add('row');

      // Category cell
      categoryRow.appendChild(createCell('genre-header', categories[categoryKey]));

      // Song cells
      Object.keys(artists).forEach(artistKey => {
          const cellKey = `${categoryKey} ${artistKey}`;
          const songAnswers = answers[cellKey] || [];
          categoryRow.appendChild(createCell('song-cell', songAnswers));
      });

      gridContainer.appendChild(categoryRow);
  });
}
