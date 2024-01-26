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
      // console.log("Dragging element "+item.textContent.trim());
      // Adding dragging class to item after a delay
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    item.addEventListener("touchmove", () => {
      // console.log("Dragging element "+item.textContent.trim());
      // Adding dragging class to item after a delay
      setTimeout(() => item.classList.add("dragging"), 0);
    });
    // Removing dragging class from item on dragend event
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
    item.addEventListener("touchend", () => item.classList.remove("dragging"));
  });
  const initSortableList = (e) => {
    e.preventDefault();
    // console.log("initSortableList fired");
    
    const draggingItem = document.querySelector(".dragging"); 
    // console.log("initSortableList detected at "+e.clientY);
      
    // Getting all items except currently dragging and making array of them
    let siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];
    // console.log("siblings pulled");
    
    // Finding the sibling after which the dragging item should be placed
    let nextSibling = null;
    let priorSibling = null;
    siblings.forEach(sibling => {
      let rect = sibling.getBoundingClientRect();
      let yCoord = rect.top + sibling.offsetHeight/2;
      // console.log("Comparing drag element at "+e.clientY+" to sibling "+sibling.textContent.trim()+" at "+ yCoord + " (rect: " + rect.top + "; offsetHeight/2: "+(sibling.offsetHeight/2));
      if (e.clientY >= yCoord && (!priorSibling || yCoord < priorSibling.getBoundingClientRect().top + priorSibling.offsetHeight/2)) {
        priorSibling = sibling;
      } else if (e.clientY < yCoord && (!nextSibling || yCoord < nextSibling.getBoundingClientRect().top + nextSibling.offsetHeight/2)) {
        nextSibling = sibling;
      }
    });
    // if(priorSibling) {console.log("Found prior sibling "+priorSibling.textContent.trim());} else {console.log("No prior sibling found");}
    // if(nextSibling) {console.log("Found next sibling "+nextSibling.textContent.trim());} else {console.log("No next sibling found");}
    
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
  var DragDropTouch;
  (function (DragDropTouch_1) {
    var DataTransfer = (function () {
      function DataTransfer() {
        this._dropEffect = "move";
        this._effectAllowed = "all";
        this._data = {};
      }
      Object.defineProperty(DataTransfer.prototype, "dropEffect", {
        /**
         * Gets or sets the type of drag-and-drop operation currently selected.
         * The value must be "none",  "copy",  "link", or "move".
         */
        get: function () {
          return this._dropEffect;
        },
        set: function (value) {
          this._dropEffect = value;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(DataTransfer.prototype, "effectAllowed", {
        /**
         * Gets or sets the types of operations that are possible.
         * Must be one of "none", "copy", "copyLink", "copyMove", "link",
         * "linkMove", "move", "all" or "uninitialized".
         */
        get: function () {
          return this._effectAllowed;
        },
        set: function (value) {
          this._effectAllowed = value;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(DataTransfer.prototype, "types", {
        /**
         * Gets an array of strings giving the formats that were set in the @see:dragstart event.
         */
        get: function () {
          return Object.keys(this._data);
        },
        enumerable: true,
        configurable: true
      });
      /**
       * Removes the data associated with a given type.
       *
       * The type argument is optional. If the type is empty or not specified, the data
       * associated with all types is removed. If data for the specified type does not exist,
       * or the data transfer contains no data, this method will have no effect.
       *
       * @param type Type of data to remove.
       */
      DataTransfer.prototype.clearData = function (type) {
        if (type != null) {
          delete this._data[type];
        }
        else {
          this._data = null;
        }
      };
      /**
       * Retrieves the data for a given type, or an empty string if data for that type does
       * not exist or the data transfer contains no data.
       *
       * @param type Type of data to retrieve.
       */
      DataTransfer.prototype.getData = function (type) {
        return this._data[type] || "";
      };
      /**
       * Set the data for a given type.
       *
       * For a list of recommended drag types, please see
       * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Recommended_Drag_Types.
       *
       * @param type Type of data to add.
       * @param value Data to add.
       */
      DataTransfer.prototype.setData = function (type, value) {
        this._data[type] = value;
      };
      /**
       * Set the image to be used for dragging if a custom one is desired.
       *
       * @param img An image element to use as the drag feedback image.
       * @param offsetX The horizontal offset within the image.
       * @param offsetY The vertical offset within the image.
       */
      DataTransfer.prototype.setDragImage = function (img, offsetX, offsetY) {
        var ddt = DragDropTouch._instance;
        ddt._imgCustom = img;
        ddt._imgOffset = { x: offsetX, y: offsetY };
      };
      return DataTransfer;
      }());
      DragDropTouch_1.DataTransfer = DataTransfer;
      /**
      * Defines a class that adds support for touch-based HTML5 drag/drop operations.
      *
      * The @see:DragDropTouch class listens to touch events and raises the
      * appropriate HTML5 drag/drop events as if the events had been caused
      * by mouse actions.
      *
      * The purpose of this class is to enable using existing, standard HTML5
      * drag/drop code on mobile devices running IOS or Android.
      *
      * To use, include the DragDropTouch.js file on the page. The class will
      * automatically start monitoring touch events and will raise the HTML5
      * drag drop events (dragstart, dragenter, dragleave, drop, dragend) which
      * should be handled by the application.
      *
      * For details and examples on HTML drag and drop, see
      * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Drag_operations.
      */
      var DragDropTouch = (function () {
      /**
       * Initializes the single instance of the @see:DragDropTouch class.
       */
      function DragDropTouch() {
        this._lastClick = 0;
        // enforce singleton pattern
        if (DragDropTouch._instance) {
          throw "DragDropTouch instance already created.";
        }
        // detect passive event support
        // https://github.com/Modernizr/Modernizr/issues/1894
        var supportsPassive = false;
        document.addEventListener("test", function () { }, {
          get passive() {
            supportsPassive = true;
            return true;
          }
        });
        // listen to touch events
        if ("ontouchstart" in document) {
          var d = document, ts = this._touchstart.bind(this), tm = this._touchmove.bind(this), te = this._touchend.bind(this), opt = supportsPassive ? { passive: false, capture: false } : false;
          d.addEventListener("touchstart", ts, opt);
          d.addEventListener("touchmove", tm, opt);
          d.addEventListener("touchend", te);
          d.addEventListener("touchcancel", te);
        }
      }
      /**
       * Gets a reference to the @see:DragDropTouch singleton.
       */
      DragDropTouch.getInstance = function () {
        return DragDropTouch._instance;
      };
      // ** event handlers
      DragDropTouch.prototype._touchstart = function (e) {
        var _this = this;
        if (this._shouldHandle(e)) {
          // raise double-click and prevent zooming
          if (Date.now() - this._lastClick < DragDropTouch._DBLCLICK) {
            if (this._dispatchEvent(e, "dblclick", e.target)) {
              if (e.cancelable) {
                e.preventDefault();
              }
              this._reset();
              return;
            }
          }
          // clear all variables
          this._reset();
          // get nearest draggable element
          var src = this._closestDraggable(e.target);
          if (src) {
            // give caller a chance to handle the hover/move events
            if (!this._dispatchEvent(e, "mousemove", e.target) &&
              !this._dispatchEvent(e, "mousedown", e.target)) {
              // get ready to start dragging
              this._dragSource = src;
              this._ptDown = this._getPoint(e);
              this._lastTouch = e;
              if (e.cancelable) {
                e.preventDefault();
              }
              // show context menu if the user hasn"t started dragging after a while
              setTimeout(function () {
                if (_this._dragSource == src && _this._img == null) {
                  if (_this._dispatchEvent(e, "contextmenu", src)) {
                    _this._reset();
                  }
                }
              }, DragDropTouch._CTXMENU);
              if (DragDropTouch._ISPRESSHOLDMODE) {
                this._pressHoldInterval = setTimeout(function () {
                  _this._isDragEnabled = true;
                  _this._touchmove(e);
                }, DragDropTouch._PRESSHOLDAWAIT);
              }
            }
          }
        }
      };
      DragDropTouch.prototype._touchmove = function (e) {
        if (this._shouldCancelPressHoldMove(e)) {
          this._reset();
          return;
        }
        if (this._shouldHandleMove(e) || this._shouldHandlePressHoldMove(e)) {
          // see if target wants to handle move
          var target = this._getTarget(e);
          if (this._dispatchEvent(e, "mousemove", target)) {
            this._lastTouch = e;
            if (e.cancelable) {
              e.preventDefault();
            }
          return;
          }
          // start dragging
          if (this._dragSource && !this._img && this._shouldStartDragging(e)) {
            this._dispatchEvent(e, "dragstart", this._dragSource);
            this._createImage(e);
            this._dispatchEvent(e, "dragenter", target);
          }
          // continue dragging
          if (this._img) {
            this._lastTouch = e;
            if (e.cancelable) {
              e.preventDefault(); // prevent scrolling
            }
            if (target != this._lastTarget) {
              this._dispatchEvent(this._lastTouch, "dragleave", this._lastTarget);
              this._dispatchEvent(e, "dragenter", target);
              this._lastTarget = target;
            }
            this._moveImage(e);
            this._isDropZone = this._dispatchEvent(e, "dragover", target);
          }
        }
      };
      DragDropTouch.prototype._touchend = function (e) {
        if (this._shouldHandle(e)) {
          // see if target wants to handle up
          if (this._dispatchEvent(this._lastTouch, "mouseup", e.target)) {
            if (e.cancelable) {
              e.preventDefault();
            }
            return;
          }
          // user clicked the element but didn"t drag, so clear the source and simulate a click
          if (!this._img) {
            this._dragSource = null;
            this._dispatchEvent(this._lastTouch, "click", e.target);
            this._lastClick = Date.now();
          }
          // finish dragging
          this._destroyImage();
          if (this._dragSource) {
            if (e.type.indexOf("cancel") < 0 && this._isDropZone) {
              this._dispatchEvent(this._lastTouch, "drop", this._lastTarget);
            }
            this._dispatchEvent(this._lastTouch, "dragend", this._dragSource);
            this._reset();
          }
        }
      };
      // ** utilities
      // ignore events that have been handled or that involve more than one touch
      DragDropTouch.prototype._shouldHandle = function (e) {
        return e &&
          !e.defaultPrevented &&
          e.touches && e.touches.length < 2;
      };
      
      // use regular condition outside of press & hold mode
      DragDropTouch.prototype._shouldHandleMove = function (e) {
        return !DragDropTouch._ISPRESSHOLDMODE && this._shouldHandle(e);
      };
      
      // allow to handle moves that involve many touches for press & hold
      DragDropTouch.prototype._shouldHandlePressHoldMove = function (e) {
        return DragDropTouch._ISPRESSHOLDMODE &&
          this._isDragEnabled && e && e.touches && e.touches.length;
      };
      
      // reset data if user drags without pressing & holding
      DragDropTouch.prototype._shouldCancelPressHoldMove = function (e) {
        return DragDropTouch._ISPRESSHOLDMODE && !this._isDragEnabled &&
          this._getDelta(e) > DragDropTouch._PRESSHOLDMARGIN;
      };
      
      // start dragging when specified delta is detected
      DragDropTouch.prototype._shouldStartDragging = function (e) {
        var delta = this._getDelta(e);
        return delta > DragDropTouch._THRESHOLD ||
          (DragDropTouch._ISPRESSHOLDMODE && delta >= DragDropTouch._PRESSHOLDTHRESHOLD);
      }
      
      // clear all members
      DragDropTouch.prototype._reset = function () {
        this._destroyImage();
        this._dragSource = null;
        this._lastTouch = null;
        this._lastTarget = null;
        this._ptDown = null;
        this._isDragEnabled = false;
        this._isDropZone = false;
        this._dataTransfer = new DataTransfer();
        clearInterval(this._pressHoldInterval);
      };
      // get point for a touch event
      DragDropTouch.prototype._getPoint = function (e, page) {
        if (e && e.touches) {
          e = e.touches[0];
        }
        return { x: page ? e.pageX : e.clientX, y: page ? e.pageY : e.clientY };
      };
      // get distance between the current touch event and the first one
      DragDropTouch.prototype._getDelta = function (e) {
        if (DragDropTouch._ISPRESSHOLDMODE && !this._ptDown) { return 0; }
        var p = this._getPoint(e);
        return Math.abs(p.x - this._ptDown.x) + Math.abs(p.y - this._ptDown.y);
      };
      // get the element at a given touch event
      DragDropTouch.prototype._getTarget = function (e) {
        var pt = this._getPoint(e), el = document.elementFromPoint(pt.x, pt.y);
        while (el && getComputedStyle(el).pointerEvents == "none") {
          el = el.parentElement;
        }
        return el;
      };
      // create drag image from source element
      DragDropTouch.prototype._createImage = function (e) {
        // just in case...
        if (this._img) {
          this._destroyImage();
        }
        // create drag image from custom element or drag source
        var src = this._imgCustom || this._dragSource;
        this._img = src.cloneNode(true);
        this._copyStyle(src, this._img);
        this._img.style.top = this._img.style.left = "-9999px";
        // if creating from drag source, apply offset and opacity
        if (!this._imgCustom) {
          var rc = src.getBoundingClientRect(), pt = this._getPoint(e);
          this._imgOffset = { x: pt.x - rc.left, y: pt.y - rc.top };
          this._img.style.opacity = DragDropTouch._OPACITY.toString();
        }
        // add image to document
        this._moveImage(e);
        document.body.appendChild(this._img);
      };
      // dispose of drag image element
      DragDropTouch.prototype._destroyImage = function () {
        if (this._img && this._img.parentElement) {
          this._img.parentElement.removeChild(this._img);
        }
        this._img = null;
        this._imgCustom = null;
      };
      // move the drag image element
      DragDropTouch.prototype._moveImage = function (e) {
        var _this = this;
        requestAnimationFrame(function () {
          if (_this._img) {
            var pt = _this._getPoint(e, true), s = _this._img.style;
            s.position = "absolute";
            s.pointerEvents = "none";
            s.zIndex = "999999";
            s.left = Math.round(pt.x - _this._imgOffset.x) + "px";
            s.top = Math.round(pt.y - _this._imgOffset.y) + "px";
          }
        });
      };
      // copy properties from an object to another
      DragDropTouch.prototype._copyProps = function (dst, src, props) {
        for (var i = 0; i < props.length; i++) {
          var p = props[i];
          dst[p] = src[p];
        }
      };
      DragDropTouch.prototype._copyStyle = function (src, dst) {
        // remove potentially troublesome attributes
        DragDropTouch._rmvAtts.forEach(function (att) {
          dst.removeAttribute(att);
        });
        // copy canvas content
        if (src instanceof HTMLCanvasElement) {
          var cSrc = src, cDst = dst;
          cDst.width = cSrc.width;
          cDst.height = cSrc.height;
          cDst.getContext("2d").drawImage(cSrc, 0, 0);
        }
        // copy style (without transitions)
        var cs = getComputedStyle(src);
        for (var i = 0; i < cs.length; i++) {
          var key = cs[i];
          if (key.indexOf("transition") < 0) {
            dst.style[key] = cs[key];
          }
        }
        dst.style.pointerEvents = "none";
        // and repeat for all children
        for (var i = 0; i < src.children.length; i++) {
          this._copyStyle(src.children[i], dst.children[i]);
        }
      };
      DragDropTouch.prototype._dispatchEvent = function (e, type, target) {
        if (e && target) {
          var evt = document.createEvent("Event"), t = e.touches ? e.touches[0] : e;
          evt.initEvent(type, true, true);
          evt.button = 0;
          evt.which = evt.buttons = 1;
          this._copyProps(evt, e, DragDropTouch._kbdProps);
          this._copyProps(evt, t, DragDropTouch._ptProps);
          evt.dataTransfer = this._dataTransfer;
          target.dispatchEvent(evt);
          return evt.defaultPrevented;
        }
        return false;
      };
      // gets an element"s closest draggable ancestor
      DragDropTouch.prototype._closestDraggable = function (e) {
        for (; e; e = e.parentElement) {
          if (e.hasAttribute("draggable") && e.draggable) {
            return e;
          }
        }
        return null;
      };
      return DragDropTouch;
    }());
    /*private*/ DragDropTouch._instance = new DragDropTouch(); // singleton
    // constants
    DragDropTouch._THRESHOLD = 5; // pixels to move before drag starts
    DragDropTouch._OPACITY = 0.5; // drag image opacity
    DragDropTouch._DBLCLICK = 500; // max ms between clicks in a double click
    DragDropTouch._CTXMENU = 900; // ms to hold before raising "contextmenu" event
    DragDropTouch._ISPRESSHOLDMODE = false; // decides of press & hold mode presence
    DragDropTouch._PRESSHOLDAWAIT = 400; // ms to wait before press & hold is detected
    DragDropTouch._PRESSHOLDMARGIN = 25; // pixels that finger might shiver while pressing
    DragDropTouch._PRESSHOLDTHRESHOLD = 0; // pixels to move before drag starts
    // copy styles/attributes from drag source to drag image element
    DragDropTouch._rmvAtts = "id,class,style,draggable".split(",");
    // synthesize and dispatch an event
    // returns true if the event has been handled (e.preventDefault == true)
    DragDropTouch._kbdProps = "altKey,ctrlKey,metaKey,shiftKey".split(",");
    DragDropTouch._ptProps = "pageX,pageY,clientX,clientY,screenX,screenY".split(",");
    DragDropTouch_1.DragDropTouch = DragDropTouch;
  })(DragDropTouch || (DragDropTouch = {}));

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
  let numArtists = artists.length;
  let gridOutlineFound = false;
  let gridOutline = null;
  
  for(let q = 3; q<numArtists; q++) {
    if(!gridOutlineFound) {
      console.log("Running parseArtists at loop #"+q);
      console.log("Checking subsets of first "+q+" artists");
      gridOutline = await parseArtists(progressContainer,q).then(() =>  validateGroups(q));
      if(gridOutline) { 
        gridOutlineFound = true;
        console.log("Found valid match for below grid!");
        console.log(gridOutline);
        console.dir(gridOutline);
      } else {
        console.log("No valid match found, incrementing search");
      }
    }
  }  
  console.log(gridOutline);
  saveCustomGrid(gridOutline);
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
let masterGridOutline = {};
let startIndex = 0;

async function parseArtists(progressContainer, endIndex = 3) {
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
  startIndex = endIndex;
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

async function validateGroups(groupSize = 3) {
  let debug = true;
  let artists = Object.keys(masterArtistDataSumm);
  if(debug) {console.log("Groups to compare registered as:");console.log(artists);}
  if(debug) {console.dir(masterArtistDataSumm);}
  if(debug) {console.dir(masterArtistDataDetails);}
  if(debug) {console.log("Checking group configs now");}

  //Check group iterations, we'll start with just the top 4 and add looping logic later- 
  let iterations = findIterations(groupSize);
  console.log("iterations returned:");
  console.log(iterations);
  console.dir(iterations);

  let yearRange = null;
  let wordCount = null;
  let songLength = null;
  let currIteration = null;
  let matchFound = false;
  
  for(var x = 0; x < iterations.length; x++) { //TODO: Sort by score instead of at random
    if(!matchFound) {
      yearRange = null;
      wordCount = null;
      songLength = null;
      let currIterationObj = iterations[x];
      currIteration = currIterationObj.perm; 
      console.log("Checking years for "+currIteration);
      yearRange = await processDateRanges(currIteration).then(yearRangeData => selectDateRange(yearRangeData));
      if(yearRange) { console.log("found year range starting "+yearRange);}
      console.log("Checking wordcounts for "+currIteration);
      wordCount = selectWordCounts(currIteration, [1,3]); //Just one and three word titles to start
      if(wordCount) { console.log("found word count match for "+wordCount);}
      console.log("Checking durations for "+currIteration);
      songLength = selectSongLength(currIteration, [{type: "under", durmin: 2},{type: "over", durmin: 5}]); //Just under 2 mins, over 5 mins to start
      if(songLength) { console.log("found duration match for "+songLength);}
      if(wordCount && songLength && yearRange) { 
        matchFound = true;
        console.log("Found complete match on iteration "+currIteration);
      } else {
        let missingElements = [];
        if(!wordCount){missingElements.push("Word Count");}
        if(!songLength){missingElements.push("Song Length");}
        if(!yearRange){missingElements.push("Year Range");}
        console.log("Missing "+missingElements.join(", ")+" for match on iteration "+currIteration);
      }
    } else {console.log("Skipping iteration as all criteria already found");}
  }
  if(matchFound) {
    let categoriesObj = {yearRange: yearRange, wordCount: wordCount, songLength: songLength };
    console.log("Final categories determined as:");
    console.log(categoriesObj);
    console.dir(categoriesObj);
    console.log("For iteration:"+currIteration);
    return {iteration: currIteration, categories: categoriesObj};
  } else{
    console.log("No valid categories found for iterations");
    return null;
  }
}

function findIterations(groupSize) {
  let numVariations = findFreshVariations(groupSize);
  console.log(numVariations+" possible variations of group size "+groupSize+" found.");
  
  let permutations = [];
  let emptyPerm = [];
  for(var n = 0; n<groupSize - 1; n++) {
    emptyPerm.push(0);
  }
  emptyPerm.push(1);
  console.log("Empty perm built for group size "+groupSize+" as:");
  console.dir(emptyPerm);
  //Take in number of iterations, remove already checked, rank by lowest sum of parts
  //return sorted array with highest prio groupings at top
  let currPerm = emptyPerm;
  console.log("building Iterations, starting at: ["+currPerm.join(",")+"]");

  for(var l=0; l<groupSize-2; l++){ // Var l will count the location of the first 1
    currPerm[l] = 1;
    console.log("setting "+l+" value to first 1: ["+currPerm.join(",")+"]");
    for(var m=l+1; m<groupSize-1; m++){ // Var m will count the location of the second 1
      currPerm[m] = 1;
      console.log("setting"+m+"value to second 1: ["+currPerm.join(",")+"]");
      let currScore = m+l;
      console.log("Setting score of current perm to "+currScore+" and appending to Permutations");
      permutations.push({perm: currPerm.join(","), score: currScore});
      currPerm[m] = 0;
    }
    currPerm[l] = 0;
  }
  for(var x = 0; x < permutations.length; x++) {
    let obsPerms = permutations[x];
    let obsPerm = obsPerms.perm;
    let obsScore = obsPerms.score;
    console.log("Permutation #"+x+" is "+obsPerm+" with score "+obsScore);
  }
  return permutations;
}

function findFreshVariations(groupSize) {  
  let newVars = 1;
  if(groupSize > 3) {
    newVars = (groupSize-2)+findFreshVariations(groupSize-1);}
  return newVars;
}

async function progressFailure() {
  let debug = true;
  if(debug) {console.log("Groups failed to update");}
  //Here is where we look for specific groups, decide which date ranges/number of words to use, then pass over to the encoder!
}


async function processDateRanges(currIteration) {
  let fullArtists = Object.keys(masterArtistDataSumm);
  let currPattern = currIteration.split(",");
  // console.log("Checking years for current iteration: ");
  console.log(currPattern);

  let artists = [];
  for(let y = 0; y<currPattern.length; y++) {
    if(currPattern[y] == 1) { 
      artists.push(fullArtists[y]); 
      console.log("Adding "+fullArtists[y]+" to list of artists to compare");
    } else {
      console.log("Skipping "+fullArtists[y]+" due to pattern exclusion");
    }
  }
  
  let artistYearsBucketObj = {};
  for (let x = 0; x < artists.length; x++) {
    let artistName = artists[x];
    // console.log("Checking date ranges for "+artistName+" of years:");
    let releaseSummObj = masterArtistDataSumm[artistName]["releaseDate"];
    let artistYearsArr = Object.keys(releaseSummObj);
    // console.dir(artistYearsArr);
    for (let y = 0; y < artistYearsArr.length; y++) {
      let observedYear = parseInt(artistYearsArr[y]);
      let yearReleases = releaseSummObj[observedYear];
      let yearBucket = observedYear - observedYear%5;
      let relevantBuckets = [];
      relevantBuckets.push(yearBucket);
      if(yearBucket == observedYear) {
        relevantBuckets.push(observedYear - 5);
      }
      // console.log("Checking year: "+observedYear+" with "+yearReleases+" releases");
      for (let z = 0; z < relevantBuckets.length; z++) {
        let currYear = relevantBuckets[z];
        // console.log("Assigned to bucket "+currYear);
        let currYearKeys = Object.keys(artistYearsBucketObj);
        let currYearArtistKeys = [];
        // console.log("Checking if "+currYear+"exists in existing "+(currYearKeys.length)+" logged years of:");
        // console.log(currYearKeys);
        if(currYearKeys.length >= 0 && currYearKeys.includes(currYear.toString())) { //If year bucket already exists
          currYearArtistKeys = Object.keys(artistYearsBucketObj[currYear]);
          if(currYearArtistKeys.length >= 0 && currYearArtistKeys.includes(artistName)) { //And artist exists in that year bucket
            artistYearsBucketObj[currYear][artistName] += yearReleases; //Increment bucket release count by current year
            // console.log(currYear+ " & "+artistName+" already exists, incrementing by "+yearReleases);
          } else { //But if year bucket exists and artist not found, create artist record and set to yearReleases
            artistYearsBucketObj[currYear][artistName] = yearReleases;
            // console.log(currYear+" exists, "+artistName+" doesn't already exists, creating & setting to "+yearReleases);
          }
        } else { //If year bucket doesn't yet exist, create year and add artist//num release pair
          artistYearsBucketObj[currYear] = {[artistName]: yearReleases};
          // console.log(currYear+ " & "+artistName+" don't exist, creating and setting to "+yearReleases);
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

function selectDateRange(yearRangeData) {
  let years = Object.keys(yearRangeData);
  let yearRankObj = {};
  let maxMin = 0;
  let yearOfMaxMin = 0;
  for(var z = 0; z<years.length; z++){
    let observedYear = years[z];
    let yearObj = yearRangeData[observedYear];
    let yearArtists = Object.keys(yearObj);
    //First check if enough artists even exist for the year
    console.log("Checking year of "+observedYear);
    if(yearArtists.length == 3) {
      console.log(observedYear+" has all artists, checking min count of releases");
      let minCount = 420;
      for(var i = 0; i<3; i++) {
        let currArtist = yearArtists[i];
        let currCount = yearObj[currArtist];
        console.log(currArtist+" has count of "+currCount+" in year "+observedYear);
        if(currCount < minCount) { 
          minCount = currCount;
        }
        console.log("Min releases from valid artist in "+observedYear+" recorded as "+minCount);
      }
      if(minCount > maxMin) { 
        console.log("Min count of "+minCount+" is lower than max min of "+maxMin+" for year "+observedYear+", recording as new maxMin year");
        maxMin = minCount;
        yearOfMaxMin = observedYear;
      }
    } else {console.log(observedYear+" skipped for not having all artists");}
  }
  if(maxMin < 5) {
    console.log("No years with 5+ releases from all artists found");
    return null;
  } else { 
    console.log("Best year identified as "+yearOfMaxMin+" to "+(parseInt(yearOfMaxMin)+5));
    return yearOfMaxMin;
  }
}

function selectWordCounts(currIteration,validCountsArr) {
  let fullArtists = Object.keys(masterArtistDataSumm);
  let currPattern = currIteration.split(",");
  // console.log("Checking years for current iteration: ");
  console.log(currPattern);

  let artists = [];
  for(let y = 0; y<currPattern.length; y++) {
    if(currPattern[y] == 1) { 
      artists.push(fullArtists[y]); 
      console.log("Adding "+fullArtists[y]+" to list of artists to compare");
    } else {
      console.log("Skipping "+fullArtists[y]+" due to pattern exclusion");
    }
  }

  let foundWordCount = false;
  let artistWordCountBucketObj = {};
  for(let z = 0; z<validCountsArr.length; z++) {
    let numValidArtists = 0;
    if(!foundWordCount) {
      let currWordCount = validCountsArr[z];
      for (let x = 0; x < artists.length; x++) {
        let artistName = artists[x];
        let countSummObj = masterArtistDataSumm[artistName]["wordCount"];
        let artistCountArr = Object.keys(countSummObj);
        console.log("Checking for songs with "+currWordCount+" by "+artistName);
        let currCountStr = currWordCount.toString();
        if(artistCountArr.length > 0 && artistCountArr.includes(currCountStr)) {
          numValidArtists++;
          console.log("Found songs of matching length for "+artistName+"! Now at "+numValidArtists+" matched for "+currWordCount+" word length songs");
        }
        if(numValidArtists == 3) {
          console.log("All three artists matched, returning");
          foundWordCount = true;
          return currWordCount;
        }
      }
    }
  }
  console.log("No match found on wordcount, returning null");
  return null;
}


function selectSongLength(currIteration,validLengthsArr) {
  let fullArtists = Object.keys(masterArtistDataSumm);
  let currPattern = currIteration.split(",");
  // console.log("Checking years for current iteration: ");
  console.log(currPattern);

  let artists = [];
  for(let y = 0; y<currPattern.length; y++) {
    if(currPattern[y] == 1) { 
      artists.push(fullArtists[y]); 
      console.log("Adding "+fullArtists[y]+" to list of artists to compare");
    } else {
      console.log("Skipping "+fullArtists[y]+" due to pattern exclusion");
    }
  }

  let foundLength = false;
  let artistLengthsBucketObj = {};
  for(let z = 0; z<validLengthsArr.length; z++) {
    let numValidArtists = 0;
    if(!foundLength) {
      let currLengthObj = validLengthsArr[z];
      let comparisonType = currLengthObj.type;
      let paramLength = currLengthObj.durmin*60000;
      for (let x = 0; x < artists.length; x++) {
        let artistName = artists[x];
        let lengthSummObj = masterArtistDataSumm[artistName]["duration"];
        let lengthArr = Object.keys(lengthSummObj);
        let songArtistMatches = 0;
        for (let a = 0; a < lengthArr.length; a++) { 
          let dataSetDur = parseInt(lengthArr[a]);
          let dataSetDurStr = lengthArr[a];
          if(comparisonType == "under") { 
            console.log("Checking for songs by "+artistName+" "+comparisonType+"(u) "+paramLength+" ms");
            if(dataSetDur <= paramLength) { 
              songArtistMatches += lengthSummObj[dataSetDurStr];
              console.log("Found match for "+lengthSummObj[dataSetDurStr]+" songs on "+lengthArr[a]+", total matches for artist at: "+songArtistMatches);
            }
          } else if(comparisonType == "over") { 
            let paramLengthTrue=paramLength+60000; // By default we sort songs by the duration they're under, so we need to increment up by 1 here. 
            console.log("Checking for songs by "+artistName+" "+comparisonType+"(o) "+paramLengthTrue+" ms");
            if(dataSetDur >= paramLengthTrue) { 
              songArtistMatches += lengthSummObj[dataSetDurStr];
              console.log("Found match for "+lengthSummObj[dataSetDurStr]+" songs on "+lengthArr[a]+", total matches for artist at: "+songArtistMatches);
            } 
          }
        }
        if(songArtistMatches > 1) {
          numValidArtists++;
        }
      }
      if(numValidArtists==3) {
        foundLength = true;
        console.log("Found complete matches for "+comparisonType+" "+paramLength+" ms");
        return currLengthObj;
      }
    }
  }
  console.log("No match found on duration, returning null");
  return null;
}

function saveCustomGrid(gridOutline) {
  let customGridDetails = populateGridData(gridOutline);
  
}

// function assembleGridFrame(gridOutline) {
//   let currIteration = gridOutline.iteration;
//   let fullArtists = Object.keys(masterArtistDataSumm);
//   let currPattern = currIteration.split(",");
  
//   // console.log("Checking years for current iteration: ");
//   console.log(currPattern);

//   let artists = [];
//   for(let y = 0; y<currPattern.length; y++) {
//     if(currPattern[y] == 1) { 
//       artists.push(fullArtists[y]); 
//     } else {
//       console.log("Skipping "+fullArtists[y]+" due to pattern exclusion");
//     }
//   }
  
//   for(let z = 0; z<artists.length; z++) {
//     let artistName = artists[0];
//     console.log("Adding "+artistName+" to framework");
//     masterGridOutline[artistName] = {"songLength": [], "wordCount": [], "releaseDate": []};
//   }   
// }

function populateGridData(gridOutline) { 
  // assembleGridFrame(gridOutline);
  let currIteration = gridOutline.iteration;
  let fullArtists = Object.keys(masterArtistDataSumm);
  let currPattern = currIteration.split(",");
  let paramWordCount = gridOutline.categories.wordCount;
  let paramLength = gridOutline.categories.songLength.durmin*60000;
  let comparisonType = gridOutline.categories.songLength.type;
  let paramYear = parseInt(gridOutline.categories.yearRange);
  
  // console.log("Checking years for current iteration: ");
  console.log(currPattern);

  let artists = [];
  for(let y = 0; y<currPattern.length; y++) {
    if(currPattern[y] == 1) { 
      artists.push(fullArtists[y]); 
      console.log("Adding "+fullArtists[y]+" to final list of artists to compare");
    } else {
      console.log("Skipping "+fullArtists[y]+" due to pattern exclusion");
    }
  }
  
  for(let z = 0; z<artists.length; z++) {
    let artistName = artists[z];
    let artistDetailsObj = masterArtistDataDetails[artistName];
    
    //First lets find the songs matching the final duration category
    let durationObj = artistDetailsObj.duration;
    let durationKeys = Object.keys(durationObj);
    let songsMatchingDuration = [];
    for(let a=0; a<durationKeys.length; a++) {
      let dataSetDurStr = durationKeys[a];
      let dataSetDur = parseInt(dataSetDurStr);
      if(comparisonType == "under") { 
        console.log("Finding all songs by "+artistName+" "+comparisonType+"(u) "+paramLength+" ms");
        if(dataSetDur <= paramLength) {
          let songDurMatches = durationObj[dataSetDurStr];
          songDurMatches.forEach(songMatch => {
            songsMatchingDuration.push(songMatch);
          });
          console.log("Adding these songs to master list for "+artistName);
          console.dir(songDurMatches);
        }
      } else if(comparisonType == "over") { 
        let paramLengthTrue=paramLength+60000; // By default we sort songs by the duration they're under, so we need to increment up by 1 here. 
        console.log("Finding all songs by "+artistName+" "+comparisonType+"(o) "+paramLengthTrue+" ms");
        if(dataSetDur >= paramLengthTrue) { 
          let songDurMatches = durationObj[dataSetDurStr];
          songDurMatches.forEach(songMatch => {
            songsMatchingDuration.push(songMatch);
          });
          console.log("Adding these songs to master list for "+artistName);
          console.dir(songDurMatches);
        } 
      }
    }
  
    console.log("creating masterGridOutline data for");
    console.dir(songsMatchingDuration);
    masterGridOutline[artistName] = {songLength: songsMatchingDuration};

    //Next we find songs matching the final title length count
    let wordCountObj = artistDetailsObj.wordCount;
    let songsMatchingWordCount = wordCountObj[paramWordCount];
    masterGridOutline[artistName]["wordCount"] = songsMatchingWordCount;
    
    //Next we find songs matching the date range
    let yearsObj = artistDetailsObj.releaseDate;
    let yearKeys = Object.keys(yearsObj);
    let songsMatchingDate = [];
    for(let b=0; b<yearKeys.length; b++) {
      let detailsSetYear = yearKeys[b];
      let detailsSetYearInt = parseInt(yearKeys[b]);
      if(detailsSetYearInt >= paramYear && detailsSetYearInt <= paramYear + 5) {
        let songYearMatches = yearsObj[detailsSetYear];
        songYearMatches.forEach(songMatch => {
          songsMatchingDate.push(songMatch);
        });
      }
    }
    
    masterGridOutline[artistName]["yearRange"] = songsMatchingDate;
  }
  console.log("Final grid outline is:");
  console.dir(masterGridOutline);
  storeGridInSql(masterGridOutline, gridOutline.categories);
}

async function storeGridInSql(masterGridOutline, categories) { 
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/create-custom-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({content: masterGridOutline, categories: categories})
    });
    if (!response.ok) {
      throw new Error("Failed to create custom table");
    }
    const data = await response.json();
    let responseGridId = data.customGridId;
    console.log("Custom table created successfully, gridId read as "+responseGridId);
    encodeCustomAnswers(responseGridId);
  } catch (error) {
    console.error("Error creating custom table: ", error);
  }
}

async function encodeCustomAnswers(customGridId) {
  let data = null;
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/custom-grid-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_grid_id: customGridId })
    });

    data = await response.json();
  } catch (error) {
    console.error("Error encoding answers for grid:", error);
  }
  
  await fetchGridOutline(customGridId);
}
async function fetchGridOutline(customGridId) {
  fetch("https://music-grid-io-42616e204fd3.herokuapp.com/custom-grid-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_grid_id: customGridId })
  })
    .then(response => response.json())
    .then(data => buildGridOutline(data))
    .catch(error => console.error("Error fetching grid data:", error));
}
async function buildGridOutline(data) {
  const gridContainer = document.getElementById("grid-container");
  gridContainer.innerHTML = ""; // Clear existing content
  grid-container.style.display="flex";

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
      categoryRow.appendChild(createSongCell(cellKey));
    });

    gridContainer.appendChild(categoryRow);
  });
  await answerEncoder(data, customGridId);
}
function createCell(className = "dummy1", text = "", classPrefix = "dummy2") {
  const cell = document.createElement("div");
  const className2 = classPrefix + text.replaceAll(" ","-");
  cell.classList.add("cell", className, className2);
  cell.textContent = text;
  return cell;
}

function createSongCell(cellKey) {
  const cell = document.createElement("div");
  cell.classList.add("cell", "song-cell",  cellKey.replaceAll(" ","-"), "unstarted");
  
  const whitespace = document.createElement("div");
  cell.appendChild(whitespace);
  return cell;
}

async function answerEncoder(data, customGridId) {
  console.log("Parsing grid data for grid ID:", customGridId);
  const answersUnscored = {};
  const artists = {};

  // Parse the answers and artists from the data
  data.forEach(item => {
    if (item.field_type === "Answer") {
      answersUnscored[item.field] = item.field_value.split("\", \"").map(answer => answer.trim().replace(/^'|'$/g, ""));
    } else if (item.field_type === "Artist") {
      artists[item.field] = item.field_value;
    }
  });

  const answerPops = {};
  for (const [fieldKey, songs] of Object.entries(answersUnscored)) {
    //Update frontend to show we're processing the song
    var nameFieldKey = fieldKey.replaceAll(" ","-");
    var songProgressElemArr = document.getElementsByClassName(nameFieldKey);
    var songProgressElem = null;
    console.log("searching for cell "+nameFieldKey+" to update to in-progress");
    console.log("found "+songProgressElemArr.length+" matching elements");
    if(songProgressElemArr.length>0) {
      console.log("matching to:");
      songProgressElem = songProgressElemArr[0];
      console.log(songProgressElem);
      songProgressElem.classList.remove("finished");
      songProgressElem.classList.remove("unstarted");
      songProgressElem.classList.add("in-progress");
    }
    const nestedSongPops = [];
    const [category, artistKey] = fieldKey.split(" ");
    const artistName = artists[artistKey];

    for (const songData of songs) {
      let songParsed = songData;
      if (songParsed.slice(0,1) == "\"") {
        songParsed = songParsed.slice(1,songParsed.length);
      }
      if (songParsed.slice(songParsed.length-1,songParsed.length) == "\"") {
        songParsed = songParsed.slice(0,songParsed.length-1);
      }
      try {
        const searchTerm = `${songParsed}`; 
        const artistSearch = `${artistName}`;
        console.log(`Fetching data for ${searchTerm} by ${artistSearch}`);
        const resultsObj = await searchSpotify(searchTerm, artistSearch);
        console.log("Received passback resultsObj");
        console.dir(resultsObj);
        console.log(resultsObj.popularity);
        console.log(resultsObj.preview_url);
        const popularity = resultsObj.popularity || -1;
        const previewUrl = resultsObj.preview_url || "";
        nestedSongPops.push({ song: songParsed, popularity, previewUrl });
        if(songProgressElemArr.length>0) {
          songProgressElem.classList.remove("in-progress");
          songProgressElem.classList.remove("unstarted");
          songProgressElem.classList.add("finished");
        }
      } catch (error) {
        console.error("Error fetching Spotify data for song:", songParsed, error);
      }
    }
    answerPops[fieldKey] = nestedSongPops;
    
  }

  console.log("Encoded answers ready for update:", answerPops);
  calculateAnswerScores(answerPops, customGridId);
}

async function searchSpotify(searchTerm, artistSearch) {
  let easyModeBool = true;
  let encoderReq = true;
  const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/search-encoding-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchTerm, easyModeBool, artistSearch, encoderReq })
  });
  console.log("Received response: "+response);
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
}

async function calculateAnswerScores(answersUnscored, customGridId) {
  console.log("Calculating answer scores for Answer pops");
  let gridIdString = customGridId.toString();
  const answersWithScores = [];

  for (const [fieldKey, nestedSongPopsArr] of Object.entries(answersUnscored)) {
    console.log(`Calculating scores for ${fieldKey}`);
    const filteredSongPopsArr = [];
    for (const songPopElement of nestedSongPopsArr) {
      if(songPopElement.popularity > 0) {
        filteredSongPopsArr.push(songPopElement);
      }
    }
    // Calculate max and min popularity in the field
    let fieldScoreMax = Math.max(...filteredSongPopsArr.map(o => o.popularity));
    let fieldScoreMin = Math.min(...filteredSongPopsArr.map(o => o.popularity));

    // Calculate scores for each song
    for (const { song, popularity, previewUrl } of nestedSongPopsArr) {
      let normedAnswerScore = 11;
      if( popularity == -1 ) {
        normedAnswerScore = 11;
      } else {
        normedAnswerScore = (fieldScoreMin === fieldScoreMax) ? 11 : 6 + 5 * Math.round(10 * (1 - ((popularity - fieldScoreMin) / (fieldScoreMax - fieldScoreMin)))) / 10;
      }
      answersWithScores.push({
        fieldKey,
        song,
        popularity,
        normedAnswerScore,
        previewUrl,
        customGridId: gridIdString
      });
    }
  }

  await updateEncodedAnswers(answersWithScores);
  linkToGrid(customGridId);
}

async function updateEncodedAnswers(encodedAnswers) {
  try {
    const response = await fetch("https://music-grid-io-42616e204fd3.herokuapp.com/update-custom-encoded-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encodedAnswers })
    });

    if (!response.ok) {
      throw new Error("Failed to update encoded answers");
    }

    console.log("Encoded answers updated successfully");
  } catch (error) {
    console.error("Error updating encoded answers:", error);
  }
}

function linkToGrid(customGridId) {
  const progressContainer = document.getElementById("gridProgressContainer");
  progressContainer.innerHTML = "";
  const heroContainers = document.getElementsByClassName("artist-content");
  const heroContainer = heroContainers[0];
  heroContainer.innerHTML = "";
  heroContainer.innerHTML = "<h1> Grid Created! </h1> <br> <p> Click through below to play your custom grid.</p> <div class =\"proceedButtonWrapper\"><a href=/play-custom-grid?custom_grid_id="+customGridId+"><button class=\"continue-button\">Play My Grid</button></a>";
}
