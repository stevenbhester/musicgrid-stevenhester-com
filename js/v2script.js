document.addEventListener("DOMContentLoaded", function() {
  var hamburger = document.querySelector(".hamburger-menu");
  var mobileNav = document.querySelector(".mobile-nav");
});

hamburger.addEventListener("click", function() {
  // Toggles the "open" class on the hamburger menu
  this.classList.toggle("open");

  // Toggles the "show" class on the mobile nav
  mobileNav.classList.toggle("show");
});
