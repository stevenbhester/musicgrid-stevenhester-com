// You get one point just for being here
let totalScore = 1; 

// Guesses don"t last forever...
let guessTotal = 10;

// How good are ya really?
let correctGuesses = 0;

// What grid are we goofin around with?
let gridId = 0;

// Var score is calculating ?
let scoringOngoing = false;

function liveSearch(inputElement, answers) {
  if (inputElement.value.length > 2) {
    console.log("Requesting search for "+inputElement.value);
    searchSpotify(inputElement.value)
      .then(songs => displaySpotifyResults(songs, inputElement, answers))
      .catch(error => console.error("Error fetching Spotify data:", error));
  } else {
    removeDropdown(inputElement);
  }
}

async function searchAnswers(answerTerms) {
  console.log("Initializing evaluation of answers " + answerTerms);
  let promises = answerTerms.map(answerTerm => searchSpotify(answerTerm));

  // Wait for all promises to resolve
  let results = await Promise.all(promises);
  
  // Process the results to extract popularity values
  let answerPopsArr = results.map(result => {
    // Assuming the result structure includes an array of songs
    if (result.length > 0 && result[0].popularity !== undefined) {
      return result[0].popularity; // Take the popularity of the first song as an example
    }
    return null; // Handle cases where no songs are found or structure is different
  });

  console.log("Answer Pops Array now at: ", answerPopsArr.toString());
  return answerPopsArr;
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
function displaySpotifyResults(songs, inputElement, answers) {
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
      selectSong(`${song.name} by ${song.artists.map(artist => artist.name).join(", ")}`, inputElement, answers, song.popularity);
      // Clear the dropdown after selection
      resultsContainer.innerHTML = "";
      resultsContainer.appendChild(songElement);
    };
  });

  // Position the results dropdown so it doesn"t cover the input field
  inputElement.parentNode.style.position = "relative";
  inputElement.parentNode.appendChild(resultsContainer);
}

// Add a utility function for basic similarity check
function isSimilar(guess, correctAnswers) {
  console.log("Evaluating guess: "+guess);
  console.log("By answers: "+correctAnswers);
  return correctAnswers.some(answer => guess.toLowerCase().includes(answer.toLowerCase()));
}

function selectSong(songInfo, inputElement, answers, popularity) {
  // Decrease guess total for making a guess
  let newGuessTotal = guessTotal - 1;
  console.log("Decrementing guess total from "+guessTotal+" to "+newGuessTotal);
  guessTotal = newGuessTotal;

  // Check if guess is correct
  console.log("Checking guess "+songInfo);
  const cell = inputElement.closest(".cell");
  const isCorrect = isSimilar(songInfo, answers);

  // Mark cell as correct if right, otherwise highlight red
  if (isCorrect) {
    console.log("Guess correct!");
    cell.style.backgroundColor = "#c8e6c9"; // Green for correct
    cell.textContent = "Correct: " + songInfo + " (calculating score)";
    correctGuesses+=1;
    console.log("Correct guesses now at "+correctGuesses);
    console.log("Scoring ongoing is: "+scoringOngoing);
    if(guessTotal == 1) {
      scoringOngoing = false;
    }
    inputElement.disabled = true;
    if (scoringOngoing) {
      while (scoringOngoing) {
        console.log("Scoring in progress, updating new score once complete!");
        setTimeout(updateScoreForGuess(popularity,answers,cell,songInfo), 500);
      }
    } else { 
      updateScoreForGuess(popularity,answers,cell,songInfo);
    }
  } else {
    cell.style.backgroundColor = "#ffcdd2"; // Red for incorrect
    // cell.textContent = "Incorrect! Possible answers: " + answers.join(", ");
  }
  
  removeDropdown(inputElement);
  console.log("Requesting scoring for guess: "+songInfo);
  
  // Handle new guess total
  if (guessTotal == 0) {
    terminateGame();
  } else {
    decrementGuesses();
  }
}

function decrementGuesses() {
  let guessesReadable = " "+guessTotal
  document.getElementById("guessesRemaining").textContent=guessesReadable;
}

function terminateGame() {
  console.log("Terminating game!");

  console.log("Checking if scores are completed:");
  if (scoringOngoing) {
    while (scoringOngoing) {
      console.log("Scoring in progress, terminating game once complete!");
      setTimeout(endGame(), 500);
    }
  } else {
    endGame();
  }
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


function endGame() {
  let eogGuessMsg = "Guessing complete!"
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
        const correctAnswers = extractCorrectAnswers(inputField.getAttribute("oninput"));

        // Update the cell to show it"s incorrect and display correct answers
        cell.style.backgroundColor = "#ffcdd2"; // Red for incorrect
        
        cell.textContent = "Incorrect! Correct answers: " + correctAnswers.join(", ");
        inputField.disabled = true;
      };
    } else {
      console.error("Input field not found in the cell:", cell);
    };
  });

  // Provide feedback that the game has ended
  displayEndGameMessage();
  let playerName = prompt("Enter your name for the leaderboard:");
  if (playerName) {
    leaderboardUpdate(playerName, totalScore);
  }
}
function extractCorrectAnswers(oninputValue) {
  // Assuming the format is liveSearch(this, ["Answer1", "Answer2", ...])
  const answersMatch = oninputValue.match(/\[\s*"(.*?)"\s*\]/);
  return answersMatch ? answersMatch[1].split("", "") : [];
}

function displayEndGameMessage() {
  const endGameMessage = document.createElement("div");
  endGameMessage.innerHTML = "<strong>Game Over!</strong> Here are the songs you missed.";
  document.querySelector(".container").prepend(endGameMessage);
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
    Object.keys(artists).forEach(artistKey => {
      const cellKey = `${categoryKey} ${artistKey}`;
      const songAnswers = answers[cellKey] || [];
      categoryRow.appendChild(createSongCell(songAnswers));
    });

    gridContainer.appendChild(categoryRow);
  });

  // Now build the leaderboars
  loadLeaderboard();
  scoringOngoing = false;
}

function createCell(className, text = "") {
  const cell = document.createElement("div");
  cell.classList.add("cell", className);
  cell.textContent = text;
  return cell;
}

function createSongCell(answers) {
  const cell = document.createElement("div");
  cell.classList.add("cell", "song-cell");
  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("oninput", `liveSearch(this, ${JSON.stringify(answers)})`);
  input.setAttribute("placeholder", "Type to search...");
  cell.appendChild(input);
  return cell;
}


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


// Function to update the score based on the user"s guess
async function updateScoreForGuess(popularity, answers, cell, songInfo) {
  scoringOngoing = true;
  updateScoreTo("(updating score)");
  calculateAnswerPops(answers);
  var cellScoreMax = 0;
  var cellScoreMin = 0;
  var normedGuessScore = 0;
  var popInt = parseInt(popularity);
  console.log("Norming score off popularity of "+popInt+" from string "+popularity);
  let answerPops = await calculateAnswerPops(answers);
  console.log("Popularities returned to score updater for: "+answers.toString());
  console.log("Returned popularities: "+answerPops.toString());
  cellScoreMax = Math.max.apply(Math, answerPops);
  console.log("Max cell popularity determined as: "+cellScoreMax);
  cellScoreMin = Math.min.apply(Math, answerPops);
  console.log("Min cell popularity determined as: "+cellScoreMin);
  if (cellScoreMin == cellScoreMax) {
    normedGuessScore = 11;
  } else {
    normedGuessScore = 6+5*Math.round(10*(1 - ((popInt - cellScoreMin)/(cellScoreMax - cellScoreMin))))/10;
  }
  
  // Updating score in Song Cell
  cell.style.backgroundColor = "#c8e6c9"; // Green for correct
  cell.textContent = "Correct: " + songInfo + " ("+normedGuessScore+" out of 11 points scored)";

  // Calculating total score
  console.log("Normed score determined as: "+normedGuessScore);
  console.log("Adding normed score to prior total of "+totalScore);
  totalScore+=normedGuessScore;
  console.log("Displaying new total score of "+normedGuessScore);
  updateScoreTo(totalScore);
}

async function calculateAnswerPops(answers) {
  console.log("Parsing answer popularities");
  let answerPops = await searchAnswers(answers);
  console.log("Returned popularities: ", answerPops.toString());

  // Filter out null values if any song wasn"t found or popularity was missing
  answerPops = answerPops.filter(pop => pop !== null);

  console.log("Filtered answer popularities: ", answerPops.toString());
  return answerPops;
}

function updateScoreTo(totalScore) {
  let scoreReadable = " "+totalScore
  document.getElementById("totalScore").textContent=scoreReadable;
  scoringOngoing = false;
  // Check if game is now complete
  if (correctGuesses == 9 && !(totalScore.equals("(updating score)"))) {
    terminateGame();
  };
}
