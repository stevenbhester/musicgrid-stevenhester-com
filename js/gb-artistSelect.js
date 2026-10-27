// MusicGrid grid builder, step 2: pick top artists, then find a grid that works.
// The UI layer at the top of this file was rebuilt. The grid-finding logic
// below it is the original, with clearer failure handling added.

const BUILDER_API = "https://music-grid-io-42616e204fd3.herokuapp.com";
const SPOTIFY_CLIENT_ID = "1d952129111a45b2b86ea1c08dd9c6ca";
let builtGridTitle = "";
let buildStarted = false;

// "spotify" builds from the visitor's top artists (artist-selection.html).
// "search" lets anyone pick artists by name, no Spotify login (manual-artist-pick.html).
const BUILD_SOURCE = document.body.dataset.source === "search" ? "search" : "spotify";
const MIN_PICKS = 3;
const MAX_PICKS = 10;
let lastPicked = [];

function setStep(step) {
  const pickStep = document.getElementById("stepPick");
  const buildStep = document.getElementById("stepBuild");
  if (!pickStep || !buildStep) return;
  pickStep.className = step === "pick" ? "now" : "done";
  buildStep.className = step === "build" ? "now" : step === "done" ? "done" : "";
}

function showView(name) {
  document.querySelectorAll("[data-view]").forEach(view => {
    view.hidden = view.dataset.view !== name;
  });
  window.scrollTo(0, 0);
}

function showBuildFailure(message, needsReconnect) {
  document.getElementById("failMsg").textContent = message;
  document.getElementById("reconnect").hidden = !needsReconnect;
  const change = document.getElementById("changeArtists");
  if (change) change.hidden = BUILD_SOURCE !== "search" || !lastPicked.length;
  setStep("pick");
  showView("failed");
}

function setBuildStatus(message) {
  document.getElementById("buildStatus").textContent = message;
}

let builderToastTimer = null;
function builderToast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(builderToastTimer);
  builderToastTimer = setTimeout(() => node.classList.remove("show"), 2400);
}

function initBuilder() {
  document.getElementById("startOver").addEventListener("click", () => window.location.reload());
  document.getElementById("buildGrid").addEventListener("click", saveBuiltGrid);
  const back = document.getElementById("chooseBack");
  if (back) back.addEventListener("click", () => (BUILD_SOURCE === "search" ? backToPicking() : window.location.reload()));
  document.getElementById("copyLink").addEventListener("click", copyGridLink);
  if (BUILD_SOURCE === "search") {
    initArtistSearch();
    return;
  }
  if (!localStorage.getItem("access_token")) {
    document.getElementById("noToken").hidden = false;
    document.querySelectorAll("[data-range]").forEach(button => { button.disabled = true; });
  }
  document.querySelectorAll("[data-range]").forEach(button => {
    button.addEventListener("click", () => buttonPressArtist(button.dataset.range));
  });
}

function buttonPressArtist(timeRange) {
  fetchTopArtists(timeRange);
}

async function fetchTopArtists(timeRange) {
  showView("loading");
  const tokenResponseObj = await handleOauth();
  if (tokenResponseObj.err) {
    showBuildFailure(tokenResponseObj.err, true);
    return;
  }
  try {
    const response = await fetch(BUILDER_API + "/fetch-top-artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: tokenResponseObj.accessToken, timeRange: timeRange })
    });
    if (!response.ok) throw new Error("fetch-top-artists returned " + response.status);
    const data = await response.json();
    if (!Array.isArray(data) || data.length < 3) {
      showBuildFailure("Spotify didn't return enough top artists for that window. Try a longer one.");
      return;
    }
    buildArtistList(data);
  } catch (error) {
    console.error("Error fetching top artists:", error);
    showBuildFailure("Couldn't load your top artists. The server might be waking up, so try again in a few seconds.");
  }
}

async function handleOauth() {
  const currentToken = {
    get access_token() { return localStorage.getItem("access_token") || null; },
    get refresh_token() { return localStorage.getItem("refresh_token") || null; },
    get expires() { return localStorage.getItem("expires") || null; },

    save: function (response) {
      const { access_token, refresh_token, expires_in } = response;
      localStorage.setItem("access_token", access_token);
      if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("expires_in", expires_in);
      localStorage.setItem("expires", new Date(Date.now() + (expires_in * 1000)));
    }
  };

  if (!currentToken.access_token || !currentToken.expires) {
    return { err: "Connect Spotify first so we can see your top artists.", accessToken: "000" };
  }
  if (new Date(currentToken.expires).getTime() - Date.now() < 300000) {
    try {
      const token = await refreshToken(currentToken.refresh_token);
      if (!token || !token.access_token) throw new Error("Refresh failed");
      currentToken.save(token);
    } catch (error) {
      return { err: "Your Spotify connection expired. Reconnect to keep going.", accessToken: "000" };
    }
  }
  return { err: null, accessToken: currentToken.access_token };
}

async function refreshToken(refresh_token) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refresh_token
    })
  });
  return await response.json();
}

function buildArtistList(topArtistsData) {
  const list = document.querySelector(".sortable-list");
  list.innerHTML = "";
  topArtistsData.forEach(artist => {
    list.appendChild(createArtistItem(artist.id, artist.name, artist.img));
  });
  renumberArtists();
  showView("pick");
  addEventListeners();
}

const ARROW_UP = "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 19V5M6 11l6-6 6 6\"/></svg>";
const ARROW_DOWN = "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M6 13l6 6 6-6\"/></svg>";
const REMOVE_ICON = "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6 6 18\"/></svg>";
const GRIP = "<svg class=\"icon\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"6\" r=\"1.6\"/><circle cx=\"15\" cy=\"6\" r=\"1.6\"/><circle cx=\"9\" cy=\"12\" r=\"1.6\"/><circle cx=\"15\" cy=\"12\" r=\"1.6\"/><circle cx=\"9\" cy=\"18\" r=\"1.6\"/><circle cx=\"15\" cy=\"18\" r=\"1.6\"/></svg>";

function createArtistItem(id, name, img) {
  const outerItem = document.createElement("li");
  outerItem.classList.add("item");
  outerItem.setAttribute("draggable", "true");
  outerItem.setAttribute("data-artist-id", id);
  outerItem.dataset.img = img || "";

  const rank = document.createElement("span");
  rank.className = "rank";

  // .details holds only the image and the name: buildCustomGrid reads its text.
  const innerDetails = document.createElement("div");
  innerDetails.classList.add("details");
  const artistImage = document.createElement("img");
  artistImage.alt = "";
  artistImage.loading = "lazy";
  if (img) artistImage.src = img;
  const artistName = document.createElement("span");
  artistName.textContent = name;
  innerDetails.appendChild(artistImage);
  innerDetails.appendChild(artistName);

  const moves = document.createElement("div");
  moves.className = "moves";
  [["up", ARROW_UP], ["down", ARROW_DOWN]].forEach(([dir, svg]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "move";
    button.dataset.move = dir;
    button.setAttribute("aria-label", `Move ${name} ${dir}`);
    button.innerHTML = svg;
    moves.appendChild(button);
  });
  if (BUILD_SOURCE === "search") {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "move remove";
    remove.dataset.remove = "";
    remove.setAttribute("aria-label", `Remove ${name}`);
    remove.innerHTML = REMOVE_ICON;
    moves.appendChild(remove);
  }

  const handle = document.createElement("span");
  handle.className = "handle";
  handle.innerHTML = GRIP;

  outerItem.append(rank, innerDetails, moves, handle);
  return outerItem;
}

function renumberArtists() {
  const items = document.querySelectorAll(".sortable-list .item");
  items.forEach((item, index) => {
    item.querySelector(".rank").textContent = index + 1;
    item.querySelector("[data-move='up']").disabled = index === 0;
    item.querySelector("[data-move='down']").disabled = index === items.length - 1;
  });
  updatePickState();
}

async function copyGridLink() {
  const input = document.getElementById("shareUrl");
  const url = input.value;
  if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: builtGridTitle || "My MusicGrid", text: "I made you a MusicGrid. Good luck.", url });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    builderToast("Link copied");
  } catch (error) {
    input.select();
    builderToast("Press Ctrl+C or Cmd+C to copy");
  }
}

function addEventListeners() {
  const sortableList = document.querySelector(".sortable-list");
  const proceedButton = document.querySelector(".proceed-button");

  proceedButton.addEventListener("click", function () {
    proceedButton.disabled = true;
    buildCustomGrid();
  });

  sortableList.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      remove.closest(".item").remove();
      renumberArtists();
      renderArtistResults(artistResults);
      return;
    }
    const move = event.target.closest("[data-move]");
    if (!move) return;
    const item = move.closest(".item");
    if (move.dataset.move === "up" && item.previousElementSibling) {
      sortableList.insertBefore(item, item.previousElementSibling);
    } else if (move.dataset.move === "down" && item.nextElementSibling) {
      sortableList.insertBefore(item.nextElementSibling, item);
    }
    renumberArtists();
    move.focus();
  });

  // Delegated so artists added later (search mode) can be dragged too
  const startDrag = event => {
    const item = event.target.closest(".item");
    if (item) setTimeout(() => item.classList.add("dragging"), 0);
  };
  const endDrag = event => {
    const item = event.target.closest(".item");
    if (item) item.classList.remove("dragging");
    renumberArtists();
  };
  sortableList.addEventListener("dragstart", startDrag);
  sortableList.addEventListener("touchmove", startDrag);
  sortableList.addEventListener("dragend", endDrag);
  sortableList.addEventListener("touchend", endDrag);

  const initSortableList = (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector(".dragging");
    if (!draggingItem) return;
    const siblings = [...sortableList.querySelectorAll(".item:not(.dragging)")];

    // Find the sibling the dragged item should sit before
    let nextSibling = null;
    let priorSibling = null;
    siblings.forEach(sibling => {
      const rect = sibling.getBoundingClientRect();
      const yCoord = rect.top + sibling.offsetHeight / 2;
      if (e.clientY >= yCoord && (!priorSibling || yCoord < priorSibling.getBoundingClientRect().top + priorSibling.offsetHeight / 2)) {
        priorSibling = sibling;
      } else if (e.clientY < yCoord && (!nextSibling || yCoord < nextSibling.getBoundingClientRect().top + nextSibling.offsetHeight / 2)) {
        nextSibling = sibling;
      }
    });
    if (nextSibling) {
      sortableList.insertBefore(draggingItem, nextSibling);
    } else if (priorSibling) {
      sortableList.appendChild(draggingItem);
    }
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
      };
      
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
        for (var ij = 0; ij < src.children.length; ij++) {
          this._copyStyle(src.children[ij], dst.children[ij]);
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

// ---------- Build: check every category, then pick 3 artists and 3 categories ----------

const MAX_CHECK_ARTISTS = 10;
const MIN_SONGS = 2;
const KIND_ORDER = ["spotify", "decade", "ai", "opinion"];
const KIND_INFO = {
  spotify: { title: "Checked with Spotify data", note: "Always right: these come straight from each artist's releases." },
  decade: { title: "Release decade", note: "" },
  ai: { title: "AI-checked", note: "AI decides which songs count, so a few answers may be off." },
  opinion: { title: "Opinion", note: "Judgment calls. Players may disagree with some answers." }
};
const build = { artists: [], results: {}, order: [], labels: {}, kinds: {}, chosenArtists: [], chosenCats: [], preview: null };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Posts to the API and rides out slow work and short outages. 202 means the
// server is still working (asking again joins the same work). A dropped
// connection or a 502-504 (a phone waking from sleep, a server restart) is
// retried a few times.
async function postSlow(path, body, maxWaitMs = 4 * 60000) {
  const started = Date.now();
  let failures = 0;
  for (;;) {
    let response = null;
    try {
      response = await fetch(BUILDER_API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      response = null;
    }
    if (response && response.status === 202) {
      if (Date.now() - started > maxWaitMs) throw new Error(path + " is taking too long");
      await pause(1000);
      continue;
    }
    if (!response || [502, 503, 504].includes(response.status)) {
      failures += 1;
      if (failures > 4) throw new Error(path + " failed: " + (response ? response.status : "no connection"));
      await pause(1500 * failures);
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || path + " returned " + response.status);
    return data;
  }
}

function optionOn(id) {
  const box = document.getElementById(id);
  return Boolean(box && box.checked);
}

function kindOf(id) {
  if (id.startsWith("decade-")) return "decade";
  return build.kinds[id] || "spotify";
}

function buildCustomGrid() {
  const picked = [...document.querySelectorAll(".sortable-list .item")];
  if (buildStarted || picked.length < MIN_PICKS) return;
  buildStarted = true;
  lastPicked = picked.map(item => ({
    id: item.getAttribute("data-artist-id"),
    name: item.querySelector(".details").textContent,
    img: item.dataset.img
  }));
  resetBuildState();
  setStep("build");
  showView("building");
  runChecks(lastPicked.slice(0, MAX_CHECK_ARTISTS)).catch(error => {
    console.error("Checks failed:", error);
    showBuildFailure("Something went wrong while checking your artists. Try again in a moment.");
  });
}

// Easy-mode hints need song clips. With the toggle on, leave out artists
// that have none (checked by the server against iTunes and Deezer).
async function artistsWithClips(artists) {
  if (!optionOn("clipsOnly")) return { kept: artists, dropped: [] };
  setBuildStatus("Checking which artists have song clips for easy mode…");
  const clips = {};
  for (let i = 0; i < artists.length; i += 12) {
    try {
      const data = await postSlow("/artist-clips", { artists: artists.slice(i, i + 12).map(artist => artist.name) }, 90000);
      (data.artists || []).forEach(item => { clips[String(item.name).trim().toLowerCase()] = item.clips; });
    } catch (error) {
      // Couldn't check: keep everyone rather than block the build
    }
  }
  const dropped = artists.filter(artist => clips[artist.name.trim().toLowerCase()] === false);
  return { kept: artists.filter(artist => !dropped.includes(artist)), dropped };
}

function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

async function loadCategoryList() {
  try {
    const response = await fetch(BUILDER_API + "/categories");
    if (!response.ok) return;
    const data = await response.json();
    (data.categories || []).forEach(category => {
      if (category.id === "decade-*") return;
      build.labels[category.id] = category.label;
      build.kinds[category.id] = category.kind;
      build.order.push(category.id);
    });
  } catch (error) {
    // Rows get added as results arrive instead
  }
}

function fetchCategories(artist, kinds) {
  return postSlow("/artist-categories", { artistId: artist.id, artistName: artist.name, kinds });
}

async function runChecks(artists) {
  const kinds = ["spotify"];
  if (optionOn("useAi")) kinds.push("ai");
  if (optionOn("useOpinion")) kinds.push("opinion");
  const { kept, dropped } = await artistsWithClips(artists);
  if (dropped.length) {
    const names = joinNames(dropped.map(artist => artist.name));
    const verb = dropped.length === 1 ? "has" : "have";
    if (kept.length < 3) {
      showBuildFailure(`${names} ${verb} no song clips, so easy-mode hints wouldn't work for them, and that leaves fewer than three artists. Add a few more, or turn off "Only artists with song clips".`);
      return;
    }
    builderToast(`Left out ${names}: no song clips for easy mode`);
  }
  build.artists = kept;
  await loadCategoryList();
  renderMatrix(kinds);
  setBuildStatus(`Reading each artist's songs from Spotify. 0 of ${kept.length} done.`);

  let done = 0;
  const queue = [...kept];
  const worker = async () => {
    while (queue.length) {
      const artist = queue.shift();
      await checkArtist(artist, kinds);
      done += 1;
      setBuildStatus(done < kept.length
        ? `Reading each artist's songs from Spotify. ${done} of ${kept.length} done.`
        : "All checked. Now pick your grid.");
    }
  };
  await Promise.all([worker(), worker()]);

  const readable = kept.filter(artist => build.results[artist.id]);
  if (readable.length < 3) {
    showBuildFailure(`We could only read ${readable.length} of your artists from Spotify, and a grid needs three. Try again in a moment, or swap in other artists.`);
    return;
  }
  await pause(reduceMotion ? 0 : 500);
  showChoose();
}

// ---------- The live check matrix: a row per category, a column per artist ----------

function renderMatrix(kinds) {
  const table = document.getElementById("checkMatrix");
  table.innerHTML = "";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th"));
  build.artists.forEach((artist, index) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "cm-artist";
    th.dataset.col = String(index);
    th.title = artist.name;
    const face = document.createElement(artist.img ? "img" : "span");
    face.className = "cm-face";
    if (artist.img) {
      face.src = artist.img;
      face.alt = "";
    } else {
      face.textContent = artist.name.slice(0, 1).toUpperCase();
    }
    const name = document.createElement("span");
    name.className = "cm-name";
    name.textContent = artist.name;
    th.append(face, name);
    headRow.appendChild(th);
  });
  head.appendChild(headRow);
  table.appendChild(head);
  const body = document.createElement("tbody");
  table.appendChild(body);
  build.order
    .filter(id => kinds.includes(build.kinds[id] || "spotify"))
    .forEach(id => addMatrixRow(id));
}

function addMatrixRow(id) {
  const body = document.querySelector("#checkMatrix tbody");
  if (!body || document.getElementById(`cm-${id}`)) return;
  const row = document.createElement("tr");
  row.id = `cm-${id}`;
  row.dataset.kind = kindOf(id);
  const label = document.createElement("th");
  label.scope = "row";
  label.textContent = build.labels[id] || id;
  if (row.dataset.kind === "ai" || row.dataset.kind === "opinion") {
    const tag = document.createElement("span");
    tag.className = `kind-tag ${row.dataset.kind}`;
    tag.textContent = row.dataset.kind === "ai" ? "AI" : "Opinion";
    label.append(" ", tag);
  }
  row.appendChild(label);
  build.artists.forEach((artist, index) => {
    const cell = document.createElement("td");
    const dot = document.createElement("i");
    // Columns already checked don't have this category (a decade, say)
    dot.className = build.results[artist.id] && build.results[artist.id].checked.includes(row.dataset.kind) ? "dot no" : "dot";
    dot.dataset.col = String(index);
    cell.appendChild(dot);
    row.appendChild(cell);
  });
  // Decades go in order after the Spotify rows
  if (row.dataset.kind === "decade") {
    const decades = [...body.querySelectorAll("tr[data-kind='decade']")];
    const after = decades.filter(other => other.id < row.id).pop();
    const firstLater = body.querySelector("tr[data-kind='ai'], tr[data-kind='opinion']");
    if (after) after.after(row);
    else if (firstLater) body.insertBefore(row, firstLater);
    else body.appendChild(row);
  } else {
    body.appendChild(row);
  }
}

function setColumn(index, state) {
  const head = document.querySelector(`#checkMatrix th[data-col="${index}"]`);
  if (head) head.dataset.state = state;
  if (state === "checking") {
    document.querySelectorAll(`#checkMatrix i.dot[data-col="${index}"]:not(.ok):not(.no)`).forEach(dot => dot.classList.add("wait"));
  }
}

async function revealColumn(index, categories, kinds) {
  Object.values(categories).forEach(category => {
    build.labels[category.id] = category.label;
    build.kinds[category.id] = category.kind;
    if (!build.order.includes(category.id)) build.order.push(category.id);
    if (category.id.startsWith("decade-")) addMatrixRow(category.id);
  });
  const rows = [...document.querySelectorAll("#checkMatrix tbody tr")].filter(row => kinds.includes(row.dataset.kind === "decade" ? "spotify" : row.dataset.kind));
  for (const row of rows) {
    const id = row.id.slice(3);
    const count = categories[id] ? categories[id].songs.length : 0;
    const dot = row.querySelector(`i.dot[data-col="${index}"]`);
    if (!dot) continue;
    dot.className = count >= MIN_SONGS ? "dot ok" : "dot no";
    dot.title = `${count} ${count === 1 ? "song" : "songs"}`;
    if (!reduceMotion) await pause(18);
  }
}

async function checkArtist(artist, kinds) {
  const index = build.artists.indexOf(artist);
  setColumn(index, "checking");
  let data;
  try {
    data = await fetchCategories(artist, ["spotify"]);
  } catch (error) {
    setColumn(index, "error");
    document.querySelectorAll(`#checkMatrix i.dot[data-col="${index}"]`).forEach(dot => { dot.className = "dot no"; });
    builderToast(`Couldn't read ${artist.name} from Spotify`);
    return;
  }
  build.results[artist.id] = { categories: data.categories, songs: data.songs, checked: ["spotify", "decade"] };
  await revealColumn(index, data.categories, ["spotify"]);
  const aiKinds = kinds.filter(kind => kind !== "spotify");
  if (aiKinds.length) {
    try {
      const ai = await fetchCategories(artist, aiKinds);
      Object.assign(build.results[artist.id].categories, ai.categories);
      if (ai.aiError) builderToast("AI categories aren't available right now");
      await revealColumn(index, ai.categories, aiKinds);
    } catch (error) {
      await revealColumn(index, {}, aiKinds);
    }
    build.results[artist.id].checked.push(...aiKinds);
  }
  setColumn(index, "done");
}

// ---------- Pick 3 artists and 3 categories ----------

function songCount(artistId, categoryId) {
  const result = build.results[artistId];
  const category = result && result.categories[categoryId];
  return category ? category.songs.length : 0;
}

function categoryIds() {
  const ids = new Set();
  Object.values(build.results).forEach(result => Object.keys(result.categories).forEach(id => ids.add(id)));
  const ordered = build.order.filter(id => ids.has(id));
  ids.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
  return ordered.sort((a, b) => KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)) || ordered.indexOf(a) - ordered.indexOf(b));
}

function worksFor(artistIds, categoryId) {
  return artistIds.length > 0 && artistIds.every(id => songCount(id, categoryId) >= MIN_SONGS);
}

// The three artists (in their ranked order) that share the most categories
function bestTrio() {
  const ids = build.artists.filter(artist => build.results[artist.id]).map(artist => artist.id);
  const cats = categoryIds();
  let best = ids.slice(0, 3);
  let bestScore = -1;
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      for (let c = b + 1; c < ids.length; c++) {
        const trio = [ids[a], ids[b], ids[c]];
        const score = cats.filter(id => worksFor(trio, id)).length;
        if (score > bestScore) {
          best = trio;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

function showChoose() {
  build.chosenArtists = bestTrio();
  build.chosenCats = [];
  build.preview = null;
  renderChoose();
  showView("choose");
}

function artistById(id) {
  return build.artists.find(artist => artist.id === id);
}

function renderChoose() {
  const chosenA = build.chosenArtists;
  const chosenC = build.chosenCats.filter(id => worksFor(chosenA, id));
  build.chosenCats = chosenC;

  const artistsBox = document.getElementById("chooseArtists");
  artistsBox.innerHTML = "";
  build.artists.filter(artist => build.results[artist.id]).forEach(artist => {
    const on = chosenA.includes(artist.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choose-artist";
    button.setAttribute("aria-pressed", String(on));
    const face = document.createElement(artist.img ? "img" : "span");
    face.className = "cm-face";
    if (artist.img) {
      face.src = artist.img;
      face.alt = "";
    } else {
      face.textContent = artist.name.slice(0, 1).toUpperCase();
    }
    const name = document.createElement("span");
    name.textContent = artist.name;
    button.append(face, name);
    button.addEventListener("click", () => {
      if (!on && chosenA.length >= 3) {
        builderToast("That's three. Tap a picked artist to swap it out.");
        return;
      }
      build.chosenArtists = on ? chosenA.filter(id => id !== artist.id) : [...chosenA, artist.id];
      build.preview = null;
      renderChoose();
    });
    artistsBox.appendChild(button);
  });
  document.getElementById("artistCount").textContent = `${chosenA.length} of 3`;

  const catBox = document.getElementById("chooseCategories");
  catBox.innerHTML = "";
  let group = null;
  categoryIds().forEach(id => {
    const kind = kindOf(id);
    if (!group || group.dataset.kind !== kind) {
      group = document.createElement("div");
      group.className = "choose-group";
      group.dataset.kind = kind;
      const title = document.createElement("h3");
      title.textContent = KIND_INFO[kind].title;
      group.appendChild(title);
      if (KIND_INFO[kind].note) {
        const note = document.createElement("p");
        note.className = "choose-note";
        note.textContent = KIND_INFO[kind].note;
        group.appendChild(note);
      }
      catBox.appendChild(group);
    }
    const on = chosenC.includes(id);
    const works = worksFor(chosenA, id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choose-cat";
    button.setAttribute("aria-pressed", String(on));
    button.disabled = !on && !works;
    const label = document.createElement("span");
    label.className = "cc-label";
    label.textContent = build.labels[id] || id;
    const counts = document.createElement("span");
    counts.className = "cc-counts";
    counts.textContent = chosenA.map(artistId => songCount(artistId, id)).join(" · ");
    counts.setAttribute("aria-label", chosenA.map(artistId => `${artistById(artistId).name}: ${songCount(artistId, id)} songs`).join(", "));
    button.append(label, counts);
    button.addEventListener("click", () => {
      if (!on && chosenC.length >= 3) {
        builderToast("That's three. Tap a picked category to swap it out.");
        return;
      }
      build.chosenCats = on ? chosenC.filter(other => other !== id) : [...chosenC, id];
      build.preview = null;
      renderChoose();
    });
    group.appendChild(button);
  });
  document.getElementById("categoryCount").textContent = `${chosenC.length} of 3`;

  renderPreview();
  const ready = chosenA.length === 3 && chosenC.length === 3;
  document.getElementById("buildGrid").disabled = !ready;
  let hint = "Your grid is ready to build.";
  if (chosenA.length < 3) hint = `Pick ${3 - chosenA.length} more ${3 - chosenA.length === 1 ? "artist" : "artists"}.`;
  else if (chosenC.length < 3) hint = `Pick ${3 - chosenC.length} more ${3 - chosenC.length === 1 ? "category" : "categories"}.`;
  document.getElementById("chooseHint").textContent = hint;
}

function renderPreview() {
  const box = document.getElementById("choosePreview");
  const songsBox = document.getElementById("previewSongs");
  box.innerHTML = "";
  const artists = build.chosenArtists.map(artistById);
  if (!artists.length || !build.chosenCats.length) {
    box.textContent = "Pick artists and categories to see how many songs fit each square.";
    songsBox.hidden = true;
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  artists.forEach(artist => {
    const th = document.createElement("th");
    th.textContent = artist.name;
    head.appendChild(th);
  });
  table.appendChild(head);
  build.chosenCats.forEach(id => {
    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = build.labels[id] || id;
    row.appendChild(th);
    artists.forEach(artist => {
      const td = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      const count = songCount(artist.id, id);
      button.textContent = `${count} ${count === 1 ? "song" : "songs"}`;
      button.setAttribute("aria-pressed", String(build.preview === `${id}|${artist.id}`));
      button.addEventListener("click", () => {
        build.preview = `${id}|${artist.id}`;
        renderPreview();
      });
      td.appendChild(button);
      row.appendChild(td);
    });
    table.appendChild(row);
  });
  box.appendChild(table);
  if (build.preview) {
    const [id, artistId] = build.preview.split("|");
    const result = build.results[artistId];
    const songs = result && result.categories[id] ? result.categories[id].songs : [];
    songsBox.textContent = `${artistById(artistId).name}, ${build.labels[id] || id}: ${songs.join(", ")}`;
    songsBox.hidden = false;
  } else {
    songsBox.textContent = "Tap a square to see the songs that count (spoilers).";
    songsBox.hidden = false;
  }
}

function newRequestId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

async function saveBuiltGrid() {
  const button = document.getElementById("buildGrid");
  button.disabled = true;
  button.textContent = "Building…";
  const artists = build.chosenArtists.map(artistById).map(artist => ({ id: artist.id, name: artist.name }));
  const categories = build.chosenCats.map(id => ({ id, label: build.labels[id] || id, kind: kindOf(id) === "decade" ? "spotify" : kindOf(id) }));
  const answers = {};
  build.chosenCats.forEach(id => {
    answers[id] = {};
    build.chosenArtists.forEach(artistId => {
      answers[id][artistById(artistId).name] = build.results[artistId].categories[id].songs;
    });
  });
  // The same picks keep the same request id, so a retry after a dropped
  // connection returns the grid the server already made instead of a copy
  const payload = JSON.stringify({ artists, categories, answers });
  if (!build.save || build.save.payload !== payload) build.save = { payload, id: newRequestId() };
  try {
    const data = await postSlow("/custom-grids", { artists, categories, answers, request_id: build.save.id });
    if (data.edit_token) {
      try {
        localStorage.setItem(`musicgrid:edit:${data.custom_grid_id}`, data.edit_token);
      } catch (error) {
        // Private mode: the grid still works, it just can't be edited later
      }
    }
    builtGridTitle = data.title || "";
    linkToGrid(data.custom_grid_id, Boolean(data.edit_token));
  } catch (error) {
    console.error("Saving the grid failed:", error);
    builderToast("Couldn't save your grid. Try again in a moment.");
    button.disabled = false;
  } finally {
    button.textContent = "Build this grid";
  }
}

function linkToGrid(customGridId, canEdit) {
  const path = "/play-custom-grid?custom_grid_id=" + encodeURIComponent(customGridId);
  document.getElementById("doneTitle").textContent = builtGridTitle || "Your grid is ready";
  document.getElementById("playLink").href = path;
  document.getElementById("shareUrl").value = "https://musicgrid.stevenhester.com" + path;
  const edit = document.getElementById("editLink");
  if (edit) {
    edit.href = path + "#edit";
    edit.closest(".done-edit").hidden = !canEdit;
  }
  setStep("done");
  showView("done");
}

// ---------- Pick any artists (search mode) ----------

// The grid-finding code above keeps its state in these globals, so clear
// them before every build to let people retry with different artists.
function resetBuildState() {
  build.artists = [];
  build.results = {};
  build.chosenArtists = [];
  build.chosenCats = [];
  build.preview = null;
  builtGridTitle = "";
  document.getElementById("checkMatrix").innerHTML = "";
  setBuildStatus("Reading each artist's songs from Spotify.");
}

function backToPicking() {
  const list = document.querySelector(".sortable-list");
  list.innerHTML = "";
  list.style.display = "";
  lastPicked.forEach(artist => list.appendChild(createArtistItem(artist.id, artist.name, artist.img)));
  buildStarted = false;
  renumberArtists();
  setStep("pick");
  showView("search");
  document.getElementById("artistSearch").focus();
}

const artistSearchCache = new Map();
let artistSearchSeq = 0;
let artistSearchTimer = null;
let artistResults = [];

function pickedIds() {
  return [...document.querySelectorAll(".sortable-list .item")].map(item => item.getAttribute("data-artist-id"));
}

function setArtistMsg(text) {
  const node = document.getElementById("artistMsg");
  if (!node) return;
  node.textContent = text;
  node.hidden = !text;
}

function updatePickState() {
  if (BUILD_SOURCE !== "search") return;
  const count = pickedIds().length;
  document.getElementById("pickCount").textContent = count ? `${count} of ${MAX_PICKS}` : "";
  document.getElementById("pickEmpty").hidden = count > 0;
  document.querySelector(".proceed-button").disabled = count < MIN_PICKS || buildStarted;
  let hint = "Next we check every category, then you pick 3 artists and 3 categories.";
  if (count < MIN_PICKS) {
    const left = MIN_PICKS - count;
    hint = `Pick ${left} more ${left === 1 ? "artist" : "artists"} to build.`;
  } else if (count >= MAX_PICKS) {
    hint = "That's the most you can add.";
  }
  document.getElementById("pickHint").textContent = hint;
}

function initArtistSearch() {
  const input = document.getElementById("artistSearch");
  input.addEventListener("input", () => {
    clearTimeout(artistSearchTimer);
    const query = input.value.trim();
    if (query.length < 2) {
      artistSearchSeq += 1;
      renderArtistResults([]);
      setArtistMsg("");
      return;
    }
    artistSearchTimer = setTimeout(() => runArtistSearch(query), 250);
  });
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = document.querySelector("#artistResults .result:not([disabled])");
    if (first) first.click();
  });
  document.getElementById("artistResults").addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    const artist = artistResults.find(result => result.id === button.dataset.add);
    if (artist) addPick(artist);
  });
  document.getElementById("changeArtists").addEventListener("click", backToPicking);
  addEventListeners();
  updatePickState();
}

async function runArtistSearch(query) {
  const seq = ++artistSearchSeq;
  const key = query.toLowerCase();
  let artists = artistSearchCache.get(key);
  if (!artists) {
    if (!artistResults.length) setArtistMsg("Searching…");
    try {
      const response = await fetch(BUILDER_API + "/search-artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw new Error("search-artists returned " + response.status);
      artists = await response.json();
      artistSearchCache.set(key, artists);
    } catch (error) {
      if (seq === artistSearchSeq) setArtistMsg("Artist search isn't responding. The server might be waking up, so try again in a few seconds.");
      return;
    }
  }
  if (seq !== artistSearchSeq) return;
  setArtistMsg(artists.length ? "" : `No artists found for “${query}”.`);
  renderArtistResults(artists);
}

function renderArtistResults(artists) {
  artistResults = artists;
  const list = document.getElementById("artistResults");
  if (!list) return;
  list.innerHTML = "";
  const picked = pickedIds();
  const full = picked.length >= MAX_PICKS;
  artists.forEach(artist => {
    const added = picked.includes(artist.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result";
    button.dataset.add = artist.id;
    button.disabled = added || full;

    let art;
    if (artist.img) {
      art = document.createElement("img");
      art.src = artist.img;
      art.alt = "";
      art.loading = "lazy";
    } else {
      art = document.createElement("span");
    }
    art.className = "art";

    const text = document.createElement("span");
    text.className = "result-text";
    const name = document.createElement("b");
    name.textContent = artist.name;
    text.appendChild(name);
    if (artist.genres && artist.genres.length) {
      const genres = document.createElement("span");
      genres.textContent = artist.genres.join(", ");
      text.appendChild(genres);
    }

    const tag = document.createElement("span");
    tag.className = "result-add";
    tag.textContent = added ? "Added" : "Add";

    button.append(art, text, tag);
    button.setAttribute("aria-label", added ? `${artist.name}, already added` : `Add ${artist.name}`);
    const item = document.createElement("li");
    item.appendChild(button);
    list.appendChild(item);
  });
}

function addPick(artist) {
  const ids = pickedIds();
  if (ids.includes(artist.id) || ids.length >= MAX_PICKS) return;
  document.querySelector(".sortable-list").appendChild(createArtistItem(artist.id, artist.name, artist.img));
  renumberArtists();
  const input = document.getElementById("artistSearch");
  input.value = "";
  artistSearchSeq += 1;
  renderArtistResults([]);
  setArtistMsg("");
  input.focus();
  builderToast(`Added ${artist.name}`);
}

initBuilder();
