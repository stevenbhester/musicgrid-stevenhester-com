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
    listContainer[0].innerHTML = "";
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

async function buildArtistList(topArtistsData) {
  const listContainer = document.getElementsByClassName("sortable-list");
  listContainer[0].innerHTML = "";
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
}

// Tell the users how we're doing building their grid
async function buildProgressReport(artists) {
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
  
  //Once we're done with building progress, move to parsing
  let xa = await parseArtists(progressContainer).then(() =>  validateGroups());
  
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
  if ( cellType == "artist" ){
    progressCell.textContent = cellContent;
    cellStatus = "noStatus";
    progressCell.setAttribute("data-artist-id",cellDataEmbed);
  } else {
    progressCell.setAttribute("data-progress-type",cellContent);
  }
  progressCell.classList.add("cell", cellClass, cellStatus);
  return progressCell;
}

function fetchValidCategories() {
  let validCategories = [];
  validCategories.push({head: "Check Release Dates", endpoint: "/list-songs-by-dates", className: "release-date"});
  validCategories.push({head: "Check Song Lengths", endpoint: "/list-songs-by-duration", className: "song-length"});
  validCategories.push({head: "Check Title Lengths", endpoint: "/list-songs-by-wordcount", className: "title-length"});
  validCategories.push({head: "Check Cheats Access", endpoint: "/get-cheat-preview-url", className: "cheats-available"});
  validCategories.push({head: "Looking for Group", endpoint: "fakeEndpoint", className: "group-compare"});
  return(validCategories);
}

//Next steps: Go through valid artist rows, check each cell, change class based on status, get good gif for loading, add missing-artist gif, add warning if no cheat button, build custom grid data structure and handle
//Long term: Add more categories with further APIs then let users select the categories they want.

let masterArtistDataSumm = {};
let masterArtistDataDetails = {};

async function parseArtists(progressContainer, startIndex = 0, endIndex = 4) {
  let debug = true;
  if(debug) { console.log("parsing Artist progress");}
  let progressRowsHTMLObj = progressContainer.getElementsByClassName("row");
  let progressRowsArr = [];
  if(debug) { console.log("Setting progressRowArr:");}
  for (let j = 1; j < progressRowsHTMLObj.length; j++) { //We start at 1 to ignore header row
    let progressRowElem = progressRowsHTMLObj[j];
    progressRowsArr.push(progressRowElem);
  }
  if(debug) { console.dir(progressRowsArr);}
  let progressRowsSlice = progressRowsArr.slice(startIndex, endIndex);
  for (var row of progressRowsSlice) {
    let artistSummObj = {};
    let artistName = row.getElementsByClassName("artist-cell")[0].textContent;
    let artistId = row.getElementsByClassName("artist-cell")[0].getAttribute("data-artist-id");
    let categoryCellsHTMLObj = row.getElementsByClassName("progress-cell");
    let categoryCellsObj = [];
    if(debug) { console.log(`Observing artist name: "${artistName}", id: "${artistId}"`);}
  
    for (let i = 0; i < categoryCellsHTMLObj.length; i++) {
      let categoryCellsElem = categoryCellsHTMLObj[i];
      let keyValue = categoryCellsElem.getAttribute("data-progress-type");
      if(debug) { console.log(`Setting categoryCellsObj[${keyValue}]:`); console.dir(categoryCellsElem);}
      categoryCellsObj[categoryCellsElem.getAttribute("data-progress-type")] = categoryCellsElem;
    }
    let xa = await checkArtistData(artistId, artistName, categoryCellsObj["release-date"], categoryCellsObj["title-length"], categoryCellsObj["song-length"]);
  }
}

async function checkArtistData(artistId, artistName, releaseDateCell, wordCountCell, durationCell) {
  releaseDateCell.classList.remove("finished");
  releaseDateCell.classList.remove("unstarted");
  releaseDateCell.classList.add("in-progress");
  wordCountCell.classList.remove("finished");
  wordCountCell.classList.remove("unstarted");
  wordCountCell.classList.add("in-progress");
  durationCell.classList.remove("finished");
  durationCell.classList.remove("unstarted");
  durationCell.classList.add("in-progress");
  
  let xo = await countReleasesByCat(artistId,artistName,releaseDateCell,wordCountCell,durationCell);
  return true;
}

async function countReleasesByCat(artistId, artistName, releaseDateCell, wordCountcell, durationCell) { 
  let durations = [60000, 120000, 180000, 240000, 300000, 360000];
  let wordCounts = [1, 2, 3, 4, 5];
  console.log("Fetching heroku for artist: "+artistName);
  await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/rich-artist-lookup-v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistId, durations, wordCounts })
  })
    .then(response => response.json())
    .then(data => {
      leaf(masterArtistDataSumm,[artistName,"releaseDate"], data.summary.releasedate);
      leaf(masterArtistDataDetails,[artistName,"releaseDate"], data.details.releasedate);
      releaseDateCell.classList.remove("unstarted");
      releaseDateCell.classList.remove("in-progress");
      releaseDateCell.classList.add("finished");
      
      leaf(masterArtistDataSumm,[artistName,"wordCount"], data.summary.wordcount);
      leaf(masterArtistDataDetails,[artistName,"wordCount"], data.details.wordcount);
      wordCountcell.classList.remove("unstarted");
      wordCountcell.classList.remove("in-progress");
      wordCountcell.classList.add("finished");
      
      leaf(masterArtistDataSumm,[artistName,"duration"], data.summary.duration);
      leaf(masterArtistDataDetails,[artistName,"duration"], data.details.duration);
      durationCell.classList.remove("unstarted");
      durationCell.classList.remove("in-progress");
      durationCell.classList.add("finished");
      return true;
    })
    .catch(error => console.error("Error fetching grid data:", error));
}

function leaf(obj, keyPath, value) {
  let lastKeyIndex = keyPath.length-1;
  for (var i = 0; i < lastKeyIndex; ++ i) {
    let key = keyPath[i];
    if (!(key in obj)){
      obj[key] = {};
    }
    obj = obj[key];
  }
  obj[keyPath[lastKeyIndex]] = value;
}

async function validateGroups() {
  let debug = true;
  let artists = Object.keys(masterArtistDataSumm);
  if(debug) {console.log("Groups to compare registered as:");console.log(artists);}
  if(debug) {console.dir(masterArtistDataSumm);}
  if(debug) {console.dir(masterArtistDataDetails);}
  //Here is where we look for specific groups, decide which date ranges/number of words to use, then pass over to the encoder!
  let yearRange = await selectDateRange();
}


async function progressFailure() {
  let debug = true;
  if(debug) {console.log("Groups failed to update");}
  //Here is where we look for specific groups, decide which date ranges/number of words to use, then pass over to the encoder!
}


async function selectDateRange() {
  let artists = Object.keys(masterArtistDataSumm);
  let masterYears = {};
  for (let x = 0; x < artists.length; x++) {
    let artistName = artists[x];
    console.log("Checking date ranges for "+artistName+" of years:");
    let releaseSummObj = masterArtistDataSumm[artistName]["releaseDate"];
    let artistYearsArr = Object.keys(releaseSummObj);
    console.dir(artistYearsArr);
    let artistYearsBucketObj = {};
    for (let y = 0; y < artistYearsArr.length; y++) {
      let observedYear = parseInt(artistYearsArr[y]);
      let yearReleases = releaseSummObj[observedYear];
      let yearBucket = observedYear - observedYear%5;
      let relevantBuckets = [];
      relevantBuckets.push(yearBucket);
      if(yearBucket == observedYear) {
        relevantBuckets.push(observedYear - 5);
      }
      console.log("Checking year: "+observedYear+" with "+yearReleases+" releases");
      for (let z = 0; z < relevantBuckets.length; z++) {
        currYear = relevantBuckets[z];
        console.log("Assigned to bucket "+currYear);
        
        let currYearKeys = Object.keys(artistYearsBucketObj);
        let currYearArtistKeys = Object.keys(artistYearsBucketObj[currYearKeys]);
        if(currYearKeys.length >= 0 && currYearKeys.includes(observedYear)) { //If year bucket already exists
          if(currYearArtistKeys.length >= 0 && currYearArtistKeys.includes(artistName) { //And artist exists in that year bucket
            artistYearsBucketObj[observedYear][artistName] += yearReleases; //Increment bucket release count by current year
            console.log(observedYear+ " & "+artistName+" already exists, incrementing by "+yearReleases);
          } else { //But if year bucket exists and artist not found, create artist record and set to yearReleases
            artistYearsBucketObj[observedYear][artistName] = yearReleases;
            console.log(observedYear+" exists, "+artistName+" doesn't already exists, creating & setting to "+yearReleases);
          }
        } else { //If year bucket doesn't yet exist, create year and add artist//num release pair
          artistYearsBucketObj[observedYear] = {[artistName]: yearReleases};
          console.log(observedYear+ " & "+artistName+" don't exist, creating and setting to "+yearReleases);
        }
      }
    }
  }
  console.dir(artistYearsBucketObj);
  return artistYearsBucketObj;
  // map each year to (artist:numsongs)
  // generalize to 5 year buckets
  // rank 5 year buckets by the highest min of artists songs
  // select top and we can iterate through later
  // return array of min and max year for year range (or just take min and know it's +5 years)
  // actually be careful to count songs in a border year towards both (2005 counts for 2000-2005 and 2005-2010)
}
