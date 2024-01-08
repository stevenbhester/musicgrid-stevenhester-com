// Call this function when the page loads to display the leaderboard
window.onload = function() {
  initializeSite();
};

function initializeSite() {
  console.log("Initializing Site");
  console.log("Loading grid");
  loadGridData();
}

// Add submitted game + username to leaderboard, let"s not worry about sanitizing for now as there"s not much to hack
function loadGridData() {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/fetch-grid-summary")
    .then(response => response.json())
    .then(data => {
      console.log("Grid data summary dump fetched");
      displayGridsSumm(data);
    })
    .catch(error => console.error("Error fetching live grid id:", error));
}

function displayGridsSumm(data) {
  const gridContainer = document.getElementById("data-dump");
  gridContainer.innerHTML = ""; // Clear existing content

 <div class="row">
            <div class="cell cellheader">Grid ID</div>
            <div class="cell cellheader">Grid Created Date</div>
            <div class="cell cellheader">Grid Post Date</div>
            <div class="cell cellheader">Answers Updated PST</div>
            <div class="cell cellheader">Num Artists</div>
            <div class="cell cellheader">Num Categories</div>
            <div class="cell cellheader">Num Raw Answers</div>
            <div class="cell cellheader">Num Encoded Answers</div>
            <div class="cell cellheader">Num Field W Encoded Answer</div>
            <div class="cell cellheader">Load Grid</div>
        </div>
  const summHeader - document.createElement("div");
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

function createCell(className, text = "") {
  const cell = document.createElement("div");
  cell.classList.add("cell", className);
  cell.textContent = text;
  return cell;
}

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
