// Start running code on page load
window.onload = function() {
  initializeSite();
};

// Log functionality and ask to fetch grid summary
function initializeSite() {
  console.log("Initializing Site");
  console.log("Fetching Spotify OAUTH");
  fetchTopArtists();
}

//Get user data code (cool!)
async function fetchTopArtists() {
  let aToken = null;
  let tokenResponseObj = await handleOauth();
  if (tokenResponseObj.err) {
    const listContainer = document.getElementsByClassName("sortable-list");
    listContainer[0].innerHTML = '';
    const errorMessage = document.createElement("div");
    errorMessage.textContent = "Encountered error while fetching artists: "+tokenResponseObj.err;
    listContainer[0].appendChild(errorMessage);
  } else {
    aToken = tokenResponseObj.accessToken;
  }
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/fetch-top-artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: aToken })
    });

    const data = await response.json();
    buildArtistList(data);
  } catch (error) {
    console.error("Error encoding answers for grid:", error);
  }
}

async function handleOauth() {
  const currentToken = {
    get access_token() { return localStorage.getItem("access_token") || null; },
    get refresh_token() { return localStorage.getItem("refresh_token") || null; },
    get expires_in() { return localStorage.getItem("expires_in") || null; },
    get expires() { return localStorage.getItem("expires") || null; },
  
    save: function (response) {
      const { access_token, refresh_token, expires_in } = response;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("expires_in", expires_in);
  
      const now = new Date();
      const expiry = new Date(now.getTime() + (expires_in * 1000));
      localStorage.setItem("expires", expiry);
    }
  };

  const currentTime = new Date();
  const expireTime = new Date(currentToken.expires);
  if (!currentToken.access_token || !currentToken.expires) {
    console.log("No access token or no expiry date found");
    return {err: "No access token found for Spotify, please go back to step 1", accessToken: "000"};
  } else if (expireTime.getTime() - currentTime.getTime() < 300000) {
    console.log("Time to expire read as "+(expireTime.getTime() - currentTime.getTime())+", found under threshold. Refreshing token.");
    const token = await refreshToken(currentToken.refresh_token);
    currentToken.save(token);
    return {err: null, accessToken: currentToken.access_token};
  } else {
    console.log("Token health a-okay, proceeding");
    return {err: null, accessToken: currentToken.access_token};
  }
}

async function refreshToken(refresh_token) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: "1d952129111a45b2b86ea1c08dd9c6ca",
      grant_type: "refresh_token",
      refresh_token: refresh_token
    }),
  });

  return await response.json();
}

function buildArtistList(topArtistsData) {
  const listContainer = document.getElementsByClassName("sortable-list");
  listContainer[0].innerHTML = '';
  topArtistsData.forEach(artist => {
    listContainer[0].appendChild(createArtistItem(artist.id,artist.name,artist.img));
  });
  const sortableList = document.querySelector(".sortable-list");
  const items = sortableList.querySelectorAll(".item");
  addEventListeners();
}

function createArtistItem(id, name, img) {
  const outerItem = document.createElement("li");
  outerItem.classList.add("item");
  outerItem.setAttribute("draggable", "true");
  outerItem.setAttribute("data-artist-id", id);
  
  const artistImage = document.createElement("img");
  artistImage.src = img;
  
  const innerDetails = document.createElement("div");
  innerDetails.classList.add("details");
  
  const artistName = document.createElement("span");
  artistName.textContent = name;

  const dragDots = document.createElement("i");
  dragDots.classList.add("uil", "uil-draggabledots");

  innerDetails.appendChild(artistImage);
  innerDetails.appendChild(artistName);
  
  outerItem.appendChild(innerDetails);
  outerItem.appendChild(dragDots);

  return outerItem;
}

function addEventListeners() {
  //Draggable code (blah)
  const sortableList = document.querySelector(".sortable-list");
  const items = sortableList.querySelectorAll(".item");
  var proceedButton = document.querySelector(".proceed-button");
  
  // Play button event listener
  proceedButton.addEventListener("click", function() {
    // generatorContainer.classList.add("active");
    // generatorContainer.style.removeProperty("display");
    // generatorContainer.innerHTML = "";
    buildCustomGrid();
  });
  
  items.forEach(item => {
    item.addEventListener("dragstart", () => {
      console.log("Dragging element "+item.textContent.trim());
      // Adding dragging class to item after a delay
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    item.addEventListener("touchmove", () => {
      console.log("Dragging element "+item.textContent.trim());
      // Adding dragging class to item after a delay
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    // Removing dragging class from item on dragend event
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
    item.addEventListener("touchend", () => item.classList.remove("dragging"));
  });
  const initSortableList = (e) => {
    e.preventDefault();
    console.log("initSortableList fired");
    
    const draggingItem = document.querySelector(".dragging"); 
    console.log("initSortableList detected at "+e.clientY);
      
    // Getting all items except currently dragging and making array of them
    let siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];
    console.log("siblings pulled");
    
    // Finding the sibling after which the dragging item should be placed
    let nextSibling = null;
    let priorSibling = null;
    siblings.forEach(sibling => {
      let rect = sibling.getBoundingClientRect();
      let yCoord = rect.top + sibling.offsetHeight/2;
      console.log("Comparing drag element at "+e.clientY+" to sibling "+sibling.textContent.trim()+" at "+ yCoord + " (rect: " + rect.top + "; offsetHeight/2: "+(sibling.offsetHeight/2));
      if (e.clientY >= yCoord && (!priorSibling || yCoord < priorSibling.getBoundingClientRect().top + priorSibling.offsetHeight/2)) {
        priorSibling = sibling;
      } else if (e.clientY < yCoord && (!nextSibling || yCoord < nextSibling.getBoundingClientRect().top + nextSibling.offsetHeight/2)) {
        nextSibling = sibling;
      }
    });
    if(priorSibling) {console.log("Found prior sibling "+priorSibling.textContent.trim());} else {console.log("No prior sibling found");}
    if(nextSibling) {console.log("Found next sibling "+nextSibling.textContent.trim());} else {console.log("No next sibling found");}
    
    // Inserting the dragging item before the found sibling
    if(nextSibling) {
      sortableList.insertBefore(draggingItem, nextSibling);
      console.log("Inserted drag element before next sibling");
    } else if (priorSibling) {
      sortableList.appendChild(draggingItem);
      console.log("Inserted drag element after prior sibling");
    } else { console.log("No prior or next sibling found for insertion"); }
  };
  sortableList.addEventListener("dragover", initSortableList);
  sortableList.addEventListener("dragenter", e => e.preventDefault());
}

// Once artists are selected, let's build a fkn grid...
function buildCustomGrid() {
  //Hide the artist list but keep it preserved for our lookup
  const listContainer = document.getElementsByClassName("sortable-list");
  listContainer[0].style.display = "none";
  
  //Transpose the artist preference to an array
  const artistRankings = document.getElementsByClassName("item");
  let artistsRankedArr = [];
  
  for (let i = 0; i < artistRankings.length; i++) {
    let artistRankElem = artistRankings[i];
    artistsRankedArr.push({artistName: artistRankElem.querySelector(".details").textContent, artistId: artistRankElem.getAttribute("data-artist-id")});
  }

  buildProgressReport(artistsRankedArr);
  
  listContainer[0].innerText = "I haven't coded this part yet";
}

// Tell the users how we're doing building their grid
function buildProgressReport(artists) {
  // Delete the frontend artist list now that we're done with it
  const listContainer = document.getElementsByClassName("sortable-list");
  listContainer[0].innerHTML = "";

  // Build our progress reporter container
  const progressContainer = document.getElementById("gridProgressContainer");
  progressContainer.innerHTML = "";

  // Fetch the current list of automated categories
  const categoriesArr = fetchValidCategories();
  
  // Build our progress headers
  const headerRow = document.createElement("div");
  headerRow.classList.add("row");
  headerRow.appendChild(createHeader("artist","Artists"));
  categoriesArr.forEach( category => {
    headerRow.appendChild(createHeader("category",category.head));
  });
  progressContainer.appendChild(headerRow);

  // Build our artist rows
  //TODO: Only generate rows for further artists if no match found in artists already returned
  artists.forEach(artist => {
    let artistRow = document.createElement("div");
    artistRow.classList.add("row");
    artistRow.appendChild(createProgressCell("artist",artist.artistName,artist.artistId));
    categoriesArr.forEach( category => {
      artistRow.appendChild(createProgressCell("progress",category.className,null));
    });
    progressContainer.appendChild(artistRow);
  });
}

function createHeader(headerType, headerText) {
  const headerCell = document.createElement("div");
  const cellClass = headerType+"-header";
  headerCell.classList.add("cell", "progress-header", cellClass);
  headerCell.textContent = headerText;
  return headerCell;
}

function createProgressCell(cellType, cellContent, idEmbed) {
  const progressCell = document.createElement("div");
  let cellClass = cellType+"-cell";
  let cellDataEmbed = idEmbed||"no-data";
  let cellStatus = "unstarted";
  if ( cellType == 'artist' ){
    progressCell.textContent = cellContent;
    cellStatus = "noStatus";
  } else {
    cellDataEmbed = cellContent;
  }
  progressCell.classList.add("cell", cellClass, cellDataEmbed, cellStatus);
  progressCell.setAttribute("data-artist-id","cellDataEmbed");
  return progressCell;
}

function fetchValidCategories() {
  let validCategories = [];
  validCategories.push({head: "Check Song Release Dates", endpoint: "/list-songs-by-dates", className: "release-date"});
  validCategories.push({head: "Check Song Lengths", endpoint: "/list-songs-by-duration", className: "song-length"});
  validCategories.push({head: "Check Song Title Lengths", endpoint: "/list-songs-by-wordcount", className: "title-length"});
  validCategories.push({head: "Checking Data Availability", endpoint: "/get-cheat-preview-url", className: "data-available"});
  validCategories.push({head: "Looking for Group", endpoint: "fakeEndpoint", className: "group-compare"});
  return(validCategories);
}

//Next steps: Go through valid artist rows, check each cell, change class based on status, get good gif for loading, add missing-artist gif, add warning if no cheat button, build custom grid data structure and handle
//Long term: Add more categories with further APIs then let users select the categories they want.

function pullReleasesYearly(artistElement) { 

}










