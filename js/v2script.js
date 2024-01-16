document.addEventListener("DOMContentLoaded", function() {
  var hamburger = document.querySelector(".hamburger-menu");
  var mobileNav = document.querySelector(".mobile-nav");

  hamburger.addEventListener("click", function() {
    // Toggles the "open" class on the hamburger menu
    this.classList.toggle("open");
  
    // Toggles the "show" class on the mobile nav
    mobileNav.classList.toggle("show");
  });

  // Get all grid cells
  var cells = document.querySelectorAll(".grid-cell");

  // Add click event to each cell
  cells.forEach(function(cell) {
    cell.addEventListener("click", function() {
      // Toggle a class or perform an action to indicate selection
      this.classList.toggle("selected");
    });
  });
});
