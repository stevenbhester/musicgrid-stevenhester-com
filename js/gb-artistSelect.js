// Start running code on page load
window.onload = function() {
  initializeSite();
};

// Log functionality and ask to fetch grid summary
function initializeSite() {
  console.log("Initializing Site");
  console.log("Fetching Spotify OAUTH");
  // Data structure that manages the current active token, caching it in localStorage
  const currentToken = {
    get access_token() { return localStorage.getItem("access_token") || null; },
    get refresh_token() { return localStorage.getItem("refresh_token") || null; },
    get expires_in() { return localStorage.getItem("refresh_in") || null; },
    get expires() { return localStorage.getItem("expires") || null; },
  };
  fetchTopArtists(currentToken.accessToken);
}

//Get user data code (cool!)
async function fetchTopArtists(aToken) {
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

function buildArtistList(topArtistsData) {
  const listContainer = document.getElementByClassName("sortable-list");
  topArtistsData.forEach(artist => {
    listContainer.appendChild(createArtistItem(artist.id,artist.name,artist.img));
  }
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
}




//Draggable code (blah)
const sortableList = document.querySelector(".sortable-list");
const items = sortableList.querySelectorAll(".item");

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
