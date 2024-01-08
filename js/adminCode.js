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