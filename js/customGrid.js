// You get one point just for being here
let totalScore = 1; 

// Guesses don"t last forever....
let guessTotal = 10;
let livesLost = 0;

// How good are ya really?
let correctGuesses = 0;

// What grid are we goofin around with?
const searchParams = new URLSearchParams(window.location.search);
let customGridId = searchParams.get("custom_grid_id")||1;

// Easy mode boolean
let easyModeBool = false;

function initializeSite() {
  console.log("Initializing Site");
  console.log("Loading grid");
  loadHeader();
  loadGrid();
}

function loadHeader() {
  console.log("Building header");
  const titleContainer = document.querySelector(".hero-content");

  //Adjust css for hero-content
  titleContainer.style.marginTop= "9%";
  titleContainer.style.paddingTop= "7%";
  
  //Build Title
  const titleText = document.createElement("div");
  titleText.setAttribute("id","gridTitleCust");
  titleText.innerHTML = "<span style=\"font-size:2.3em;\">Millenium Alt Rock</span>"; 

  //Build cheat button
  const headWrapper = document.createElement("div");
  headWrapper.classList.add("subheader","cheatZone");
  const cheatButton = document.createElement("label");
  cheatButton.classList.add("switch");
  const checkBox = document.createElement("input");
  checkBox.type = "checkbox";
  checkBox.id = "easyModeToggle";
  const sliderRound = document.createElement("span");
  sliderRound.classList.add("slider","round");
  cheatButton.appendChild(checkBox);
  cheatButton.appendChild(sliderRound);

  //Build descriptors for Cheat Button
  const cheatDescriptorPre = document.createElement("span");
  cheatDescriptorPre.innerHTML = "<br><i>Hard Mode </i>";
  const cheatDescriptorPost = document.createElement("span");
  cheatDescriptorPost.innerHTML = "<i> Easy Mode</i><br>";
  headWrapper.appendChild(cheatDescriptorPre);
  headWrapper.appendChild(cheatButton);
  headWrapper.appendChild(cheatDescriptorPost);

  //Place elements on page
  titleContainer.appendChild(titleText);
  titleContainer.appendChild(headWrapper);
}

function loadFooter() {
  const underGameWrapper = document.querySelector(".under-game");
  
  //Build guesses
  const guessesWrapper = document.createElement("div");
  guessesWrapper.classList.add("subheader", "guessCount");
  guessesWrapper.id = "guessWrapper";
  guessesWrapper.innerHTML = "<i><u>Lives Remaining</u></i></span><br><span id=\"livesRemaining\"><span id=\"life1\">\u2764</span><span id=\"life2\">\u2764</span><span id=\"life3\">\u2764</span></span>";

  //Build score counter
  const scoreWrapper = document.createElement("div");
  scoreWrapper.classList.add("score-wrapper");
  const scoreInner = document.createElement("div");
  scoreInner.classList.add("score-inner");
  scoreInner.innerHTML = "<span id=\"totalScore\" style=\"font-size:4.5em\"><b>1</b></span><br><sup>Total Score</sup><br>";
  scoreWrapper.appendChild(scoreInner);

  //Build quit button
  const quitWrapper = document.createElement("div");
  quitWrapper.classList.add("quit-wrapper");
  const quitButton = document.createElement("button");
  quitButton.type = "button";
  quitButton.id = "quitButton";
  quitButton.onclick = function() { terminateGame(); };
  quitButton.innerText = "Give Up?";
  quitWrapper.appendChild(quitButton);

  //Build dummy leaderboard to be built later, this can def be optimized to do in one function later one
  const leaderboardSuperWrapper = document.createElement("div");
  leaderboardSuperWrapper.classList.add("leaderboard-super-wrapper");
  const leaderboardWrapper = document.createElement("div");
  leaderboardWrapper.classList.add("leaderboard-wrapper");
  const leaderBoard = document.createElement("div");
  leaderBoard.id = "leaderboard";
  leaderBoard.innerHTML = "<h2>Leaderboard</h2> <ul id=\"leaderboardList\"></ul>";
  leaderboardWrapper.appendChild(leaderBoard);
  leaderboardSuperWrapper.appendChild(leaderboardWrapper);
  
  //Build share button for later insertion
  const shareButton = document.createElement("button");
  shareButton.id = "shareButton";
  shareButton.innerText = "Share My Results";
  shareButton.style.display = "none";
  
  //Assemble on page
  underGameWrapper.appendChild(guessesWrapper);
  underGameWrapper.appendChild(scoreWrapper);
  underGameWrapper.appendChild(quitWrapper);
  underGameWrapper.appendChild(leaderboardSuperWrapper);
  underGameWrapper.appendChild(shareButton);

  
  document.getElementById("shareButton").addEventListener("click", () => {
    if (navigator.share) {
      navigator.share({
        title: "My MusicGrid Results",
        text: `I scored ${totalScore} on MusicGrid, you could never. Try at: musicgrid.erincullison.com`,
        url: document.location.href
      })
        .then(() => console.log("Successful share"))
        .catch((error) => console.error("Error sharing:", error));
    } else {
      console.error("Web Share API is not supported in your browser.");
    }
  });
  
  loadLeaderboard();
}

// Add submitted game + username to leaderboard, let"s not worry about sanitizing for now as there"s not much to hack
function loadGrid() {
  fetchGridData(customGridId);
}

function fetchGridData(customGridId) {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/custom-grid-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_grid_id: customGridId })
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
  let custGridTitle = 'Fallback Grid Title';
  
  data.forEach(item => {
    if (item.field_type === "Category") {
      categories[item.field] = item.field_value;
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
      custGridTitle = item.grid_title;
    }
  });

  // Update Title
  newTitleText = document.getElementById("gridTitleCust");
  newTitleText.innerHTML = "<span style=\"font-size:2.3em;\">"+custGridTitle+"</span>"; 
  
  // Create artist row
  const artistRow = document.createElement("div");
  artistRow.classList.add("row");
  artistRow.appendChild(createCell("invisible")); // Invisible cell for alignment
  Object.keys(artists).forEach(key => artistRow.appendChild(createCell("artist", artists[key], "artist-")));
  gridContainer.appendChild(artistRow);

  // Create rows for each category
  Object.keys(categories).forEach(categoryKey => {
    const categoryRow = document.createElement("div");
    categoryRow.classList.add("row");

    // Category cell
    categoryRow.appendChild(createCell("genre-header", categories[categoryKey], "cat-"));

    // Song cells
    Object.keys(artists).forEach(artistKey => {
      const cellKey = `${categoryKey} ${artistKey}`;
      categoryRow.appendChild(createSongCell(cellKey, artists[artistKey], categories[categoryKey]));
    });

    gridContainer.appendChild(categoryRow);
  });
  
  // Add event listeners to new song cells
  var cells = document.querySelectorAll(".cell.song-cell");
  cells.forEach(function(cell) {
    // Mouse enter event to highlight category and artist
    cell.addEventListener("mouseenter", function() {
      highlightRelated(this.className);
    });
    // Mouse leave event to remove highlight
    cell.addEventListener("mouseleave", function() {
      removeHighlight(this.className);
    });
  });
  // Now build the footer
  loadFooter();
}

function createCell(className = "dummy1", text = "", classPrefix = "dummy2") {
  const cell = document.createElement("div");
  const className2 = classPrefix + text.replaceAll(" ","-");
  cell.classList.add("cell", className, className2);
  cell.textContent = text;
  return cell;
}

function createSongCell(cellKey, artistName, catName) {
  const cell = document.createElement("div");
  const btnClass = "cheat-btn";
  const catNameClass = "cat-"+catName.replaceAll(" ","-");
  console.log("Appended class "+catNameClass+" from catName "+catName);
  const artistNameClass = "artist-"+artistName.replaceAll(" ","-");
  console.log("Appended class "+artistNameClass+" from artistName "+artistName);
  cell.classList.add("cell", "song-cell", catNameClass, artistNameClass);

  const button = document.createElement("button");
  button.setAttribute("class", btnClass);
  button.setAttribute("id", cellKey);
  button.textContent = "Cheat ";
  button.style.display = "none";
  cell.appendChild(button);
  
  const whitespace = document.createElement("div");
  cell.appendChild(whitespace);
  
  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("oninput", `liveSearch(this, "${cellKey}", "${artistName}")`);
  input.setAttribute("placeholder", "Type to search...");
  cell.appendChild(input);

  return cell;
}

function loadLeaderboard() {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lb_id: customGridId+100 })
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

function liveSearch(inputElement, cellKey, artistName) {
  if (inputElement.value.length > 2) {
    console.log("Requesting search for "+inputElement.value);
    searchSpotify(inputElement.value, artistName)
      .then(songs => displaySpotifyResults(songs, inputElement, cellKey))
      .catch(error => console.error("Error fetching Spotify data:", error));
  } else {
    removeDropdown(inputElement);
  }
}

async function searchSpotify(searchTerm, artistName) {
  console.log("Searching for "+searchTerm);
  const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchTerm, easyModeBool, artistName })
  });
  console.log("Received response: "+response);
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
}

function displaySpotifyResults(songs, inputElement, cellKey) {
  removeAllDropdowns(); // Remove existing dropdown if present
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
  updateScoreTo("loading");
  
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
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/check-custom-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songGuess: songInfo, fieldGuessed: cellKey, customGridId: customGridId })
  })
    .then(response => response.json())
    .then(data => scoreParse(data, songInfo, inputElement))
    .catch((error) => console.error("Error scoring:", error));
}

function scoreParse(data, songInfo, inputElement) {
  let guessScore = 0;
  console.log("Parsing score from data:");
  console.log(data);
  for(const scoreObj of data) {
    guessScore = scoreObj.guessscore;
  }
  console.log("Score parsed as "+guessScore+", now updating");
  updateScoreForGuess(Number(guessScore), songInfo, inputElement);
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
    updateScoreTo(totalScore);
    decrementLives();
  }

  // Clear the dropdown menu (this is kinda buggy)
  removeDropdown(inputElement);
  
  // Check if game has ended on this guess, decrease displayed guesses remaining if not
  if (livesLost >= 4 || correctGuesses == 9) {
    terminateGame();
  } 
}

function updateScoreTo(totalScore) {
  if (totalScore == "loading") {
    document.getElementById("totalScore").innerHTML="<img src=\"/img/loading.gif\" alt=\"calculating score\" style=\"height:3em;\">";
  } else {
    document.getElementById("totalScore").innerHTML="<b>"+totalScore+"</b>";
  }
  // Check if game is now complete
  if (correctGuesses == 9) {
    terminateGame();
  }
}

function decrementLives() {
  livesLost += 1;
  let lifeID = "life"+livesLost;
  if(livesLost >= 4) {
    terminateGame();
  } else {
    console.log("Recording loss of life #"+livesLost+" and updating element "+lifeID);
    document.getElementById(lifeID).innerText = "\u274C";
    if (livesLost == 3) {
      const lifeWarning = document.createElement("div");
      lifeWarning.innerHTML = "<b>\u26A0 NEXT MISS IS DEATH \u26A0</b>";
      document.getElementById("guessWrapper").appendChild(lifeWarning);
    }
  }
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
  document.getElementById("shareButton").show();
  
}

function displayEndGameMessage() {
  const endGameMessage = document.createElement("div");
  endGameMessage.innerHTML = "<strong>Game Over!</strong> Here are the songs you missed.";
  document.querySelector(".grid-container").prepend(endGameMessage);
}


function fetchCheatPreviewUrl(customGridId, fieldKey, cell) {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/get-custom-cheat-preview-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customGridId, fieldKey })
  })
    .then(response => response.json())
    .then(data => {
      if(data.previewUrl) {
        playPreviewSnippet(data.previewUrl, cell);
      }
    })
    .catch(error => console.error("Error fetching preview URL:", error));
}

function playPreviewSnippet(url, cell) {
  // Create an audio element
  let audioPlayer = cell.querySelector(".preview-audio");
  if (!audioPlayer) {
    audioPlayer = document.createElement("audio");
    audioPlayer.className = "preview-audio";
    audioPlayer.controls = true;
    cell.prepend(audioPlayer);
  }

  // Set the source and play
  audioPlayer.src = url;
  audioPlayer.play()
    .catch(error => console.error("Error playing audio:", error));

  // Optional: Hide the cheat button to prevent replaying during playback
  const cheatBtn = cell.querySelector(".cheat-btn");
  if (cheatBtn) {
    cheatBtn.style.display = "none";
  }

  // Optional: Add event listener to hide the audio player after it finishes playing
  audioPlayer.onended = () => {
    audioPlayer.style.display = "none";
    if (cheatBtn) {
      cheatBtn.style.display = "block";
    }
  };
}

// Add submitted game + username to leaderboard, let"s not worry about sanitizing for now as there"s not much to hack
function leaderboardUpdate(playerName, score) {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/submit-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: playerName, score: score, lb_id: customGridId+100 })
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

function removeAllDropdowns() {
  const dropdowns = document.querySelectorAll(".results-dropdown");
  dropdowns.forEach((dropdown) => {
    if(dropdown) {
      dropdown.remove();
    }
  });
}

function startGame() {
  // Build grid
  initializeSite();
  
  // Tag listeners
  document.getElementById("easyModeToggle").addEventListener("change", function() {
    const isEasyMode = this.checked;
    easyModeBool = isEasyMode;
    const cheatButtons = document.querySelectorAll(".cheat-btn");
    cheatButtons.forEach(btn => {
      if (isEasyMode) {
        btn.style.display = "block"; // Show cheat buttons in easy mode
      } else {
        btn.style.display = "none"; // Hide cheat buttons when easy mode is off
      }
    });
  });
  
  document.getElementById("grid-container").addEventListener("click", function(event) {
    // Check if the clicked element is a cheat button
    if (event.target && event.target.classList.contains("cheat-btn")) {
      const cell = event.target.closest(".cell");
      const fieldKey = event.target.getAttribute("id");
      
      // Here you can call your function to fetch the cheat preview URL and then play it
      fetchCheatPreviewUrl(customGridId, fieldKey, cell);
    }
  });
}

document.addEventListener("DOMContentLoaded", function() {
  var hamburger = document.querySelector(".hamburger-menu");
  var mobileNav = document.querySelector(".mobile-nav");

  hamburger.addEventListener("click", function() {
    // Toggles the "open" class on the hamburger menu
    this.classList.toggle("open");
  
    // Toggles the "show" class on the mobile nav
    mobileNav.classList.toggle("show");
  });

  var playButton = document.querySelector(".play-button");
  var gridContainer = document.querySelector(".grid-container");
  var heroContent = document.querySelector(".hero-content");
  
  // Play button event listener
  playButton.addEventListener("click", function() {
    gridContainer.classList.add("active");
    gridContainer.style.removeProperty("display");
    heroContent.innerHTML = "";
    startGame();
  });
});

function highlightRelated(className) {
  // Parse artist and category class
  const classNames = className.split(" ");
  console.log("Highlighting cells relevant to: "+className);
  if(classNames.length == 4) {
    var artistName = classNames[3];
    var catName = classNames[2];
    var artistCellClass = `.cell.artist.${artistName}`;
    var genreCellClass = `.cell.genre-header.${catName}`;
    console.log("Highlighting relevancy for artist: '"+artistCellClass+"' and category '"+genreCellClass+"'");
    var categoryElement = document.querySelector(genreCellClass);
    var artistElement = document.querySelector(artistCellClass);
    console.log(categoryElement.innerText);
    console.log(artistElement.innerText);
    if(categoryElement) categoryElement.classList.add("highlight");
    if(artistElement) artistElement.classList.add("highlight");
  }
}

function removeHighlight(className) {
  // Parse artist and category class
  const classNames = className.split(" ");
  console.log("Highlighting cells relevant to: "+className);
  if(classNames.length == 4) {
    var artistName = classNames[3];
    var catName = classNames[2];
    var artistCellClass = `.cell.artist.${artistName}`;
    var genreCellClass = `.cell.genre-header.${catName}`;
    console.log("Dehighlighting relevancy for artist: '"+artistCellClass+"' and category '"+genreCellClass+"'");
    var categoryElement = document.querySelector(genreCellClass);
    var artistElement = document.querySelector(artistCellClass);
    console.log(categoryElement.innerText);
    console.log(artistElement.innerText);
    if(categoryElement) categoryElement.classList.remove("highlight");
    if(artistElement) artistElement.classList.remove("highlight");
  }
}
