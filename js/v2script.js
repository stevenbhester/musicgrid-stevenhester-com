
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
    heroContent.remove();
  });

  // Get all grid cells
  var cells = document.querySelectorAll(".grid-cell");
  cells.forEach(function(cell) {
    // Mouse enter event to highlight category and artist
    cell.addEventListener("mouseenter", function() {
      highlightRelated(this.dataset.category, this.dataset.artist);
    });
    // Mouse leave event to remove highlight
    cell.addEventListener("mouseleave", function() {
      removeHighlight(this.dataset.category, this.dataset.artist);
    });
  });

  function highlightRelated(category, artist) {
    // Highlight the related category and artist
    var categoryElement = document.querySelector(`.grid-category[data-category="${category}"]`);
    var artistElement = document.querySelector(`.grid-artist[data-artist="${artist}"]`);
    console.log(categoryElement);
    console.log(artistElement);
    if(categoryElement) categoryElement.classList.add("highlight");
    if(artistElement) artistElement.classList.add("highlight");
  }

  function removeHighlight(category, artist) {
    // Remove highlight from the related category and artist
    var categoryElements = document.querySelectorAll(".grid-category.highlight, .grid-artist.highlight");
    categoryElements.forEach(function(element) {
      element.classList.remove("highlight");
    });
  }
  
  // Add click event to each cell
  cells.forEach(function(cell) {
    cell.addEventListener("click", function() {
      // Toggle a class or perform an action to indicate selection
      this.classList.toggle("selected");
    });
  });
});
