const sortableList = document.querySelector(".sortable-list");
const items = sortableList.querySelectorAll(".item");

items.forEach(item => {
  item.addEventListener("dragstart", () => {
    console.log("Dragging element "+item.textContent);
    // Adding dragging class to item after a delay
    setTimeout(() => item.classList.add("dragging"), 0);
  });
  item.addEventListener("touchmove", () => {
    console.log("Dragging element "+item.textContent);
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
  console.log("initSortableList detected on "+draggingItem.textContent.trim()" at "+(draggingItem.offsetTop + draggingItem.offsetHeight / 2)+" (offsetTop: "+ draggingItem.offsetTop+"; offsetHeight/2: "+(draggingItem.offsetHeight/2));
    
  // Getting all items except currently dragging and making array of them
  let siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];
  console.log("siblings pulled");
  
  // Finding the sibling after which the dragging item should be placed
  let nextSibling = siblings.find(sibling => {
    let rect = sibling.getBoundingClientRect();
    let yCoord = rect.top + window.scrollY + sibling.offsetHeight/2;
    console.log("Comparing drag element at "+e.clientY+" to sibling "+sibling.textContent.trim()+" at "+ yCoord + " (rect: "+rect.top+"; scrollY: "+window.scrollY+"; offsetHeight/2: "+(sibling.offsetHeight/2));
    return e.clientY <= yCoord;
  });
  console.log("Found match sibling "+nextSibling.textContent.trim());
  // Inserting the dragging item before the found sibling
  sortableList.insertBefore(draggingItem, nextSibling);
  console.log("Inserted drag element before found match");
};


sortableList.addEventListener("dragover", initSortableList);
sortableList.addEventListener("dragenter", e => e.preventDefault());
