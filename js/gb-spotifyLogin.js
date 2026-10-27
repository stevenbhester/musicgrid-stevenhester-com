/**
 * Grid builder, step 1: connect Spotify.
 * Authorization Code with PKCE, per
 * https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 * Tokens live in localStorage under the same keys as before, because
 * step 2 (gb-artistSelect.js) reads them from there.
 */

const clientId = "1d952129111a45b2b86ea1c08dd9c6ca";
const redirectUrl = "https://musicgrid.stevenhester.com/grid-builder/spotify-login";

const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scope = "user-top-read";
const SPOTIFY_KEYS = ["access_token", "refresh_token", "expires_in", "expires", "code_verifier"];

const currentToken = {
  get access_token() { return localStorage.getItem("access_token") || null; },
  get refresh_token() { return localStorage.getItem("refresh_token") || null; },
  get expires() { return localStorage.getItem("expires") || null; },

  save(response) {
    if (!response || !response.access_token) throw new Error(response && response.error ? response.error : "No access token");
    const { access_token, refresh_token, expires_in } = response;
    localStorage.setItem("access_token", access_token);
    // Spotify doesn't always send a new refresh token, so keep the old one.
    if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("expires_in", expires_in);
    const expiry = new Date(Date.now() + (expires_in * 1000));
    localStorage.setItem("expires", expiry);
  },

  clear() {
    SPOTIFY_KEYS.forEach(key => localStorage.removeItem(key));
  }
};

// ---------- Rendering ----------

function render(templateId, fill) {
  const target = document.getElementById("main");
  const clone = document.getElementById(templateId).content.cloneNode(true);
  if (fill) fill(clone);
  target.replaceChildren(clone);
}

function renderLogin(message) {
  render("login", node => {
    const notice = node.querySelector(".notice");
    if (message) {
      notice.textContent = message;
      notice.hidden = false;
    }
    node.querySelector("#login-button").addEventListener("click", loginWithSpotifyClick);
  });
}

function renderLoggedIn(user) {
  render("logged-in-template", node => {
    const name = user && user.display_name ? user.display_name : "your Spotify account";
    node.querySelector("[data-slot='name']").textContent = name;
    const img = node.querySelector("[data-slot='avatar']");
    if (user && user.images && user.images.length) {
      img.src = user.images[0].url;
    } else {
      img.remove();
    }
    node.querySelector("#logout-button").addEventListener("click", logoutClick);
  });
}

// ---------- Spotify calls ----------

async function redirectToSpotifyAuthorize() {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = window.crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");

  const data = new TextEncoder().encode(codeVerifier);
  const hashed = await window.crypto.subtle.digest("SHA-256", data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  window.localStorage.setItem("code_verifier", codeVerifier);

  const authUrl = new URL(authorizationEndpoint);
  authUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: redirectUrl
  }).toString();
  window.location.href = authUrl.toString();
}

async function getToken(code) {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUrl,
      code_verifier: localStorage.getItem("code_verifier")
    })
  });
  return response.json();
}

async function refreshToken() {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: currentToken.refresh_token
    })
  });
  return response.json();
}

async function getUserData() {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { "Authorization": "Bearer " + currentToken.access_token }
  });
  if (!response.ok) throw new Error("Profile request failed: " + response.status);
  return response.json();
}

function tokenExpiresSoon() {
  if (!currentToken.expires) return true;
  return new Date(currentToken.expires).getTime() - Date.now() < 5 * 60 * 1000;
}

// ---------- Click handlers ----------

async function loginWithSpotifyClick(event) {
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = "Opening Spotify…";
  await redirectToSpotifyAuthorize();
}

function logoutClick() {
  currentToken.clear();
  renderLogin();
}

// ---------- Start ----------

async function start() {
  const args = new URLSearchParams(window.location.search);
  const code = args.get("code");

  if (args.get("error")) {
    window.history.replaceState({}, document.title, window.location.pathname);
    renderLogin("Spotify sign-in was cancelled. Connect again whenever you're ready.");
    return;
  }

  // Back from Spotify: swap the code for a token before deciding what to show.
  if (code) {
    render("working");
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      currentToken.save(await getToken(code));
    } catch (error) {
      currentToken.clear();
      renderLogin("Spotify sign-in didn't finish. Try connecting again.");
      return;
    }
  }

  if (!currentToken.access_token) {
    renderLogin();
    return;
  }

  try {
    if (tokenExpiresSoon()) currentToken.save(await refreshToken());
    renderLoggedIn(await getUserData());
  } catch (error) {
    currentToken.clear();
    renderLogin("Your Spotify connection expired. Connect again to keep going.");
  }
}

start();
