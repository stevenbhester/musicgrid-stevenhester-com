// You get one point just for being here
let totalScore = 1; 

// Guesses don"t last forever...
let guessTotal = 10;

// How good are ya really?
let correctGuesses = 0;

// What grid are we goofin around with?
let gridId = 0;

// Call this function when the page loads to display the leaderboard
window.onload = function() {
  initializeSite();
};

function initializeSite() {
  console.log("Initializing Site");
  console.log("Loading grid");
  loadGrid();
}

// Add submitted game + username to leaderboard, let"s not worry about sanitizing for now as there"s not much to hack
function loadGrid() {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/latest-grid")
    .then(response => response.json())
    .then(data => {
      gridId = data.latestGridId;
      // Now we use latestGridId to fetch and display the corresponding grid
      console.log("Grid ID determined as "+gridId);
      console.log("Fetching Grid Data");
      fetchGridData(gridId);
    })
    .catch(error => console.error("Error fetching live grid id:", error));
}

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

  data.forEach(item => {
    if (item.field_type === "Category") {
      categories[item.field] = item.field_value;
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
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
    Object.keys(artists).forEach(artistKey => {
      const cellKey = `${categoryKey} ${artistKey}`;
      categoryRow.appendChild(createSongCell(cellKey));
    });

    gridContainer.appendChild(categoryRow);
  });

  // Now build the leaderboars
  loadLeaderboard();
}

function createCell(className, text = "") {
  const cell = document.createElement("div");
  cell.classList.add("cell", className);
  cell.textContent = text;
  return cell;
}

function createSongCell(cellKey) {
  const cell = document.createElement("div");
  cell.classList.add("cell", "song-cell");
  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("oninput", `liveSearch(this, "${cellKey}")`);
  input.setAttribute("placeholder", "Type to search...");
  cell.appendChild(input);
  return cell;
}

function loadLeaderboard() {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lb_id: gridId })
  })
    .then(response => response.json())
    .then(scores => {
      console.log("Selecting leaderboard div");
      const leaderboardList = document.getElementById("leaderboardList");
      leaderboardList.innerHTML = ""; // Clear existing list
      scores.forEach(({ rank, player_name, player_score }) => {
        console.log("Creating leaderboard entry: "+rank+": "+player_name+" ("+player_score+")");
        const entry = document.createElement("li");
        entry.textContent = `#${rank}: ${player_name} (${player_score})`;
        console.log("Appending entry");
        leaderboardList.appendChild(entry);
      });
      console.log("Done appending");
    })
    .catch(error => console.error("Error:", error));
}

function liveSearch(inputElement, cellKey) {
  if (inputElement.value.length > 2) {
    console.log("Requesting search for "+inputElement.value);
    searchSpotify(inputElement.value)
      .then(songs => displaySpotifyResults(songs, inputElement, cellKey))
      .catch(error => console.error("Error fetching Spotify data:", error));
  } else {
    removeDropdown(inputElement);
  }
}

async function searchSpotify(searchTerm) {
  console.log("Searching for "+searchTerm);
  const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchTerm })
  });
  console.log("Received response: "+response);
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
}

function displaySpotifyResults(songs, inputElement, cellKey) {
  removeDropdown(inputElement); // Remove existing dropdown if present
  console.log("Creating results container");
  const resultsContainer = document.createElement("div");
  resultsContainer.className = "results-dropdown";
  resultsContainer.style.top = "100%"; 
  resultsContainer.style.left = "0";
  console.log("Populating results container");
  songs.forEach(song => {
    const songElement = document.createElement("div");
    const songTitleSpan = document.createElement("span");
    console.log("Populating "+song.name);
    songTitleSpan.className = "song-title"; // Apply bold styling to the song title
    songTitleSpan.textContent = song.name;
    songElement.appendChild(songTitleSpan);
    songElement.innerHTML += ` by ${song.artists.map(artist => artist.name).join(", ")}`; // Add artist name(s)
    resultsContainer.appendChild(songElement);
    songElement.onclick = () => {
      console.log("Selected song "+`${song.name} by ${song.artists.map(artist => artist.name).join(", ")}`);
      selectSong(song.name, inputElement, cellKey, song.popularity);
      // Clear the dropdown after selection
      resultsContainer.innerHTML = "";
      resultsContainer.appendChild(songElement);
    };
  });

  // Position the results dropdown so it doesn"t cover the input field
  inputElement.parentNode.style.position = "relative";
  inputElement.parentNode.appendChild(resultsContainer);
}

function selectSong(songInfo, inputElement, cellKey, popularity) {
  // Give user feedback
  updateScoreTo("(updating score)");
  
  // Decrease guess total for making a guess
  let newGuessTotal = guessTotal - 1;
  console.log("Decrementing guess total from "+guessTotal+" to "+newGuessTotal);
  guessTotal = newGuessTotal;

  // Check if guess is correct
  console.log("Checking guess "+songInfo);
  evaluateGuess(songInfo, inputElement, cellKey);
}

function evaluateGuess(songInfo, inputElement, cellKey) {
  // Hit endpoint to find out guess score
  let guessScore = 0;
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/check-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songGuess: songInfo, fieldGuessed: cellKey, gridId: gridId })
  })
    .then(response => response.json())
    .then(data => scoreParse(data, songInfo, inputElement))
    .catch((error) => console.error("Error scoring:", error));
}

function scoreParse(data, songInfo, inputElement) {
  let guessScore = 0;
  console.log("Parsing score from data:");
  console.log(data);
  guessScore = data.guessScore;
  console.log("Score parsed as "+guessScore+", now updating");
  updateScoreForGuess(guessScore, songInfo, inputElement);
}

// Function to update the score based on the user"s guess
function updateScoreForGuess(guessScore, songInfo, inputElement) {
  // Grab the cell where user made the guess (TODO, do this on the field id?)
  const cell = inputElement.closest(".cell");
  
  // Mark cell as correct if right, otherwise highlight red
  if (guessScore > 0) {
    // Give visual feedback
    cell.style.backgroundColor = "#c8e6c9"; // Green for correct
    cell.textContent = "Correct: " + songInfo + " ("+guessScore+" out of 11 points scored)";
    
    // Track that they got a guess right
    console.log("Guess correct!");
    correctGuesses+=1;
    console.log("Correct guesses now at "+correctGuesses);
    
    // Calculate their new score and display
    totalScore+=guessScore;
    console.log("Done scoring, received "+guessScore);
    updateScoreTo(totalScore);
  } else {
    cell.style.backgroundColor = "#ffcdd2"; // Red for incorrect
    // TODO: GIVE BETTER FEEDBACK FOR COLORBLIND PEOPLE THAT THEY GOT IT WRONG (and for further wrong guesses)
    // List incorrect guesses at top of cell?
  }

  // Clear the dropdown menu (this is kinda buggy)
  removeDropdown(inputElement);
  
  // Check if game has ended on this guess, decrease displayed guesses remaining if not
  if (guessTotal == 0 || correctGuesses == 9) {
    terminateGame();
  } else {
    decrementGuesses();
  }
}

function updateScoreTo(totalScore) {
  let scoreReadable = " "+totalScore;
  document.getElementById("totalScore").textContent=scoreReadable;
  // Check if game is now complete
  if (correctGuesses == 9 && !(totalScore.equals("(updating score)"))) {
    terminateGame();
  }
}

function decrementGuesses() {
  let guessesReadable = " "+guessTotal;
  document.getElementById("guessesRemaining").textContent=guessesReadable;
}

function terminateGame() {
  console.log("Terminating game!");

  console.log("Checking if scores are completed:");
  endGame();
}

function endGame() {
  let eogGuessMsg = "Guessing complete!";
  document.getElementById("guessWrapper").textContent=eogGuessMsg;

  let quitterButton = document.getElementById("quitButton");
  quitterButton.parentNode.removeChild(quitterButton);
  
  const songCells = document.querySelectorAll(".song-cell");
  console.log("Identified song cells");
  songCells.forEach(cell => {
    console.log("Checking for input field on "+cell.textContent);
    const inputField = cell.querySelector("input[type='text']");
    console.log("inputField = "+inputField);
    if (inputField) {
      console.log("Decided yes, there is an input field! Disabled:"+inputField.disabled);
      if (!inputField.disabled) {
        // Extract correct answers from the oninput attribute
        

        // Update the cell to show it"s incorrect and display correct answers
        cell.style.backgroundColor = "#ffcdd2"; // Red for incorrect
        
        cell.textContent = "Incorrect! Steven's not up for coding the endpoint to show what was correct though, so google it if you wanna know that bad.";
        inputField.disabled = true;
      }
    } else {
      console.error("Input field not found in the cell:", cell);
    }
  });

  // Provide feedback that the game has ended
  displayEndGameMessage();
  let playerName = prompt("Enter your name for the leaderboard:");
  if (playerName) {
    leaderboardUpdate(playerName, totalScore);
  }
}

function displayEndGameMessage() {
  const endGameMessage = document.createElement("div");
  endGameMessage.innerHTML = "<strong>Game Over!</strong> Here are the songs you missed.";
  document.querySelector(".container").prepend(endGameMessage);
}

document.getElementById("shareButton").addEventListener("click", () => {
  if (navigator.share) {
    navigator.share({
      title: "My MusicGrid Results",
      text: `I scored ${totalScore} on MusicGrid! Can you beat me?`,
      url: document.location.href
    })
      .then(() => console.log("Successful share"))
      .catch((error) => console.error("Error sharing:", error));
  } else {
    console.error("Web Share API is not supported in your browser.");
  }
});

// Add submitted game + username to leaderboard, let"s not worry about sanitizing for now as there"s not much to hack
function leaderboardUpdate(playerName, score) {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/submit-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: playerName, score: score, lb_id: gridId })
  })
    .then(response => response.json())
    .then(data => {
      console.log(data.message);
      loadLeaderboard(); // Refresh the leaderboard after updating
    })
    .catch(error => console.error("Error:", error));
}

function removeDropdown(inputElement) {
  if (inputElement && inputElement.parentNode) {
    const existingContainer = inputElement.parentNode.querySelector(".results-dropdown");
    if (existingContainer) {
      inputElement.parentNode.removeChild(existingContainer);
    }
  } else {
    console.error("Input element is not in the DOM or has no parent.");
  }
}
