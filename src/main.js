// main.js (FULL REWRITE / CLEAN FIXED VERSION)
// - Fixes the hard crash in your original file caused by a missing brace in resetDollhouseView()
// - Fixes init() structure / missing closings (your pasted version is cut in a way that would break parsing)
// - Keeps your functionality: pano + transitions + dollhouse models + node hover/click + “you are here” marker + loader + intro overlay
// - Adds a few safety guards so switching modes can’t leave you black-screened or stuck

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import brandLogoUrl from "./assets/rtf-logo.png";

// -----------------------------
// DOM
// -----------------------------
const container = document.getElementById("app");
const playerShell = document.getElementById("playerShell");
const playerStage = document.getElementById("playerStage");
const navWrap = document.getElementById("navWrap");
const indicator = document.getElementById("indicator");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const PLAYER_BASE_WIDTH = 1700;
const PLAYER_BASE_HEIGHT = PLAYER_BASE_WIDTH * (9 / 16);

// Brand link UI
const brandLink = document.getElementById("brandLink");
const brandLogo = document.getElementById("brandLogo");
const brandText = document.getElementById("brandText");
// Brand link positioning:
// We want the *logo* state to sit a bit further in from the corner (so it never clips when scaled),
// but we want the *text pill* state to stay exactly where your CSS originally places it.
const BRAND_LOGO_RIGHT_INSET_PX = 44; // increase/decrease to taste
const BRAND_LOGO_TOP_INSET_PX = 16;   // fixes slight top clipping when scaled

// Cache the ORIGINAL positioning styles so we can restore them for the text state.
const __brandLinkPosStyle = brandLink
  ? {
      right: brandLink.style.right,
      left: brandLink.style.left,
      top: brandLink.style.top,
      bottom: brandLink.style.bottom,
      transform: brandLink.style.transform,
      overflow: brandLink.style.overflow,
    }
  : null;

function setBrandLinkLogoPositionEnabled(enabled) {
  if (!brandLink) return;

  // Always allow transforms to render beyond the element box
  brandLink.style.overflow = "visible";

  if (enabled) {
    // Nudge the wrapper inward so the 400% scaled logo never clips (RIGHT stays as-is)
    brandLink.style.left = "auto";
    brandLink.style.bottom = __brandLinkPosStyle?.bottom ?? "";
    brandLink.style.right = `${BRAND_LOGO_RIGHT_INSET_PX}px`;

    // ✅ Move the LOGO state down a bit (so top spacing matches right spacing visually)
    // Tune this number if needed (6–14px typical).
    const LOGO_TOP_EXTRA_PX = 8;
    brandLink.style.top = `${BRAND_LOGO_TOP_INSET_PX + LOGO_TOP_EXTRA_PX}px`;

    // Remove any CSS transform that might be used for the pill state
    brandLink.style.transform = "";
  } else {
    // Restore the original CSS-driven positioning for the text pill state
    if (__brandLinkPosStyle) {
      brandLink.style.right = __brandLinkPosStyle.right;
      brandLink.style.left = __brandLinkPosStyle.left;
      brandLink.style.top = __brandLinkPosStyle.top;
      brandLink.style.bottom = __brandLinkPosStyle.bottom;
      brandLink.style.transform = __brandLinkPosStyle.transform;
      brandLink.style.overflow = __brandLinkPosStyle.overflow || "visible";
    }
  }
}
let brandSwapTimer = null;

// Cache the pill styling on the wrapper so we can disable it for the logo-only state
const __brandLinkPillStyle = brandLink
  ? {
      background: brandLink.style.background,
      padding: brandLink.style.padding,
      borderRadius: brandLink.style.borderRadius,
      boxShadow: brandLink.style.boxShadow,
      backdropFilter: brandLink.style.backdropFilter,
      right: brandLink.style.right,
      left: brandLink.style.left,
      top: brandLink.style.top,
      bottom: brandLink.style.bottom,
      transform: brandLink.style.transform,
      overflow: brandLink.style.overflow,
    }
  : null;

function setBrandLinkPillEnabled(enabled) {
  if (!brandLink) return;

  if (enabled) {
    // Restore the original (pill) look for the text state
    if (__brandLinkPillStyle) {
      brandLink.style.background = __brandLinkPillStyle.background;
      brandLink.style.padding = __brandLinkPillStyle.padding;
      brandLink.style.borderRadius = __brandLinkPillStyle.borderRadius;
      brandLink.style.boxShadow = __brandLinkPillStyle.boxShadow;
      brandLink.style.backdropFilter = __brandLinkPillStyle.backdropFilter;
    }
    // Text pill: keep original positioning
    setBrandLinkLogoPositionEnabled(false);
  } else {
    // Logo-only state: no pill/transparent background around the PNG
    brandLink.style.background = "transparent";
    brandLink.style.padding = "0";
    brandLink.style.borderRadius = "0";
    brandLink.style.boxShadow = "none";
    brandLink.style.backdropFilter = "none";
    // Logo-only: apply inward positioning so the scaled logo never clips
    setBrandLinkLogoPositionEnabled(true);
  }
}

// Ensure the <img> points at the bundled asset (prevents broken-image/alt-text display)
if (brandLogo) {
  brandLogo.src = brandLogoUrl;
  brandLogo.decoding = "async";
  brandLogo.loading = "eager";

  // Start small, then grow to 200% when the brand UI is revealed
  // (reset back to 1x whenever we hard-hide so the animation can replay)
  brandLogo.style.transformOrigin = "center center";
  brandLogo.style.transform = "scale(1)";
  brandLogo.style.transition = "transform 900ms ease"; // slower grow
}

function hideBrandUIHard() {
  if (!brandLink) return;
  // Hard-hide to prevent any 1-frame CSS/class flicker
  brandLink.classList.add("hidden");
  brandLink.style.display = "none";
  if (brandLogo) brandLogo.classList.add("hidden");
  if (brandText) brandText.classList.add("hidden");

  // Reset logo scale so next reveal animates from small -> 400%
  if (brandLogo) brandLogo.style.transform = "scale(1)";

  setBrandLinkPillEnabled(false);

  if (brandSwapTimer) {
    clearTimeout(brandSwapTimer);
    brandSwapTimer = null;
  }
}

function showBrandUIHard() {
  if (!brandLink) return;

  brandLink.style.display = "";
  brandLink.classList.remove("hidden");

  // When revealing, we start in the LOGO state (no pill around the logo)
  setBrandLinkPillEnabled(false);
  // Ensure logo positioning (inset) is active immediately
  setBrandLinkLogoPositionEnabled(true);

  // Ensure logo is visible and text is hidden initially
  if (brandLogo) brandLogo.classList.remove("hidden");
  if (brandText) brandText.classList.add("hidden");

  // Grow logo to 400% once visible
  if (brandLogo) {
    requestAnimationFrame(() => {
      brandLogo.style.transform = "scale(2.5)";
    });
  }
}

// -----------------------------
// Node id helpers (UNIQUE per pano)
// -----------------------------
// We emit a unique id per pano/node so the listing page can decide
// how to group nodes into rooms (prevents duplicate room-name collisions).
function getNodeIdForIndex(i) {
  const idx = Number(i);
  if (!Number.isFinite(idx) || idx < 0) return 0;
  return idx + 1; // 1-based node id
}
// Tabs
const tabPano = document.getElementById("tabPano");
const tabDollhouse = document.getElementById("tabDollhouse");
// -----------------------------
// UI fade-in (mode UI buttons)
// -----------------------------
const UI_FADE_DELAY_MS = 140; // small delay after content is visible
const UI_FADE_MS = 180;       // fade duration

const __uiTimers = new WeakMap();
let __uiEpoch = 0; // increments on every mode switch

function __afterNextPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

function uiHide(el, { fadeMs = 120 } = {}) {
  if (!el) return;

  const t = __uiTimers.get(el);
  if (t) {
    clearTimeout(t);
    __uiTimers.delete(el);
  }

  if (el.classList.contains("hidden") || el.style.display === "none") return;

  el.style.transition = `opacity ${fadeMs}ms ease`;
  el.style.opacity = "0";
  el.style.pointerEvents = "none";

  setTimeout(() => {
    el.classList.add("hidden");
  }, Math.max(0, fadeMs));
}

function uiShowAfter(el, { delayMs = UI_FADE_DELAY_MS, fadeMs = UI_FADE_MS, display = "" } = {}) {
  if (!el) return;

  const t = __uiTimers.get(el);
  if (t) {
    clearTimeout(t);
    __uiTimers.delete(el);
  }

  const epochAtSchedule = __uiEpoch;

  el.classList.remove("hidden");
  if (display) el.style.display = display;

  el.style.transition = `opacity ${fadeMs}ms ease`;
  el.style.opacity = "0";
  el.style.pointerEvents = "none";

  const id = setTimeout(() => {
    // ✅ if we switched mode since scheduling, do nothing
    if (epochAtSchedule !== __uiEpoch) return;

    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    __uiTimers.delete(el);
  }, Math.max(0, delayMs));

  __uiTimers.set(el, id);
}
function uiShowGroupAfter(els, opts) {
  for (const el of els) uiShowAfter(el, opts);
}

function revealPanoUIWhenReady() {
  const epochAtCall = __uiEpoch;

  __afterNextPaint(() => {
    if (epochAtCall !== __uiEpoch) return;
    if (mode !== "pano") return;

    uiShowGroupAfter([navWrap].filter(Boolean), { delayMs: UI_FADE_DELAY_MS, fadeMs: UI_FADE_MS });

    if (indicator) {
      indicator.style.display = "block";
      uiShowAfter(indicator, { delayMs: UI_FADE_DELAY_MS, fadeMs: UI_FADE_MS, display: "block" });
    }
  });
}

function revealDollUIWhenReady() {
  const epochAtCall = __uiEpoch;

  __afterNextPaint(() => {
    if (epochAtCall !== __uiEpoch) return;
    if (mode !== "dollhouse") return;

    uiShowGroupAfter([dollBtns].filter(Boolean), { delayMs: UI_FADE_DELAY_MS, fadeMs: UI_FADE_MS });
  });
}

// Begin tour UI
const startOverlay = document.getElementById("startOverlay");
const startCard = document.getElementById("startCard");
const startBtn = document.getElementById("startBtn");
const introVideoEl = document.getElementById("introVideo");
const IS_LOCAL_DEV = Boolean(import.meta.env.DEV);
let skipIntroOnNextBegin = false;

// Dollhouse buttons
const dollBtns = document.getElementById("dollBtns");
const btnFull = document.getElementById("btnFull");
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");

// Safety
if (!container) throw new Error("#app container not found");

// Ensure container can host absolute overlays
const cs = window.getComputedStyle(container);
if (cs.position === "static") container.style.position = "relative";

function applyPlayerScale() {
  if (!playerShell || !playerStage || !container) return;

  const shellRect = playerShell.getBoundingClientRect();
  const shellStyles = window.getComputedStyle(playerShell);
  const padX =
    (parseFloat(shellStyles.paddingLeft) || 0) + (parseFloat(shellStyles.paddingRight) || 0);
  const padY =
    (parseFloat(shellStyles.paddingTop) || 0) + (parseFloat(shellStyles.paddingBottom) || 0);

  const availableW = Math.max(1, shellRect.width - padX);
  const availableH = Math.max(1, shellRect.height - padY);
  const scale = Math.min(1, availableW / PLAYER_BASE_WIDTH, availableH / PLAYER_BASE_HEIGHT);
  const scaledW = PLAYER_BASE_WIDTH * scale;
  const scaledH = PLAYER_BASE_HEIGHT * scale;

  playerStage.style.width = `${scaledW}px`;
  playerStage.style.height = `${scaledH}px`;
  container.style.transform = `scale(${scale})`;
}

// -----------------------------
// Room label UI (bottom-left)
// -----------------------------
const roomLabelEl = document.createElement("div");
roomLabelEl.id = "roomLabel";
Object.assign(roomLabelEl.style, {
  position: "absolute",
  left: "16px",
  bottom: "16px",
  padding: "12px 16px",
  borderRadius: "12px",
  border: "var(--container-stroke-width) solid transparent",
  background:
    "linear-gradient(var(--midnight-purple), var(--midnight-purple)) padding-box, var(--chrome-stroke-material) border-box",
  backgroundClip: "padding-box, border-box",
  boxShadow:
    "inset 0 1px 0 var(--chrome-specular-top), inset 0 -1px 0 rgba(89, 102, 124, 0.56), inset 1px 0 0 var(--chrome-specular-edge), 0 10px 18px rgba(10, 14, 24, 0.35)",
  color: "#fff",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  fontSize: "15px",
  fontWeight: "700",
  letterSpacing: "0.4px",
  textTransform: "uppercase",
  zIndex: "20",
  pointerEvents: "none",
  userSelect: "none",
  opacity: "0",
});
container.appendChild(roomLabelEl);

// -----------------------------
// Marker animation constants
// -----------------------------
const NODE_MARKER_BOB_HEIGHT = 0.35;
const NODE_MARKER_BOB_SPEED = 2.0;
const NODE_MARKER_SPIN_SPEED = 0.6;
const YOU_ARE_HERE_OFFSET_Y = 0.75;

// -----------------------------
// Brand swap
// -----------------------------
function startBrandSwapTimer(delayMs = 10000) {
  // Only run the swap if the brand UI is actually allowed to be visible.
  if (!brandLink || !brandLogo || !brandText) return;
  if (brandLink.classList.contains("hidden") || brandLink.style.display === "none") return;

  if (brandSwapTimer) {
    clearTimeout(brandSwapTimer);
    brandSwapTimer = null;
  }

  // Start on logo
  brandLogo.classList.remove("hidden");
  brandText.classList.add("hidden");
  // Logo state: wrapper pill OFF so nothing extends around the PNG
  setBrandLinkPillEnabled(false);
  setBrandLinkLogoPositionEnabled(true);

  brandSwapTimer = setTimeout(() => {
    // Guard again at fire-time
    if (brandLink.classList.contains("hidden") || brandLink.style.display === "none") return;
    brandLogo.classList.add("hidden");
    brandText.classList.remove("hidden");
    // Text state: wrapper pill ON so the pill surrounds the domain text
    setBrandLinkPillEnabled(true);
    setBrandLinkLogoPositionEnabled(false);
  }, delayMs);
}

// -----------------------------
// Tabs helper
// -----------------------------
function syncTabStrokes() {
  if (!tabPano || !tabDollhouse) return;
  tabPano.classList.toggle("hasStroke", !tabPano.classList.contains("active"));
  tabDollhouse.classList.toggle("hasStroke", !tabDollhouse.classList.contains("active"));
}
function setTabActive(which) {
  if (!tabPano || !tabDollhouse) return;
  tabPano.classList.toggle("active", which === "pano");
  tabDollhouse.classList.toggle("active", which === "dollhouse");
  syncTabStrokes();
}

// -----------------------------
// TOUR CONFIG
// -----------------------------
function getTourId() {
  const params = new URLSearchParams(location.search);
  return params.get("tour") || import.meta.env.VITE_TOUR_ID || "prod_demo_house_01";
}

function getApiBase() {
  const params = new URLSearchParams(location.search);
  const envBase = import.meta.env.VITE_API_BASE;
  const defaultBase = import.meta.env.DEV
    ? location.origin
    : "https://rtf-player-api.fionnmaguire.workers.dev";
  return (
    params.get("api") ||
    envBase ||
    defaultBase
  ).replace(/\/$/, "");
}

function isAdminMode() {
  const params = new URLSearchParams(location.search);
  return params.get("admin") === "1";
}

// -----------------------------
// Listing page bridge (postMessage)
// -----------------------------
// Best practice: include parentOrigin in the iframe src, e.g.
// https://realtour.rtfmediasolutions.com/?tour=...&parentOrigin=https://listing.rtfmediasolutions.com
function getParentOrigin() {
  const params = new URLSearchParams(location.search);
  const fromParam = params.get("parentOrigin");
  if (fromParam) return fromParam;

  // If embedded, try to infer from the parent origin.
  // Note: document.referrer can be empty when embedding https -> http (localhost)
  // due to referrer policy. ancestorOrigins is available in Chromium-based browsers.
  try {
    const ao = location.ancestorOrigins;
    if (ao && ao.length) return ao[0];
  } catch {}

  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {}

  // Safe fallback (change if your listing domain changes)
  return "https://listing.rtfmediasolutions.com";
}

const LISTING_PARENT_ORIGIN = getParentOrigin();

// Emits the current pano/node state to the parent listing page.
// NOTE: This function assumes `mode` exists globally in your script.
// It also assumes `getRoomLabelForIndex(i)` exists elsewhere (it does in your file).
function emitListingNodeChange(panoIndex, source = "") {
  const idx = Number(panoIndex);
  if (!Number.isFinite(idx) || idx < 0) return;

  let roomName = "";
  try {
    roomName = (typeof getRoomLabelForIndex === "function" ? getRoomLabelForIndex(idx) : "") || "";
  } catch {}

  const nodeId = getNodeIdForIndex(idx);

  const msg = {
    type: "RTF_NODE_CHANGE",
    tourId: getTourId(),

    panoIndex: idx,     // 0-based index
    nodeId,             // 1-based unique id (panoIndex + 1)
    roomName,           // whatever is in TOUR.rooms for this pano

    mode,               // "pano" | "dollhouse"
    source,             // debug tracer
  };

  const params = new URLSearchParams(location.search);
  const debug = params.get("debug") === "1";

  try {
    if (debug) {
      const embedded = window.parent && window.parent !== window;
      console.log("[RTF postMessage]", {
        embedded,
        targetOrigin: LISTING_PARENT_ORIGIN,
        msg,
      });
    }
    const targetOrigin = LISTING_PARENT_ORIGIN && LISTING_PARENT_ORIGIN !== "null" ? LISTING_PARENT_ORIGIN : "*";
    window.parent?.postMessage(msg, targetOrigin);
  } catch (e) {
    if (debug) console.warn("[RTF postMessage] failed", e);
  }
}

// -----------------------------
// Listing -> Player commands (postMessage listener)
// -----------------------------
// Allows the LISTING page to command the player to navigate to a specific node.
// Expected messages:
//   { type: "RTF_GOTO_NODE", nodeId: 12 }
//   { type: "RTF_GOTO_NODE", panoIndex: 11 }
// Optional:
//   { type: "RTF_SET_MODE", mode: "pano" | "dollhouse" }

function __isAllowedListingOrigin(origin) {
  // If we somehow resolved "*" (shouldn't happen here), allow.
  if (!LISTING_PARENT_ORIGIN || LISTING_PARENT_ORIGIN === "*") return true;
  return origin === LISTING_PARENT_ORIGIN;
}

function __coerceTargetIndex(data) {
  const panoIndex = Number(data?.panoIndex);
  if (Number.isFinite(panoIndex) && panoIndex >= 0) return panoIndex;

  const nodeId = Number(data?.nodeId);
  if (Number.isFinite(nodeId) && nodeId > 0) return nodeId - 1; // nodeId is 1-based

  return null;
}

window.addEventListener("message", async (event) => {
  if (!__isAllowedListingOrigin(event.origin)) return;

  const data = event.data;
  if (!data || typeof data !== "object") return;

  const params = new URLSearchParams(location.search);
  const debug = params.get("debug") === "1";

  try {
    // 1) Optional explicit mode switching
    if (data.type === "RTF_SET_MODE") {
      const m = (data.mode || "").toString();
      if (m === "pano") {
        if (state.isTransitioning) cancelActivePanoTransition("RTF_SET_MODE:pano");
        setMode("pano");
        blankPanoSphere();
        const tex = await ensurePanoLoaded(state.index);
        setSphereMap(tex);
        requestAnimationFrame(() => fadeInPano(220));
        revealPanoUIWhenReady();
      } else if (m === "dollhouse") {
        // Prefer the existing click handler flow for entering dollhouse
        tabDollhouse?.click?.();
      }

      if (debug) console.log("[RTF message] SET_MODE", { from: event.origin, data });
      return;
    }

    // 2) Navigate to a specific node
    if (data.type === "RTF_GOTO_NODE") {
      const targetIndex = __coerceTargetIndex(data);
      if (targetIndex == null) return;

      // Clamp to pano range if PANOS not ready yet
      const max = (Array.isArray(PANOS) && PANOS.length) ? PANOS.length - 1 : null;
      const idx = max == null ? targetIndex : Math.max(0, Math.min(max, targetIndex));

      if (debug) console.log("[RTF message] GOTO_NODE", { from: event.origin, idx, data });

      // If we're currently in dollhouse, use the existing hard jump into pano.
      if (mode !== "pano") {
        await jumpToPano(idx);
        return;
      }

      // If we're already there, just re-emit (keeps listing in sync)
      if (idx === state.index) {
        updateIndicator(state.index);
        return;
      }

      // Prefer smooth transition only for adjacent moves; otherwise hard jump.
      if (!state.isTransitioning && Math.abs(idx - state.index) === 1) {
        await goTo(idx);
      } else {
        await jumpToPano(idx);
      }

      return;
    }
  } catch (e) {
    if (debug) console.warn("[RTF message] handler error", e);
  }
});

let TOUR = null;
let TOUR_BASE = "";

function pad(n, len) {
  return String(n).padStart(len, "0");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function applyPanoPattern(pattern, i1) {
  return pattern.replace("{0000}", pad(i1, 4));
}

function applyTransitionPattern(pattern, a2, b2) {
  let out = pattern;
  out = out.replace("{00}", pad(a2, 2));
  out = out.replace("{00}", pad(b2, 2));
  return out;
}

async function loadTourConfig() {
  const id = getTourId();
  const API_BASE = getApiBase();

  TOUR_BASE = `${API_BASE}/tours/${id}/`;

  const res = await fetch(`${TOUR_BASE}tour.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load tour.json for tour=${id}`);
  TOUR = await res.json();
}
// -----------------------------
// Intro video
// -----------------------------
function getIntroVideoUrl() {
  // Prefer API-configured intro path from tour.json; fallback to legacy location.
  const relPath =
    typeof TOUR?.introVideo === "string" && TOUR.introVideo.trim().length
      ? TOUR.introVideo.trim()
      : "intro/intro.mp4";
  return `${TOUR_BASE}${relPath.replace(/^\/+/, "")}`;
}
function showStartOverlay() {
  if (!startOverlay) return;
  startOverlay.classList.remove("hidden");
}
function hideStartOverlay() {
  if (!startOverlay) return;
  startOverlay.classList.add("hidden");
}

function waitForFirstIntroFrame(videoEl, timeoutMs = 420) {
  return new Promise((resolve) => {
    let done = false;
    let timeoutId = null;

    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
      resolve();
    };

    timeoutId = setTimeout(finish, timeoutMs);

    if (typeof videoEl.requestVideoFrameCallback === "function") {
      videoEl.requestVideoFrameCallback(() => finish());
      return;
    }

    requestAnimationFrame(() => requestAnimationFrame(finish));
  });
}

async function playIntroVideoOnce() {
  if (!introVideoEl) return;

  if (startOverlay) startOverlay.classList.add("videoMode");

  introVideoEl.muted = false;
  introVideoEl.volume = 1.0;
  introVideoEl.playsInline = true;
  introVideoEl.autoplay = true;

  introVideoEl.src = getIntroVideoUrl();
  introVideoEl.load();
  introVideoEl.classList.remove("show");

  await new Promise((resolve, reject) => {
    const onReady = () => cleanup(resolve);
    const onErr = () => cleanup(() => reject(new Error("Intro video load error")));
    const cleanup = (cb) => {
      introVideoEl.removeEventListener("loadeddata", onReady);
      introVideoEl.removeEventListener("canplay", onReady);
      introVideoEl.removeEventListener("error", onErr);
      cb();
    };
    introVideoEl.addEventListener("loadeddata", onReady, { once: true });
    introVideoEl.addEventListener("canplay", onReady, { once: true });
    introVideoEl.addEventListener("error", onErr, { once: true });
  });

  try {
    await introVideoEl.play();
    await waitForFirstIntroFrame(introVideoEl);
    introVideoEl.classList.add("show");
  } catch (e) {
    console.warn("Intro video play failed:", e);
    if (startOverlay) startOverlay.classList.remove("videoMode");
    introVideoEl.classList.remove("show");
    return;
  }

  await new Promise((resolve) => introVideoEl.addEventListener("ended", resolve, { once: true }));

  introVideoEl.pause();
  introVideoEl.classList.remove("show");
  if (startOverlay) startOverlay.classList.remove("videoMode");
}

// -----------------------------
// Loading overlay (progress bar)
// -----------------------------
const loadingOverlay = document.createElement("div");
loadingOverlay.id = "loadingOverlay";
Object.assign(loadingOverlay.style, {
  position: "absolute",
  left: "0",
  top: "0",
  width: "100%",
  height: "100%",
  display: "none",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: "78px",
  boxSizing: "border-box",
  pointerEvents: "none",
  zIndex: "30",
});

const loadingCard = document.createElement("div");
Object.assign(loadingCard.style, {
  minWidth: "260px",
  maxWidth: "420px",
  width: "42%",
  padding: "14px 14px 12px",
  borderRadius: "12px",
  background: "rgba(0,0,0,0.65)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
});

const loadingText = document.createElement("div");
Object.assign(loadingText.style, {
  color: "rgba(255,255,255,0.92)",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.4px",
  textTransform: "uppercase",
  marginBottom: "10px",
});
loadingText.textContent = "Loading…";

const loadingBarOuter = document.createElement("div");
Object.assign(loadingBarOuter.style, {
  width: "100%",
  height: "8px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.14)",
  overflow: "hidden",
});

const loadingBarInner = document.createElement("div");
Object.assign(loadingBarInner.style, {
  width: "0%",
  height: "100%",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.92)",
  transition: "width 120ms ease",
});

const loadingPct = document.createElement("div");
Object.assign(loadingPct.style, {
  color: "rgba(255,255,255,0.75)",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  fontSize: "12px",
  fontWeight: "600",
  marginTop: "10px",
  textAlign: "right",
});
loadingPct.textContent = "0%";

loadingBarOuter.appendChild(loadingBarInner);
loadingCard.appendChild(loadingText);
loadingCard.appendChild(loadingBarOuter);
loadingCard.appendChild(loadingPct);
loadingOverlay.appendChild(loadingCard);
container.appendChild(loadingOverlay);

function applyLoadingPresentation({ position = "bottom", variant = "default" } = {}) {
  const topAligned = position === "top";
  const centerAligned = position === "center";
  loadingOverlay.style.alignItems = topAligned
    ? "flex-start"
    : centerAligned
      ? "center"
      : "flex-end";
  loadingOverlay.style.paddingTop = topAligned ? "16px" : "0";
  loadingOverlay.style.paddingBottom = topAligned || centerAligned ? "0" : "78px";

  if (variant === "chrome") {
    Object.assign(loadingCard.style, {
      minWidth: "280px",
      maxWidth: "520px",
      width: "44%",
      padding: "14px 16px 12px",
      borderRadius: "14px",
      border: "var(--container-stroke-width) solid transparent",
      background:
        "linear-gradient(var(--midnight-purple), var(--midnight-purple)) padding-box, var(--chrome-stroke-material) border-box",
      backgroundClip: "padding-box, border-box",
      backdropFilter: "none",
      boxShadow:
        "inset 0 1px 0 var(--chrome-specular-top), inset 0 -1px 0 rgba(89, 102, 124, 0.56), inset 1px 0 0 var(--chrome-specular-edge), 0 12px 22px rgba(10, 14, 24, 0.42)",
    });
    Object.assign(loadingText.style, {
      color: "rgba(255,255,255,0.96)",
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      marginBottom: "10px",
    });
    Object.assign(loadingBarOuter.style, {
      height: "8px",
      background: "rgba(255,255,255,0.24)",
      border: "1px solid rgba(255,255,255,0.24)",
    });
    Object.assign(loadingBarInner.style, {
      background: "rgba(255,255,255,0.96)",
    });
    Object.assign(loadingPct.style, {
      color: "rgba(255,255,255,0.92)",
      fontSize: "12px",
      fontWeight: "700",
      marginTop: "10px",
    });
    return;
  }

  Object.assign(loadingCard.style, {
    minWidth: "260px",
    maxWidth: "420px",
    width: "42%",
    padding: "14px 14px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.65)",
    backgroundClip: "border-box",
    backdropFilter: "blur(8px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  });
  Object.assign(loadingText.style, {
    color: "rgba(255,255,255,0.92)",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.4px",
    marginBottom: "10px",
  });
  Object.assign(loadingBarOuter.style, {
    height: "8px",
    background: "rgba(255,255,255,0.14)",
    border: "none",
  });
  Object.assign(loadingBarInner.style, {
    background: "rgba(255,255,255,0.92)",
  });
  Object.assign(loadingPct.style, {
    color: "rgba(255,255,255,0.75)",
    fontSize: "12px",
    fontWeight: "600",
    marginTop: "10px",
  });
}

function setLoadingVisible(visible, text = "Loading…") {
  loadingOverlay.style.display = visible ? "flex" : "none";
  if (visible) {
    loadingText.textContent = text;
    setLoadingProgress(0);
  }
}
function setLoadingProgress(p01) {
  const p = Math.max(0, Math.min(1, Number(p01) || 0));
  loadingBarInner.style.width = `${Math.round(p * 100)}%`;
  loadingPct.textContent = `${Math.round(p * 100)}%`;
}
function beginProgressSession(
  label = "Loading…",
  { position = "bottom", variant = "default", minVisibleMs = 0 } = {}
) {
  let active = true;
  const visibleStartedAt = performance.now();
  let hideDelayTimer = null;
  let hideFadeTimer = null;
  let finishPromise = null;
  let finishResolved = false;
  let resolveFinishPromise = null;

  const resolveFinish = () => {
    if (finishResolved) return;
    finishResolved = true;
    if (resolveFinishPromise) {
      resolveFinishPromise();
      resolveFinishPromise = null;
    }
  };

  applyLoadingPresentation({ position, variant });
  setLoadingVisible(true, label);

  const tasks = new Map();
  const recompute = () => {
    if (!active) return;
    let wSum = 0;
    let acc = 0;
    for (const t of tasks.values()) {
      wSum += t.weight;
      acc += t.weight * t.p;
    }
    const out = wSum > 0 ? acc / wSum : 0;
    setLoadingProgress(out);
  };

  const task = (name, weight = 1) => {
    const id = `${name}_${Math.random().toString(16).slice(2)}`;
    tasks.set(id, { weight: Math.max(0.01, weight), p: 0 });
    recompute();
    return {
      update(p01) {
        const t = tasks.get(id);
        if (!t) return;
        t.p = Math.max(0, Math.min(1, Number(p01) || 0));
        recompute();
      },
      done() {
        const t = tasks.get(id);
        if (!t) return;
        t.p = 1;
        recompute();
      },
    };
  };

  const finish = () => {
    if (finishPromise) return finishPromise;
    active = false;
    setLoadingProgress(1);
    finishPromise = new Promise((resolve) => {
      resolveFinishPromise = resolve;
      const elapsed = performance.now() - visibleStartedAt;
      const holdMs = Math.max(0, Number(minVisibleMs) - elapsed);

      hideDelayTimer = setTimeout(() => {
        hideFadeTimer = setTimeout(() => {
          setLoadingVisible(false);
          resolveFinish();
        }, 180);
      }, holdMs);
    });
    return finishPromise;
  };
  const cancel = () => {
    active = false;
    if (hideDelayTimer) {
      clearTimeout(hideDelayTimer);
      hideDelayTimer = null;
    }
    if (hideFadeTimer) {
      clearTimeout(hideFadeTimer);
      hideFadeTimer = null;
    }
    setLoadingVisible(false);
    resolveFinish();
  };

  return { task, finish, cancel };
}

// -----------------------------
// Crossfade overlay (pano <-> dollhouse)
// -----------------------------
const fadeOverlay = document.createElement("div");
fadeOverlay.id = "fadeOverlay";
Object.assign(fadeOverlay.style, {
  position: "absolute",
  left: "0",
  top: "0",
  width: "100%",
  height: "100%",
  background: "#000",
  opacity: "0",
  pointerEvents: "none",
  zIndex: "10",
});
container.appendChild(fadeOverlay);

let fadeToken = 0;
function fadeOverlayTo(targetOpacity, durationMs = 220) {
  fadeToken++;
  const token = fadeToken;

  const startOpacity = parseFloat(fadeOverlay.style.opacity || "0");
  const start = performance.now();

  return new Promise((resolve) => {
    function tick() {
      if (token !== fadeToken) return resolve(false);
      const t = (performance.now() - start) / durationMs;
      const u = Math.min(1, Math.max(0, t));
      const e = u * u * (3 - 2 * u);
      const v = startOpacity + (targetOpacity - startOpacity) * e;
      fadeOverlay.style.opacity = String(v);

      if (u >= 1) resolve(true);
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// -----------------------------
// TOUR DATA
// -----------------------------
let PANOS = [];
let HERO = [];
let ROOMS = [];

let DOLLHOUSE_GLB_FULL = "";
let DOLLHOUSE_GLB_UP = "";
let DOLLHOUSE_GLB_DOWN = "";

// Doll home yaw (you keep these, but not strictly required for stability)
let DOLL_HOME_YAW_DEG = -90;
let DOLL_HOME_YAW_OFFSET = THREE.MathUtils.degToRad(DOLL_HOME_YAW_DEG);

// -----------------------------
// Renderer
// -----------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.touchAction = "none";
container.appendChild(renderer.domElement);

const PANO_EXPOSURE = 1.0;
const DOLL_EXPOSURE = 1.35;

function applyRenderLookForMode(which) {
  if (which === "dollhouse") {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = DOLL_EXPOSURE;
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = PANO_EXPOSURE;
  }
}
applyRenderLookForMode("pano");

// -----------------------------
// Scenes + cameras
// -----------------------------
const panoScene = new THREE.Scene();
const panoCamera = new THREE.PerspectiveCamera(
  75,
  container.clientWidth / container.clientHeight,
  0.01,
  1000
);
panoCamera.position.set(0, 0, 0.1);

const dollScene = new THREE.Scene();
dollScene.background = new THREE.Color(0x111111);

const dollCamera = new THREE.PerspectiveCamera(
  55,
  container.clientWidth / container.clientHeight,
  0.05,
  5000
);
dollCamera.position.set(6, 5, 6);

const orbit = new OrbitControls(dollCamera, renderer.domElement);
orbit.enabled = false;
orbit.enableDamping = true;
orbit.dampingFactor = 0.06;
orbit.rotateSpeed = 0.6;
orbit.zoomSpeed = 0.9;
orbit.panSpeed = 0.6;
orbit.target.set(0, 1, 0);

// -----------------------------
// Pano sphere
// -----------------------------
const sphereGeo = new THREE.SphereGeometry(50, 64, 64);
sphereGeo.scale(-1, 1, 1);

const sphereMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 1,
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
panoScene.add(sphere);

function setSphereMap(map) {
  sphereMat.map = map || null;
  sphereMat.color.setHex(map ? 0xffffff : 0x000000);
  sphereMat.needsUpdate = true;
}

let panoFadeToken = 0;
function blankPanoSphere() {
  panoFadeToken++;
  sphereMat.opacity = 0;
  setSphereMap(null);
}
function fadeInPano(duration = 450, fromColor = "black") {
  panoFadeToken++;
  const token = panoFadeToken;

  // Allow a white source fade for specific moments (e.g. intro -> first pano).
  if (fromColor === "white") {
    panoScene.background = new THREE.Color(0xffffff);
  } else {
    panoScene.background = null;
  }

  sphereMat.transparent = true;
  sphereMat.opacity = 0;

  const start = performance.now();
  const tick = () => {
    if (token !== panoFadeToken) return;
    const t = (performance.now() - start) / duration;
    const u = Math.min(1, Math.max(0, t));
    const e = u * u * (3 - 2 * u);
    sphereMat.opacity = e;
    if (u < 1) {
      requestAnimationFrame(tick);
    } else {
      panoScene.background = null;
    }
  };
  requestAnimationFrame(tick);
}

// -----------------------------
// Room label helpers
// -----------------------------
function getRoomLabelForIndex(i) {
  const label = ROOMS?.[i];
  return typeof label === "string" && label.trim().length ? label.trim() : "";
}

function showRoomLabelText(text) {
  const t = (text ?? "").toString().trim();

  // Guard: don't crash if the element isn't found yet
  if (!roomLabelEl) return;

  roomLabelEl.textContent = t;
  roomLabelEl.style.opacity = t ? "1" : "0";
}

function hideRoomLabelText() {
  if (!roomLabelEl) return;
  roomLabelEl.style.opacity = "0";
}

function setRoomLabel(i) {
  showRoomLabelText(getRoomLabelForIndex(i));
}

function updateIndicator(i) {
  if (indicator) indicator.textContent = `${pad2(i + 1)} / ${pad2(PANOS.length)}`;

  setRoomLabel(i);

  // Emit to listing page (safe/no-op if not embedded or if bridge not present)
  if (typeof emitListingNodeChange === "function") {
    emitListingNodeChange(i, "updateIndicator");
  }
}

function setUIEnabled(enabled) {
  if (backBtn) backBtn.disabled = !enabled;
  if (forwardBtn) forwardBtn.disabled = !enabled;
}
// -----------------------------
// Mode switching (safe)
// -----------------------------
let mode = "pano"; // "pano" | "dollhouse"

function ensurePanoUIActive() {
  // Enable pano controls, but do NOT force-show navWrap here.
  // Visibility should be handled by your “reveal UI after content visible” logic.
  setUIEnabled(true);
  isPointerDown = false;
  autoReorienting = false;
  state.isTransitioning = false;
  try {
    transitionVideo.pause();
  } catch {}
}

function setMode(which) {
  const prev = mode;
  const leavingPano = prev === "pano" && which !== "pano";

  if (leavingPano && state.isTransitioning) {
    cancelActivePanoTransition("setMode leaving pano");
  }

  mode = which;

  // ✅ invalidate any pending UI reveals from the previous mode
  __uiEpoch++;

  setTabActive(which);

  // Hide mode UI immediately — and HARD stop any pending reveals
  uiHide(navWrap, { fadeMs: 0 });
  uiHide(dollBtns, { fadeMs: 0 });

  // ✅ hard display toggles so buttons cannot “linger”
  if (navWrap) navWrap.style.display = which === "pano" ? "" : "none";
  if (dollBtns) dollBtns.style.display = which === "dollhouse" ? "" : "none";

  if (indicator) {
    indicator.style.display = "none";
    indicator.style.opacity = "0";
    indicator.style.pointerEvents = "none";
  }

  if (which !== "pano") {
    // Hide room label unless you are hovering nodes (handled by hover logic)
    hideRoomLabelText();
  } else {
    // restore current label immediately
    setRoomLabel(state.index);

    // ✅ re-emit current node to the parent listing page (even if index didn’t change)
    if (typeof emitListingNodeChange === "function") {
      emitListingNodeChange(state.index, "setMode:pano");
    }
  }

  orbit.enabled = which === "dollhouse";
  applyRenderLookForMode(which);

  if (which !== "pano") {
    try {
      transitionVideo.pause();
    } catch {}
  } else {
    ensurePanoUIActive();
  }

  if (which !== "dollhouse") hideYouAreHere();
  resizeRenderer();
}

// Tab events
if (tabPano) {
  tabPano.addEventListener("click", async () => {
    if (mode === "pano" || tabPano.classList.contains("active")) return;
    if (state.isTransitioning) cancelActivePanoTransition("tabPano click during transition");
    setMode("pano");
    blankPanoSphere();
    try {
      const tex = await ensurePanoLoaded(state.index);
      setSphereMap(tex);
      requestAnimationFrame(() => fadeInPano(220));
      revealPanoUIWhenReady();
    } catch (e) {
      console.warn("tabPano: failed to reload pano:", e);
      ensurePanoUIActive();
    }
  });
}
// -----------------------------
// Pano camera yaw/pitch
// -----------------------------
let yaw = 0;
let pitch = 0;
let targetYaw = 0;
let targetPitch = 0;
let autoReorienting = false;

const pitchLimit = THREE.MathUtils.degToRad(85);
function applyYawPitch() {
  pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
  const euler = new THREE.Euler(pitch, yaw, 0, "YXZ");
  panoCamera.quaternion.setFromEuler(euler);
}

// Smooth helpers
function wrapPi(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}
function shortestAngleDelta(from, to) {
  return wrapPi(to - from);
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function setTargetHero(index) {
  const h = HERO[index] || { yaw: 0, pitch: 0 };
  targetYaw = h.yaw ?? 0;
  targetPitch = h.pitch ?? 0;
}
function reorientToHero(index, durationMs = 350) {
  setTargetHero(index);
  autoReorienting = true;

  const startYaw = yaw;
  const startPitch = pitch;

  const dy = shortestAngleDelta(startYaw, targetYaw);
  const dp = targetPitch - startPitch;

  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / durationMs;
      const u = Math.min(1, Math.max(0, t));
      const e = u * u * (3 - 2 * u);

      yaw = startYaw + dy * e;
      pitch = startPitch + dp * e;
      applyYawPitch();

      if (u >= 1) {
        autoReorienting = false;
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function steerCameraDuringVideo({
  fromYaw,
  fromPitch,
  toYaw,
  toPitch,
  durationSec,
  startFrac = 0.2,
  endFrac = 1.0,
}) {
  autoReorienting = true;
  const start = performance.now();
  const durMs = Math.max(1, durationSec * 1000);

  const dYaw = shortestAngleDelta(fromYaw, toYaw);
  const dPitch = (toPitch ?? 0) - (fromPitch ?? 0);

  return new Promise((resolve) => {
    function tick() {
      if (!state.isTransitioning) {
        autoReorienting = false;
        resolve();
        return;
      }

      const raw = Math.min(1, (performance.now() - start) / durMs);
      const w = Math.max(0.0001, endFrac - startFrac);
      const t = Math.min(1, Math.max(0, (raw - startFrac) / w));
      const e = easeInOutCubic(t);

      yaw = (fromYaw ?? 0) + dYaw * e;
      pitch = (fromPitch ?? 0) + dPitch * e;
      applyYawPitch();

      if (raw >= 1) {
        autoReorienting = false;
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
}

// -----------------------------
// Look controls (pano only)
// -----------------------------
let isPointerDown = false;
let lastX = 0;
let lastY = 0;

const ROTATE_SPEED_MOUSE = 0.0035;
const ROTATE_SPEED_TOUCH = 0.0065;

function getRotateSpeed(e) {
  if (e.pointerType === "touch") return ROTATE_SPEED_TOUCH;
  return ROTATE_SPEED_MOUSE;
}
function boostedDelta(d) {
  const abs = Math.abs(d);
  const sign = Math.sign(d);
  const boost = abs < 6 ? 1.8 : abs < 12 ? 1.3 : 1.0;
  return sign * abs * boost;
}
function onPointerDown(e) {
  if (mode !== "pano") return;
  if (state.isTransitioning || autoReorienting) return;
  isPointerDown = true;
  lastX = e.clientX;
  lastY = e.clientY;
}
function onPointerMove(e) {
  if (mode !== "pano") return;
  if (!isPointerDown || state.isTransitioning || autoReorienting) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  const speed = getRotateSpeed(e);
  yaw -= boostedDelta(dx) * speed;
  pitch -= boostedDelta(dy) * speed;

  targetYaw = yaw;
  targetPitch = pitch;

  applyYawPitch();
}
function onPointerUp() {
  isPointerDown = false;
}

renderer.domElement.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

// -----------------------------
// Loading helpers (panos)
// -----------------------------
const texLoader = new THREE.TextureLoader();
function loadPano(url, onProgress01 = null) {
  return new Promise((resolve, reject) => {
    texLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        resolve(tex);
      },
      (xhr) => {
        if (typeof onProgress01 === "function") {
          const total = xhr?.total || 0;
          const loaded = xhr?.loaded || 0;
          if (total > 0) onProgress01(loaded / total);
        }
      },
      () => reject(new Error(`Failed to load pano: ${url}`))
    );
  });
}

// -----------------------------
// Transition system (VideoTexture)
// -----------------------------
function createReusableVideo() {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  v.loop = false;
  return v;
}
const transitionVideo = createReusableVideo();
const transitionTex = new THREE.VideoTexture(transitionVideo);
transitionTex.colorSpace = THREE.SRGBColorSpace;
transitionTex.minFilter = THREE.LinearFilter;
transitionTex.magFilter = THREE.LinearFilter;
transitionTex.generateMipmaps = false;

function loadVideoSrc(url) {
  return new Promise((resolve, reject) => {
    if (transitionVideo.src && transitionVideo.src.endsWith(url)) {
      if (!isNaN(transitionVideo.duration) && transitionVideo.duration > 0) {
        resolve();
        return;
      }
    }

    transitionVideo.pause();
    transitionVideo.removeAttribute("src");
    transitionVideo.load();

    transitionVideo.src = url;
    transitionVideo.load();

    const onLoadedMeta = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed to load video: ${url}`));
    };
    const cleanup = () => {
      transitionVideo.removeEventListener("loadedmetadata", onLoadedMeta);
      transitionVideo.removeEventListener("error", onError);
    };

    transitionVideo.addEventListener("loadedmetadata", onLoadedMeta);
    transitionVideo.addEventListener("error", onError);
  });
}
function seekVideo(timeSec) {
  return new Promise((resolve, reject) => {
    const dur = transitionVideo.duration || timeSec;
    const t = Math.max(0, Math.min(timeSec, dur));

    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video seek error"));
    };
    const cleanup = () => {
      transitionVideo.removeEventListener("seeked", onSeeked);
      transitionVideo.removeEventListener("error", onError);
    };

    transitionVideo.addEventListener("seeked", onSeeked);
    transitionVideo.addEventListener("error", onError);
    transitionVideo.currentTime = t;
  });
}

// -----------------------------
// State + caching
// -----------------------------
const state = {
  index: 0,
  isTransitioning: false,
  panoTextures: [],
};

let transitionCancelToken = 0;
async function cancelActivePanoTransition(reason = "cancel") {
  transitionCancelToken++;
  state.isTransitioning = false;
  autoReorienting = false;
  isPointerDown = false;

  try {
    transitionVideo.pause();
  } catch {}
  try {
    transitionVideo.currentTime = 0;
  } catch {}

  try {
    if (mode === "pano") {
      const tex = await ensurePanoLoaded(state.index);
      setSphereMap(tex);
      requestAnimationFrame(() => fadeInPano(220));
      setUIEnabled(true);
    }
  } catch (e) {
    console.warn("cancelActivePanoTransition restore failed:", e);
    if (mode === "pano") {
      blankPanoSphere();
      setUIEnabled(true);
    }
  }

  console.warn("🛑 Cancelled pano transition:", reason);
}

async function ensurePanoLoaded(i, onProgress01 = null) {
  if (i < 0 || i >= PANOS.length) return null;
  if (state.panoTextures[i]) {
    if (typeof onProgress01 === "function") onProgress01(1);
    return state.panoTextures[i];
  }
  const tex = await loadPano(PANOS[i], onProgress01);
  state.panoTextures[i] = tex;
  if (typeof onProgress01 === "function") onProgress01(1);
  return tex;
}
function preloadNearby(i) {
  ensurePanoLoaded(i + 1).catch(() => {});
  ensurePanoLoaded(i - 1).catch(() => {});
}

function transitionPathForward(fromIndex) {
  const a = fromIndex + 1;
  const b = fromIndex + 2;
  return TOUR_BASE + applyTransitionPattern(TOUR.transitionForwardPattern, a, b);
}
function transitionPathReverse(fromIndex) {
  const a = fromIndex + 1;
  const b = fromIndex;
  return TOUR_BASE + applyTransitionPattern(TOUR.transitionReversePattern, a, b);
}

async function playTransition(url, heroTargetIndex) {
  const myToken = transitionCancelToken;
  const stillValid = () => myToken === transitionCancelToken && mode === "pano";

  await loadVideoSrc(url);
  if (!stillValid()) return;

  await seekVideo(0);
  if (!stillValid()) return;

  setSphereMap(transitionTex);
  if (!stillValid()) return;

  try {
    await transitionVideo.play();
  } catch (e) {
    console.warn("Transition video play failed:", e);
    return;
  }

  const dur = transitionVideo.duration || 0;
  const hero = HERO[heroTargetIndex];

  let steerPromise = Promise.resolve();
  if (dur > 0 && hero) {
    const fromYaw = yaw;
    const fromPitch = pitch;
    steerPromise = steerCameraDuringVideo({
      fromYaw,
      fromPitch,
      toYaw: hero.yaw ?? 0,
      toPitch: hero.pitch ?? 0,
      durationSec: dur,
      startFrac: 0.2,
      endFrac: 1.0,
    });
  }

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const onEnded = () => finish();
    const onPaused = () => finish();
    const onError = () => finish();

    const maxMs = Math.max(1200, (dur || 0) * 1000 + 800);
    const timeoutId = setTimeout(finish, maxMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      transitionVideo.removeEventListener("ended", onEnded);
      transitionVideo.removeEventListener("pause", onPaused);
      transitionVideo.removeEventListener("error", onError);
    };

    transitionVideo.addEventListener("ended", onEnded);
    transitionVideo.addEventListener("pause", onPaused);
    transitionVideo.addEventListener("error", onError);

    if (dur > 0 && transitionVideo.currentTime >= dur - 0.01) finish();
  });

  if (!stillValid()) return;

  try {
    transitionVideo.pause();
  } catch {}

  await steerPromise;
  targetYaw = yaw;
  targetPitch = pitch;
}

// -----------------------------
// Navigation (pano)
// -----------------------------
async function goTo(targetIndex) {
  if (mode !== "pano") return;
  if (state.isTransitioning) return;
  if (targetIndex === state.index) return;
  if (targetIndex < 0 || targetIndex >= PANOS.length) return;
  if (Math.abs(targetIndex - state.index) !== 1) return;

  const from = state.index;
  const to = targetIndex;

  const myToken = transitionCancelToken;
  const stillValid = () => myToken === transitionCancelToken && mode === "pano";

  state.isTransitioning = true;
  setUIEnabled(false);

  const watchdog = setTimeout(() => {
    if (state.isTransitioning && myToken === transitionCancelToken) {
      cancelActivePanoTransition("watchdog timeout");
    }
  }, 15000);

  try {
    if (!stillValid()) return;

    await reorientToHero(from, 700);
    if (!stillValid()) return;

    const nextTexPromise = ensurePanoLoaded(to);

    if (to === from + 1) await playTransition(transitionPathForward(from), to);
    else await playTransition(transitionPathReverse(from), to);

    if (!stillValid()) return;

    const nextTex = await nextTexPromise;
    if (!stillValid()) return;

    setSphereMap(nextTex);
    state.index = to;
    updateIndicator(state.index);
    preloadNearby(state.index);

    await reorientToHero(to, 150);
    if (!stillValid()) return;

    targetYaw = yaw;
    targetPitch = pitch;
  } catch (err) {
    console.error("Transition failed:", err);
    if (!stillValid()) return;
    try {
      const tex = await ensurePanoLoaded(to);
      if (!stillValid()) return;
      setSphereMap(tex);
      state.index = to;
      updateIndicator(state.index);
      preloadNearby(state.index);
      await reorientToHero(to, 200);
      if (!stillValid()) return;
      targetYaw = yaw;
      targetPitch = pitch;
    } catch (e) {
      console.error("Also failed to load pano:", e);
    }
  } finally {
    clearTimeout(watchdog);
    if (stillValid()) {
      state.isTransitioning = false;
      autoReorienting = false;
      isPointerDown = false;
      if (mode === "pano") setUIEnabled(true);
    }
  }
}

async function restartTourFromFirstNodeWithFade() {
  if (mode !== "pano") return;
  if (state.isTransitioning) return;
  if (!Array.isArray(PANOS) || PANOS.length === 0) return;

  const firstIndex = 0;
  state.isTransitioning = true;
  setUIEnabled(false);
  autoReorienting = false;
  isPointerDown = false;

  try {
    try {
      transitionVideo.pause();
      transitionVideo.currentTime = 0;
    } catch {}

    await fadeOverlayTo(1, 260);
    fadeOverlay.style.opacity = "1";

    blankPanoSphere();
    const firstTex = await ensurePanoLoaded(firstIndex);
    setSphereMap(firstTex);

    state.index = firstIndex;
    updateIndicator(firstIndex);
    preloadNearby(firstIndex);

    yaw = HERO[firstIndex]?.yaw ?? 0;
    pitch = HERO[firstIndex]?.pitch ?? 0;
    targetYaw = yaw;
    targetPitch = pitch;
    applyYawPitch();

    requestAnimationFrame(() => fadeInPano(420));
    await fadeOverlayTo(0, 320);
    fadeOverlay.style.opacity = "0";
  } catch (e) {
    console.error("Failed to restart tour from first node:", e);
    fadeOverlay.style.opacity = "0";
  } finally {
    state.isTransitioning = false;
    if (mode === "pano") setUIEnabled(true);
  }
}

if (forwardBtn) {
  forwardBtn.addEventListener("click", async () => {
    const nextIndex = state.index + 1;
    if (nextIndex >= PANOS.length) {
      await restartTourFromFirstNodeWithFade();
      return;
    }
    goTo(nextIndex);
  });
}
if (backBtn) backBtn.addEventListener("click", () => goTo(state.index - 1));

// -----------------------------
// jumpToPano (from dollhouse node click)
// -----------------------------
async function jumpToPano(index) {
  if (state.isTransitioning) await cancelActivePanoTransition("jumpToPano");
  setMode("pano");
  hideYouAreHere();

  if (refCenter) {
    orbit.target.copy(refCenter);
    orbit.update();
  }

  blankPanoSphere();

  const tex = await ensurePanoLoaded(index);
  setSphereMap(tex);

  state.index = index;
  updateIndicator(index);
  preloadNearby(index);

  yaw = HERO[index]?.yaw ?? 0;
  pitch = HERO[index]?.pitch ?? 0;
  targetYaw = yaw;
  targetPitch = pitch;
  applyYawPitch();

  requestAnimationFrame(() => fadeInPano(450));
revealPanoUIWhenReady();
}

// -----------------------------
// Dollhouse: nodes + marker
// -----------------------------
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let activeNodeMeshes = [];
let hoveredNode = null;

const nodeHoverState = new Map();

const NODE_BASE_COLOR = new THREE.Color(0x66ccff);
const NODE_HOVER_COLOR = new THREE.Color(0xffffff);
const NODE_BASE_EMISSIVE = new THREE.Color(0x2aa9ff);
const NODE_HOVER_EMISSIVE = new THREE.Color(0xffffff);
const NODE_BASE_EMISSIVE_INT = 0.25;
const NODE_HOVER_EMISSIVE_INT = 1.8;
const NODE_HOVER_SCALE = 0.25;

// You-are-here marker
const youAreHere = new THREE.Mesh(
  new THREE.ConeGeometry(0.22, 0.42, 4),
  new THREE.MeshStandardMaterial({
    color: 0xffd400,
    emissive: 0x2a2000,
    emissiveIntensity: 0.8,
    roughness: 0.35,
    metalness: 0.0,
    toneMapped: true,
    transparent: true,
    opacity: 1,
  })
);
youAreHere.rotation.x = Math.PI;
youAreHere.visible = false;
youAreHere.frustumCulled = false;
dollScene.add(youAreHere);
const youAreHereMat = youAreHere.material;

const youAreHereBasePos = new THREE.Vector3();
let youAreHereHasBase = false;
let suppressYouAreHereUntilRelease = false;
let youAreHereFadeToken = 0;

function fadeInYouAreHere(durationMs = 380) {
  if (!youAreHereHasBase || mode !== "dollhouse") return;

  const token = ++youAreHereFadeToken;
  const start = performance.now();
  youAreHere.visible = true;
  youAreHereMat.opacity = 0;

  const tick = () => {
    if (token !== youAreHereFadeToken) return;
    if (mode !== "dollhouse" || !youAreHereHasBase) return;

    const u = Math.min(1, Math.max(0, (performance.now() - start) / durationMs));
    const e = smoothstep(u);
    youAreHereMat.opacity = e;

    if (u >= 1) return;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function setYouAreHereSuppressed(suppressed, { fadeIn = false } = {}) {
  suppressYouAreHereUntilRelease = !!suppressed;
  if (suppressYouAreHereUntilRelease) {
    youAreHereFadeToken++;
    youAreHere.visible = false;
    youAreHereMat.opacity = 0;
    return;
  }

  if (!youAreHereHasBase || mode !== "dollhouse") return;
  if (fadeIn) fadeInYouAreHere();
  else {
    youAreHereFadeToken++;
    youAreHereMat.opacity = 1;
    youAreHere.visible = true;
  }
}

function hideYouAreHere() {
  youAreHereFadeToken++;
  youAreHere.visible = false;
  youAreHereMat.opacity = 1;
  youAreHereHasBase = false;
}
function placeYouAreHereAboveNodeMesh(nodeMesh) {
  if (!nodeMesh || mode !== "dollhouse") {
    hideYouAreHere();
    return;
  }
  const p = new THREE.Vector3();
  nodeMesh.getWorldPosition(p);
  p.y += YOU_ARE_HERE_OFFSET_Y;

  youAreHere.position.copy(p);
  youAreHereBasePos.copy(p);
  youAreHereHasBase = true;
  if (suppressYouAreHereUntilRelease) {
    youAreHere.visible = false;
    youAreHereMat.opacity = 0;
  } else {
    youAreHereMat.opacity = 1;
    youAreHere.visible = true;
  }
}
function updateYouAreHere(dt, nowSec) {
  if (mode !== "dollhouse") return;
  if (!youAreHere.visible || !youAreHereHasBase) return;

  const bob = Math.sin(nowSec * NODE_MARKER_BOB_SPEED) * NODE_MARKER_BOB_HEIGHT;
  youAreHere.position.y = youAreHereBasePos.y + bob;
  youAreHere.rotation.y += NODE_MARKER_SPIN_SPEED * dt;
}

// -----------------------------
// Dollhouse lighting + framing
// -----------------------------
function addDollhouseLights(scene) {
  const lights = [];
  scene.traverse((o) => {
    if (o.isLight) lights.push(o);
  });
  for (const l of lights) l.removeFromParent();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 2.0);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(8, 14, 10);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  fill.position.set(-10, 10, -6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(0, 12, -14);
  scene.add(rim);

  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(amb);

  scene.background = new THREE.Color(0x111111);
}

function frameCameraToObject(camera, controls, object, fitOffset = 1.25) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) return;
  const maxSize = Math.max(size.x, size.y, size.z);
  if (maxSize <= 0) return;

  const fitHeightDistance =
    maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

  camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.55, distance));
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(center);
    controls.update();
    controls.minDistance = distance * 0.35;
    controls.maxDistance = distance * 4.0;
  } else {
    camera.lookAt(center);
  }
}

// -----------------------------
// Dollhouse loading/cache
// -----------------------------
const gltfLoader = new GLTFLoader();
const dollCache = new Map(); // key -> { root, center, size, alignedOnce, nodes }
let activeDollKey = "down";
let activeDollRoot = null;

const dollhouseReady = { down: false, up: false, full: false, ref: false };
let refCenter = null;
let refDistance = null;
let refReady = false;
let framedOnce = false;
let hasPlayedInitialDollhouseWipe = false;

let defaultDollView = null;
let needsDollReset = false;

const DOLL_DEFAULT_VIEW_STORAGE_KEY = "doll_default_view_v1";
const DOLL_WIPE_FIRST_REVEAL_MS = 3600;
const DOLL_WIPE_SWITCH_MS = 1440;

function serializeOrbitView(v) {
  return {
    camPos: v.camPos.toArray(),
    camQuat: [v.camQuat.x, v.camQuat.y, v.camQuat.z, v.camQuat.w],
    target: v.target.toArray(),
    zoom: v.zoom,
  };
}
function deserializeOrbitView(o) {
  if (!o?.camPos || !o?.camQuat || !o?.target) return null;
  return {
    camPos: new THREE.Vector3().fromArray(o.camPos),
    camQuat: new THREE.Quaternion(o.camQuat[0], o.camQuat[1], o.camQuat[2], o.camQuat[3]),
    target: new THREE.Vector3().fromArray(o.target),
    zoom: o.zoom ?? 1,
  };
}
function loadSavedDefaultDollView() {
  try {
    const raw = localStorage.getItem(DOLL_DEFAULT_VIEW_STORAGE_KEY);
    if (!raw) return null;
    return deserializeOrbitView(JSON.parse(raw));
  } catch {
    return null;
  }
}
function saveOrbitView() {
  return {
    camPos: dollCamera.position.clone(),
    camQuat: dollCamera.quaternion.clone(),
    target: orbit.target.clone(),
    zoom: dollCamera.zoom,
  };
}
function applyOrbitViewWithLockedPivot(v) {
  if (!v) return;

  if (!refCenter) {
    orbit.target.copy(v.target);
    dollCamera.position.copy(v.camPos);
    dollCamera.zoom = v.zoom ?? 1;
    dollCamera.updateProjectionMatrix();
    orbit.update();
    return;
  }

  const savedTarget = v.target?.clone?.() || orbit.target.clone();
  const offset = v.camPos.clone().sub(savedTarget);

  orbit.target.copy(refCenter);
  dollCamera.position.copy(refCenter.clone().add(offset));
  dollCamera.zoom = v.zoom ?? 1;

  dollCamera.updateProjectionMatrix();
  orbit.update();
}

// -----------------------------
// Dollhouse reset: zoom out from current pano node + orientation match
// -----------------------------

// If it rotates the wrong way relative to your pano, flip to -1
const PANO_TO_DOLL_SIGN = 1;
// 1 = full match, 0.5 = half as much, etc.
const PANO_TO_DOLL_GAIN = 1.0;

// If user didn't rotate in pano, do a full spin on return
const NO_INPUT_EPS_RAD = THREE.MathUtils.degToRad(1.0);
const FULL_SPIN_RAD = Math.PI * 2;
const FULL_SPIN_SIGN = 1;

const RETURN_ROTATE_MS_NORMAL = 1400;
const RETURN_ROTATE_MS_FULLSPIN = 2100;

function getPanoLookDeltaForIndex(i) {
  const heroYaw = HERO[i]?.yaw ?? 0;
  return wrapPi(yaw - heroYaw);
}

// Get orbit azimuth (theta) around a given target
function getOrbitThetaAroundTarget(target) {
  const offset = dollCamera.position.clone().sub(target);
  const sph = new THREE.Spherical().setFromVector3(offset);
  return sph.theta;
}

// Set orbit azimuth (theta) around a given target, keeping radius + phi
function setOrbitThetaAroundTarget(target, theta) {
  const offset = dollCamera.position.clone().sub(target);
  const sph = new THREE.Spherical().setFromVector3(offset);
  sph.theta = theta;
  const newOffset = new THREE.Vector3().setFromSpherical(sph);
  dollCamera.position.copy(target.clone().add(newOffset));
}

function smoothstep(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// Animate camera position (+ optional yaw rotation around the pivot) back to a saved view.
// rotateYawDelta rotates around refCenter during the animation (radians).
// If lockTheta=true, we DO NOT also interpolate toward the end theta automatically.
// This prevents “double-rotation” (which was causing the random-looking orientation when returning).
async function animateToOrbitView(
  v,
  durationMs = 450,
  {
    rotateYawDelta = 0,
    rotateStartAt = 0.0,
    rotateEndAt = 1.0,
    lockTheta = false,
  } = {}
) {
  if (!v) return;
  if (!refCenter) {
    applyOrbitViewWithLockedPivot(v);
    return;
  }

  const prevDamping = orbit.enableDamping;
  orbit.enableDamping = false;

  const pivot = refCenter.clone();

  // Start + end offsets relative to pivot
  const startOffset = dollCamera.position.clone().sub(pivot);
  const endOffset = v.camPos.clone().sub(pivot);

  const startSph = new THREE.Spherical().setFromVector3(startOffset);
  const endSph = new THREE.Spherical().setFromVector3(endOffset);

  const startR = startSph.radius;
  const startPhi = startSph.phi;
  const startTheta = startSph.theta;

  const endR = endSph.radius;
  const endPhi = endSph.phi;
  const endThetaBase = endSph.theta;

  const startZoom = dollCamera.zoom;
  const endZoom = v.zoom ?? 1;

  // Base theta interpolation (optional). When lockTheta=true we keep theta steady
  // and ONLY apply the extra rotation you pass in via rotateYawDelta.
  const baseThetaDelta = lockTheta ? 0 : shortestAngleDelta(startTheta, endThetaBase);

  const start = performance.now();

  return new Promise((resolve) => {
    function tick() {
      const uRaw = (performance.now() - start) / durationMs;
      const u = Math.min(1, Math.max(0, uRaw));
      const e = smoothstep(u);

      orbit.target.copy(pivot);

      // base movement (radius + phi)
      const r = startR + (endR - startR) * e;
      const phi = startPhi + (endPhi - startPhi) * e;

      // optional extra rotation over a portion of the anim
      const w = Math.max(1e-6, rotateEndAt - rotateStartAt);
      const ru = Math.min(1, Math.max(0, (u - rotateStartAt) / w));
      const re = smoothstep(ru);
      const extraRot = rotateYawDelta * re;

      const theta = startTheta + baseThetaDelta * e + extraRot;

      const sph = new THREE.Spherical(r, phi, theta);
      const newPos = new THREE.Vector3().setFromSpherical(sph).add(pivot);

      dollCamera.position.copy(newPos);
      dollCamera.zoom = startZoom + (endZoom - startZoom) * e;
      dollCamera.updateProjectionMatrix();
      orbit.update();

      if (u >= 1) {
        orbit.enableDamping = prevDamping;
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Snap orbit to a "near node" view that still pivots around refCenter
function snapOrbitToNode(mesh, distanceFactor = 0.10) {
  if (!mesh || !defaultDollView || !refCenter) return;

  const nodeWorld = new THREE.Vector3();
  mesh.getWorldPosition(nodeWorld);

  const defaultOffset = defaultDollView.camPos.clone().sub(defaultDollView.target);
  const defaultRadius = Math.max(0.15, defaultOffset.length());
  const endRadius = Math.max(0.15, defaultRadius * distanceFactor);

  const defaultDir = defaultOffset.clone().normalize();
  const nodeDir = nodeWorld.clone().sub(refCenter);
  if (nodeDir.lengthSq() > 1e-8) nodeDir.normalize();
  else nodeDir.copy(defaultDir);

  const dir = defaultDir.clone().lerp(nodeDir, 0.65).normalize();

  orbit.target.copy(refCenter);
  dollCamera.position.copy(refCenter.clone().add(dir.multiplyScalar(endRadius)));
  dollCamera.zoom = defaultDollView.zoom ?? 1;
  dollCamera.updateProjectionMatrix();
  orbit.update();
}

// Prefer up/down; fall back to full if a node doesn't exist in those.
async function chooseBestDollKeyForPano(panoIndex) {
  // Ensure some caches exist (don’t block too hard; these are cached after first load)
  await loadDollModel("down").catch(() => {});
  await loadDollModel("up").catch(() => {});
  await loadDollModel("full").catch(() => {});

  const has = (key) => {
    const entry = dollCache.get(key);
    return !!findNodeInEntry(entry, panoIndex);
  };

  if (has("up")) return "up";
  if (has("down")) return "down";
  return "full";
}

async function ensureBestModelHasNode(panoIndex) {
  const bestKey = await chooseBestDollKeyForPano(panoIndex);

  if (activeDollKey !== bestKey) {
    // Preserve current view while swapping models
    const view = saveOrbitView();

    activeDollKey = bestKey;
    setDollButtonsActive(bestKey);

    const root = await loadDollModel(bestKey);
    alignModelToReference(bestKey);
    setActiveDollRoot(root);

    applyOrbitViewWithLockedPivot(view);
    applyReferenceClippingAndLimits();
  }

  const entry = dollCache.get(activeDollKey);
  return findNodeInEntry(entry, panoIndex) || null;
}

// When entering dollhouse from pano: start near current pano's node, match pano yaw, then zoom out + rotate back to default.
async function resetDollhouseFromCurrentPano(
  animated = true,
  { onPrepared = null, onSpinStart = null, allowFullSpin = true } = {}
) {
  if (!defaultDollView) return;
  if (!refCenter) return;

  // lock pivot
  orbit.target.copy(refCenter);
  orbit.update();

  // cancel any in-progress node zoom
  nodeZoomToken++;

  // --- Compute how far the user turned away from the HERO yaw in pano ---
  const panoDeltaRaw =
    getPanoLookDeltaForIndex(state.index) * PANO_TO_DOLL_GAIN * PANO_TO_DOLL_SIGN;

  // If user didn’t rotate in pano, do a full spin on return (purely aesthetic)
  const shouldFullSpin = allowFullSpin && Math.abs(panoDeltaRaw) < NO_INPUT_EPS_RAD;

  // We want to end EXACTLY at the default dollhouse orientation.
  // To do that reliably (without double-rotation), we:
  //  1) Set the starting theta to (defaultTheta + panoDeltaRaw)
  //  2) Animate OUT to the default view while rotating theta back to defaultTheta
  //     using lockTheta=true (so the animation doesn’t also auto-interp theta).

  // Theta of the DEFAULT view around the locked pivot
  const endTheta = new THREE.Spherical().setFromVector3(
    defaultDollView.camPos.clone().sub(refCenter)
  ).theta;

  // pick model that actually contains the node
  let node = null;
  try {
    node = await ensureBestModelHasNode(state.index);
  } catch (e) {
    console.warn("ensureBestModelHasNode failed:", e);
  }

  // 1) start near the node (or fall back to default)
  if (node) snapOrbitToNode(node, 0.10);
  else applyOrbitViewWithLockedPivot(defaultDollView);

  // 2) force a deterministic start theta that matches pano look direction
  const startTheta = endTheta + panoDeltaRaw;
  setOrbitThetaAroundTarget(orbit.target, startTheta);
  orbit.update();

  // ✅ Signal to caller that the camera is now in its correct START pose
  // (node snap + pano yaw alignment). Caller can safely reveal after this.
  if (typeof onPrepared === "function") {
    try {
      onPrepared({ startTheta, endTheta, panoDeltaRaw, shouldFullSpin });
    } catch {}
  }

  // Give the renderer at least one frame with the correct pose before any reveal.
  await new Promise((r) => requestAnimationFrame(r));

  // 3) Always animate back to default when returning from pano
  if (animated) {
    const durationMs = shouldFullSpin
      ? RETURN_ROTATE_MS_FULLSPIN
      : RETURN_ROTATE_MS_NORMAL;

    let rotateYawDeltaToEnd = shortestAngleDelta(startTheta, endTheta);
    if (shouldFullSpin) rotateYawDeltaToEnd += FULL_SPIN_RAD * FULL_SPIN_SIGN;

    if (typeof onSpinStart === "function") {
      try {
        onSpinStart({ durationMs, shouldFullSpin });
      } catch {}
    }

    await animateToOrbitView(defaultDollView, durationMs, {
      rotateYawDelta: rotateYawDeltaToEnd,
      rotateStartAt: 0.1,
      rotateEndAt: 1.0,
      lockTheta: true,
    });
  } else {
    applyOrbitViewWithLockedPivot(defaultDollView);
  }

  // after reset, re-sync the marker (new pyramid)
  syncYouAreHereToCurrentPano();
}

function prepDollhouseSceneGraph(root) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 1;

  root.traverse((o) => {
    if (!o.isMesh) return;

    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;

      if (m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.anisotropy = Math.min(8, maxAniso);
        m.map.needsUpdate = true;
      }
      if ("toneMapped" in m) m.toneMapped = true;
      m.needsUpdate = true;
    }
  });
}

// Extract meshes named NODE_XX (or containing NODE_) as clickable nodes
function extractNodes(root) {
  const nodes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.name || "").toUpperCase();
    // Expect: NODE_01, NODE_02 ... (match any digits)
    // ONLY match exact node meshes like: NODE_01, NODE_1
const m = name.match(/^NODE_(\d+)$/);
    if (!m) return;

    const idx = parseInt(m[1], 10);
    if (!isFinite(idx)) return;

    // Convert 1-based node number -> 0-based pano index
    o.userData.panoIndex = idx - 1;

    // Give it a visible-ish material treatment (if you are using dedicated node meshes)
    // IMPORTANT: Clone materials so each node has independent hover state.
    // GLTF often reuses the same material instance across many meshes.
    if (o.material) {
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m) => (m && m.clone ? m.clone() : m));
      } else if (o.material.clone) {
        o.material = o.material.clone();
      }
    }

    // Apply our node look only to Standard materials
    if (o.material && o.material.isMeshStandardMaterial) {
      o.material.color = NODE_BASE_COLOR.clone();
      o.material.emissive = NODE_BASE_EMISSIVE.clone();
      o.material.emissiveIntensity = NODE_BASE_EMISSIVE_INT;
      o.material.roughness = 0.35;
      o.material.metalness = 0.0;
      o.material.needsUpdate = true;
    }

    nodes.push(o);
    nodeHoverState.set(o, { baseScale: o.scale.clone(), hover: 0, target: 0 });
  });

  return nodes;
}

function dollUrlForKey(key) {
  if (key === "up") return DOLLHOUSE_GLB_UP;
  if (key === "down") return DOLLHOUSE_GLB_DOWN;
  return DOLLHOUSE_GLB_FULL;
}

function setDollButtonsActive(key) {
  if (!btnFull || !btnUp || !btnDown) return;
  btnFull.classList.toggle("active", key === "full");
  btnUp.classList.toggle("active", key === "up");
  btnDown.classList.toggle("active", key === "down");

  btnFull.classList.toggle("hasStroke", !btnFull.classList.contains("active"));
  btnUp.classList.toggle("hasStroke", !btnUp.classList.contains("active"));
  btnDown.classList.toggle("hasStroke", !btnDown.classList.contains("active"));
}

function getBoundsInfo(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}
function computeRefDistanceFromBounds(size) {
  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(dollCamera.fov * 0.5)));
  const fitWidthDistance = fitHeightDistance / dollCamera.aspect;
  return 1.35 * Math.max(fitHeightDistance, fitWidthDistance);
}
function applyReferenceClippingAndLimits() {
  if (!refDistance) return;

  dollCamera.near = Math.max(0.01, refDistance / 100);
  dollCamera.far = refDistance * 100;
  dollCamera.updateProjectionMatrix();

  orbit.minDistance = refDistance * 0.35;
  orbit.maxDistance = refDistance * 4.0;
}

function collectUniqueMaterialsFromRoot(root) {
  const seen = new Set();
  const out = [];

  if (!root) return out;

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      out.push(m);
    }
  });

  return out;
}

async function playDollhouseBottomUpWipe(root, durationMs = DOLL_WIPE_SWITCH_MS) {
  if (!root || durationMs <= 0) return;

  const bounds = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(bounds.min.y) || !Number.isFinite(bounds.max.y)) return;

  const spanY = Math.max(0.001, bounds.max.y - bounds.min.y);
  const cutStart = bounds.min.y - spanY * 0.02;
  const cutEnd = bounds.max.y + spanY * 0.02;
  const wipePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), cutStart);

  const mats = collectUniqueMaterialsFromRoot(root);
  if (!mats.length) return;

  const prevState = mats.map((m) => ({
    mat: m,
    clippingPlanes: Array.isArray(m.clippingPlanes) ? [...m.clippingPlanes] : null,
    clipIntersection: m.clipIntersection,
    clipShadows: m.clipShadows,
  }));

  renderer.localClippingEnabled = true;
  for (const m of mats) {
    m.clippingPlanes = [wipePlane];
    m.clipIntersection = false;
    m.clipShadows = false;
    m.needsUpdate = true;
  }

  try {
    const startT = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        if (mode !== "dollhouse") {
          resolve();
          return;
        }

        const t = Math.min(1, (performance.now() - startT) / durationMs);
        const e = easeInOutCubic(t);
        wipePlane.constant = THREE.MathUtils.lerp(cutStart, cutEnd, e);

        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    for (const p of prevState) {
      p.mat.clippingPlanes = p.clippingPlanes;
      p.mat.clipIntersection = p.clipIntersection;
      p.mat.clipShadows = p.clipShadows;
      p.mat.needsUpdate = true;
    }
    renderer.localClippingEnabled = false;
  }
}

async function playDollhouseSwapWipeUp(inRoot, outRoot, durationMs = DOLL_WIPE_SWITCH_MS) {
  if (!inRoot || durationMs <= 0) return;

  const inBounds = new THREE.Box3().setFromObject(inRoot);
  if (!Number.isFinite(inBounds.min.y) || !Number.isFinite(inBounds.max.y)) return;

  const inSpanY = Math.max(0.001, inBounds.max.y - inBounds.min.y);
  const inStart = inBounds.min.y - inSpanY * 0.02;
  const inEnd = inBounds.max.y + inSpanY * 0.02;
  const revealPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), inStart);

  let hidePlane = null;
  let outStart = 0;
  let outEnd = 0;
  if (outRoot) {
    const outBounds = new THREE.Box3().setFromObject(outRoot);
    if (Number.isFinite(outBounds.min.y) && Number.isFinite(outBounds.max.y)) {
      const outSpanY = Math.max(0.001, outBounds.max.y - outBounds.min.y);
      outStart = outBounds.min.y - outSpanY * 0.02;
      outEnd = outBounds.max.y + outSpanY * 0.02;
      // Hide from bottom -> top (opposite of reveal intent): y<threshold gets clipped.
      hidePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -outStart);
    }
  }

  const inMats = collectUniqueMaterialsFromRoot(inRoot);
  const outMats = outRoot ? collectUniqueMaterialsFromRoot(outRoot) : [];
  const mats = [...inMats, ...outMats];
  if (!mats.length) return;

  const prevState = mats.map((m) => ({
    mat: m,
    clippingPlanes: Array.isArray(m.clippingPlanes) ? [...m.clippingPlanes] : null,
    clipIntersection: m.clipIntersection,
    clipShadows: m.clipShadows,
  }));

  renderer.localClippingEnabled = true;

  for (const m of inMats) {
    m.clippingPlanes = [revealPlane];
    m.clipIntersection = false;
    m.clipShadows = false;
    m.needsUpdate = true;
  }

  if (hidePlane) {
    for (const m of outMats) {
      m.clippingPlanes = [hidePlane];
      m.clipIntersection = false;
      m.clipShadows = false;
      m.needsUpdate = true;
    }
  }

  try {
    const startT = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        if (mode !== "dollhouse") {
          resolve();
          return;
        }

        const t = Math.min(1, (performance.now() - startT) / durationMs);
        const e = easeInOutCubic(t);
        revealPlane.constant = THREE.MathUtils.lerp(inStart, inEnd, e);
        if (hidePlane) {
          const hideThreshold = THREE.MathUtils.lerp(outStart, outEnd, e);
          hidePlane.constant = -hideThreshold;
        }

        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    for (const p of prevState) {
      p.mat.clippingPlanes = p.clippingPlanes;
      p.mat.clipIntersection = p.clipIntersection;
      p.mat.clipShadows = p.clipShadows;
      p.mat.needsUpdate = true;
    }
    renderer.localClippingEnabled = false;
  }
}

async function playDollhouseSwapWipeDown(inRoot, outRoot, durationMs = DOLL_WIPE_SWITCH_MS) {
  if (!inRoot || durationMs <= 0) return;

  const inBounds = new THREE.Box3().setFromObject(inRoot);
  if (!Number.isFinite(inBounds.min.y) || !Number.isFinite(inBounds.max.y)) return;

  const inSpanY = Math.max(0.001, inBounds.max.y - inBounds.min.y);
  const inTop = inBounds.max.y + inSpanY * 0.02;
  const inBottom = inBounds.min.y - inSpanY * 0.02;
  // Reveal from top -> bottom: start showing only the top, then move downward.
  const revealPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -inTop);

  let hidePlane = null;
  let outTop = 0;
  let outBottom = 0;
  if (outRoot) {
    const outBounds = new THREE.Box3().setFromObject(outRoot);
    if (Number.isFinite(outBounds.min.y) && Number.isFinite(outBounds.max.y)) {
      const outSpanY = Math.max(0.001, outBounds.max.y - outBounds.min.y);
      outTop = outBounds.max.y + outSpanY * 0.02;
      outBottom = outBounds.min.y - outSpanY * 0.02;
      // Hide from top -> bottom: clip y > threshold while threshold moves down.
      hidePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), outTop);
    }
  }

  const inMats = collectUniqueMaterialsFromRoot(inRoot);
  const outMats = outRoot ? collectUniqueMaterialsFromRoot(outRoot) : [];
  const mats = [...inMats, ...outMats];
  if (!mats.length) return;

  const prevState = mats.map((m) => ({
    mat: m,
    clippingPlanes: Array.isArray(m.clippingPlanes) ? [...m.clippingPlanes] : null,
    clipIntersection: m.clipIntersection,
    clipShadows: m.clipShadows,
  }));

  renderer.localClippingEnabled = true;

  for (const m of inMats) {
    m.clippingPlanes = [revealPlane];
    m.clipIntersection = false;
    m.clipShadows = false;
    m.needsUpdate = true;
  }

  if (hidePlane) {
    for (const m of outMats) {
      m.clippingPlanes = [hidePlane];
      m.clipIntersection = false;
      m.clipShadows = false;
      m.needsUpdate = true;
    }
  }

  try {
    const startT = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        if (mode !== "dollhouse") {
          resolve();
          return;
        }

        const t = Math.min(1, (performance.now() - startT) / durationMs);
        const e = easeInOutCubic(t);
        const revealThreshold = THREE.MathUtils.lerp(inTop, inBottom, e);
        revealPlane.constant = -revealThreshold;

        if (hidePlane) {
          const hideThreshold = THREE.MathUtils.lerp(outTop, outBottom, e);
          hidePlane.constant = hideThreshold;
        }

        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    for (const p of prevState) {
      p.mat.clippingPlanes = p.clippingPlanes;
      p.mat.clipIntersection = p.clipIntersection;
      p.mat.clipShadows = p.clipShadows;
      p.mat.needsUpdate = true;
    }
    renderer.localClippingEnabled = false;
  }
}

function alignModelToReference(key) {
  if (key === "full") return;
  const entry = dollCache.get(key);
  if (!entry || !refCenter) return;
  if (entry.alignedOnce) return;

  const offset = new THREE.Vector3().subVectors(refCenter, entry.center);
  entry.root.position.add(offset);

  const updated = getBoundsInfo(entry.root);
  entry.center.copy(updated.center);
  entry.alignedOnce = true;
}

async function loadDollModel(key, onProgress01 = null) {
  if (dollCache.has(key)) {
    if (typeof onProgress01 === "function") onProgress01(1);
    return dollCache.get(key).root;
  }

  const url = dollUrlForKey(key);
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const root = gltf.scene;

        addDollhouseLights(dollScene);
        prepDollhouseSceneGraph(root);

        const { center, size } = getBoundsInfo(root);
        const nodes = extractNodes(root);

        dollCache.set(key, { root, center, size, alignedOnce: false, nodes });

        if (key === "down") dollhouseReady.down = true;
        if (key === "up") dollhouseReady.up = true;
        if (key === "full") dollhouseReady.full = true;

        resolve(root);
      },
      (xhr) => {
        if (typeof onProgress01 === "function") {
          const total = xhr?.total || 0;
          const loaded = xhr?.loaded || 0;
          if (total > 0) onProgress01(loaded / total);
        }
      },
      (err) => reject(err)
    );
  });
}

async function ensureReferenceReady() {
  if (refReady) return;

  const fullRoot = await loadDollModel("full");
  const info = dollCache.get("full");
  if (!info) throw new Error("FULL doll model missing from cache after load");

  refCenter = info.center.clone();
  refDistance = computeRefDistanceFromBounds(info.size);
  refReady = true;
  dollhouseReady.ref = true;

  orbit.target.copy(refCenter);
  applyReferenceClippingAndLimits();
  orbit.update();

  // lock default view pivot if already present
  if (defaultDollView) {
    const offset = defaultDollView.camPos.clone().sub(defaultDollView.target);
    defaultDollView.target = refCenter.clone();
    defaultDollView.camPos = refCenter.clone().add(offset);
  }
}

function setActiveDollRoot(root) {
  if (activeDollRoot) dollScene.remove(activeDollRoot);

  if (!root) {
    activeDollRoot = null;
    activeNodeMeshes = [];
    renderer.domElement.style.cursor = orbit.enabled ? "grab" : "default";
    return;
  }

  activeDollRoot = root;
  dollScene.add(activeDollRoot);

  const entry = dollCache.get(activeDollKey);
  activeNodeMeshes = entry?.nodes || [];

  // Sync marker to current pano index if possible
  syncYouAreHereToCurrentPano();

  // Clear hover
  if (hoveredNode) {
    const s = nodeHoverState.get(hoveredNode);
    if (s) s.target = 0;
    hoveredNode = null;
  }

  renderer.domElement.style.cursor = orbit.enabled ? "grab" : "default";
}

// -----------------------------
// Node hover / raycast
// -----------------------------
function raycastNodes(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  mouseNDC.set(x, y);

  raycaster.setFromCamera(mouseNDC, dollCamera);
  const hits = raycaster.intersectObjects(activeNodeMeshes, true);
  return hits?.[0]?.object || null;
}

function updateNodeHover(dt) {
  const speed = 10;
  const activeSet = new Set(activeNodeMeshes || []);

  for (const [mesh, s] of nodeHoverState.entries()) {
    // Only animate nodes that are in the currently active dollhouse model.
    // Cached nodes from other models should be forced back to base state.
    const isActive = activeSet.has(mesh);
    if (!isActive) {
      s.target = 0;
    }

    s.hover += (s.target - s.hover) * Math.min(1, dt * speed);

    // apply visual
    if (mesh.material && mesh.material.isMeshStandardMaterial) {
      mesh.material.color.copy(NODE_BASE_COLOR).lerp(NODE_HOVER_COLOR, s.hover);
      mesh.material.emissive.copy(NODE_BASE_EMISSIVE).lerp(NODE_HOVER_EMISSIVE, s.hover);
      mesh.material.emissiveIntensity =
        NODE_BASE_EMISSIVE_INT +
        (NODE_HOVER_EMISSIVE_INT - NODE_BASE_EMISSIVE_INT) * s.hover;
      mesh.material.needsUpdate = true;
    }

    // scale
    const scaleUp = 1 + NODE_HOVER_SCALE * s.hover;
    mesh.scale.copy(s.baseScale).multiplyScalar(scaleUp);
  }
}

// -----------------------------
// Zoom toward node then enter pano
// -----------------------------
let nodeZoomToken = 0;
let isNodeZooming = false;

function smoothstep01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

function zoomTowardNode(
  mesh,
  durationMs = 320,
  distanceFactor = 0.55,
  targetBlend = 0.65,
  { triggerAt = 0.7, onTrigger = null } = {}
) {
  nodeZoomToken++;
  const token = nodeZoomToken;

  isNodeZooming = true;
  const prevOrbitEnabled = orbit.enabled;
  orbit.enabled = false;

  const nodeWorld = new THREE.Vector3();
  mesh.getWorldPosition(nodeWorld);

  const startPos = dollCamera.position.clone();
  const startTarget = orbit.target.clone();

  const camDir = startPos.clone().sub(startTarget);
  const startDist = camDir.length();
  if (startDist < 1e-6) camDir.set(1, 0, 0);
  else camDir.normalize();

  const endTarget = startTarget.clone().lerp(nodeWorld, targetBlend);
  const endDist = Math.max(0.15, startDist * distanceFactor);
  const endPos = endTarget.clone().add(camDir.multiplyScalar(endDist));

  const start = performance.now();

  let triggered = false;
  const fireTrigger = async () => {
    if (triggered) return;
    triggered = true;
    if (typeof onTrigger === "function") {
      try {
        await onTrigger();
      } catch (err) {
        console.error("zoomTowardNode onTrigger error:", err);
      }
    }
  };

  return new Promise((resolve) => {
    function tick() {
      if (token !== nodeZoomToken) {
        isNodeZooming = false;
        orbit.enabled = prevOrbitEnabled && mode === "dollhouse";
        resolve(false);
        return;
      }

      const uRaw = (performance.now() - start) / durationMs;
      const u = Math.min(1, Math.max(0, uRaw));
      const e = smoothstep01(u);

      if (!triggered && u >= triggerAt) fireTrigger();

      orbit.target.lerpVectors(startTarget, endTarget, e);
      dollCamera.position.lerpVectors(startPos, endPos, e);

      dollCamera.updateProjectionMatrix();
      orbit.update();

      if (u >= 1) {
        isNodeZooming = false;
        orbit.enabled = prevOrbitEnabled && mode === "dollhouse";
        resolve(true);
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
}

// Hover + click handlers
renderer.domElement.addEventListener("pointermove", (e) => {
  if (mode !== "dollhouse") return;
  if (isNodeZooming) return;

  const hit = raycastNodes(e);

  if (hoveredNode !== hit) {
    if (hoveredNode) {
      const s0 = nodeHoverState.get(hoveredNode);
      if (s0) s0.target = 0;
    }

    hoveredNode = hit;

    if (hoveredNode) {
      const s1 = nodeHoverState.get(hoveredNode);
      if (s1) s1.target = 1;
      renderer.domElement.style.cursor = "pointer";

      const idx = hoveredNode.userData?.panoIndex;
      if (idx != null) showRoomLabelText(getRoomLabelForIndex(idx));
    } else {
      renderer.domElement.style.cursor = orbit.enabled ? "grab" : "default";
      hideRoomLabelText();
    }
  }
});

renderer.domElement.addEventListener(
  "pointerdown",
  async (e) => {
    if (mode !== "dollhouse") return;
    if (isNodeZooming) return;

    const hit = raycastNodes(e);
    if (!hit) return;

    e.preventDefault();
    e.stopPropagation();

    const panoIndex = hit.userData.panoIndex;
    if (panoIndex == null) return;

    if (hoveredNode) {
      const s = nodeHoverState.get(hoveredNode);
      if (s) s.target = 0;
      hoveredNode = null;
    }
    renderer.domElement.style.cursor = "default";
    hideRoomLabelText();

    const ok = await zoomTowardNode(hit, 500, 0.25, 0.85, {
      triggerAt: 0.6,
      onTrigger: () => jumpToPano(panoIndex),
    });
    if (!ok) return;
  },
  { passive: false }
);

// -----------------------------
// “You are here” sync
// -----------------------------
function findNodeInEntry(entry, panoIndex) {
  if (!entry?.nodes?.length) return null;
  return entry.nodes.find((m) => m?.userData?.panoIndex === panoIndex) || null;
}
function syncYouAreHereToCurrentPano() {
  if (mode !== "dollhouse") {
    hideYouAreHere();
    return;
  }
  const entry = dollCache.get(activeDollKey);
  if (!entry) {
    hideYouAreHere();
    return;
  }
  const node = findNodeInEntry(entry, state.index);
  placeYouAreHereAboveNodeMesh(node);
}

// -----------------------------
// Dollhouse model switcher
// -----------------------------
let switching = false;

async function switchDollhouseModel(key) {
  if (switching) return;
  if (activeDollKey === key && activeDollRoot) return;

  switching = true;
  const prevKey = activeDollKey;
  const prevRoot = activeDollRoot;
  setDollButtonsActive(key);

  const view = saveOrbitView();

  try {
    await ensureReferenceReady();

    const root = await loadDollModel(key);
    alignModelToReference(key);

    activeDollKey = key;
    const useBidirectionalWipeUp =
      mode === "dollhouse" &&
      ((prevKey === "down" && (key === "up" || key === "full")) ||
        (prevKey === "full" && key === "up")) &&
      !!prevRoot &&
      prevRoot !== root;
    const useBidirectionalWipeDown =
      mode === "dollhouse" &&
      ((prevKey === "up" && (key === "down" || key === "full")) ||
        (prevKey === "full" && key === "down")) &&
      !!prevRoot &&
      prevRoot !== root;

    if (useBidirectionalWipeUp || useBidirectionalWipeDown) {
      if (root.parent !== dollScene) dollScene.add(root);

      applyOrbitViewWithLockedPivot(view);
      applyReferenceClippingAndLimits();
      if (useBidirectionalWipeUp) {
        await playDollhouseSwapWipeUp(root, prevRoot, DOLL_WIPE_SWITCH_MS);
      } else {
        await playDollhouseSwapWipeDown(root, prevRoot, DOLL_WIPE_SWITCH_MS);
      }

      dollScene.remove(prevRoot);
      setActiveDollRoot(root);
    } else {
      setActiveDollRoot(root);

      applyOrbitViewWithLockedPivot(view);
      applyReferenceClippingAndLimits();
      if (mode === "dollhouse") {
        await playDollhouseBottomUpWipe(root, DOLL_WIPE_SWITCH_MS);
      }
    }
  } catch (e) {
    console.error(`Failed to load dollhouse model "${key}"`, e);
    setDollButtonsActive(activeDollKey);
  } finally {
    switching = false;
  }
}

if (btnFull) {
  btnFull.addEventListener("click", () => {
    if (btnFull.classList.contains("active")) return;
    switchDollhouseModel("full");
  });
}
if (btnUp) {
  btnUp.addEventListener("click", () => {
    if (btnUp.classList.contains("active")) return;
    switchDollhouseModel("up");
  });
}
if (btnDown) {
  btnDown.addEventListener("click", () => {
    if (btnDown.classList.contains("active")) return;
    switchDollhouseModel("down");
  });
}

// -----------------------------
// Dollhouse enter flow (safe) — with double-fade prevention
// -----------------------------
let dollhouseEnterToken = 0;
let hasShownInitialDollhouseLoader = false;
const DOLLHOUSE_FIRST_LOADER_MIN_VISIBLE_MS = 1000;

if (tabDollhouse) {
  tabDollhouse.addEventListener("click", async () => {
    if (mode === "dollhouse" || tabDollhouse.classList.contains("active")) return;
    dollhouseEnterToken++;
    const token = dollhouseEnterToken;
    const stillValid = () => token === dollhouseEnterToken;

    const comingFromPano = mode === "pano";
    let pm = null;

    // ✅ Prevent “reveal twice” (reset branch reveals early)
    let revealedEarly = false;

    try {
      // 1) Fade to black if leaving pano
      // IMPORTANT: keep the overlay truly opaque before we switch scenes,
      // and also blank the pano sphere so even if anything renders for 1 frame
      // it will be black (prevents the “1-frame full pano flash”)
      if (comingFromPano) {
        // Cancel any in-flight fade animations
        fadeToken++;

        // Ensure we start fading from the *current* opacity (don’t hard-set to 0)
        await fadeOverlayTo(1, 160);
        fadeOverlay.style.opacity = "1"; // hard guarantee
        if (!stillValid()) return;

        // Kill pano visuals while we’re black (prevents carry-over flashes)
        blankPanoSphere();

        // Give the renderer one frame to present the black state before switching
        await new Promise((r) => requestAnimationFrame(r));
      }

      // 2) When entering dollhouse from pano, request reset-style behavior
      if (comingFromPano) needsDollReset = true;

      // 3) Switch mode
      setMode("dollhouse");

      // 4) Loader (only first entry)
      const shouldShowLoader = !hasShownInitialDollhouseLoader;
      const isFirstEntryIntoDollhouse = shouldShowLoader;
      let tRef = null;
      let tModel = null;

      if (shouldShowLoader) {
        pm = beginProgressSession("Loading dollhouse…", {
          position: "center",
          variant: "chrome",
          minVisibleMs: DOLLHOUSE_FIRST_LOADER_MIN_VISIBLE_MS,
        });
        tRef = pm.task("reference", 2.0);
        tModel = pm.task("model", 3.0);
      }

      // 5) Hard guarantee black while loading
      fadeOverlay.style.opacity = "1";
      if (!stillValid()) {
        pm?.cancel?.();
        return;
      }

      // 6) Prefer DOWN as initial model on first ever entry
      if (!hasShownInitialDollhouseLoader && !activeDollRoot) {
        activeDollKey = "down";
        setDollButtonsActive(activeDollKey);
      }

      setDollButtonsActive(activeDollKey);

      // 7) Ensure reference (refCenter/bounds/limits)
      await ensureReferenceReady();
      tRef?.done?.();
      if (!stillValid()) {
        pm?.cancel?.();
        return;
      }

      // 8) Ensure active model is loaded
      const root = await loadDollModel(
        activeDollKey,
        tModel ? (p) => tModel.update(p) : null
      );
      tModel?.done?.();
      if (!stillValid()) {
        pm?.cancel?.();
        return;
      }

      alignModelToReference(activeDollKey);
      if (isFirstEntryIntoDollhouse) setYouAreHereSuppressed(true);
      setActiveDollRoot(root);

      // 9) Ensure we have a default view (first entry)
      if (!framedOnce) {
        framedOnce = true;

        // Default view priority: tour.json -> localStorage -> frame full
        if (!defaultDollView) defaultDollView = loadSavedDefaultDollView();

        if (!defaultDollView) {
          // Frame FULL, then save
          await loadDollModel("full").catch(() => {});
          const fullEntry = dollCache.get("full");

          if (fullEntry?.root) {
            frameCameraToObject(dollCamera, orbit, fullEntry.root, 0.7);
            applyReferenceClippingAndLimits();
            defaultDollView = saveOrbitView();

            if (isAdminMode()) {
              try {
                localStorage.setItem(
                  DOLL_DEFAULT_VIEW_STORAGE_KEY,
                  JSON.stringify(serializeOrbitView(defaultDollView))
                );
              } catch {}
            }
          } else {
            // Fallback: whatever we currently have
            defaultDollView = saveOrbitView();
          }
        }
      }

      // 10) Apply the correct entry behavior
      // If we're coming from pano (including the very first time ever entering dollhouse),
      // we want the reset animation (node-zoom + yaw match -> zoom out to default).
      // On FIRST entry, keep a short safety black screen so no wrong-rotation frame ever flashes.

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      if ((comingFromPano || needsDollReset) && defaultDollView) {
        needsDollReset = false;

        if (isFirstEntryIntoDollhouse) {
          // ✅ FIRST ENTRY SAFETY NET:
          // - keep BLACK while loader completes
          // - add a tiny extra hold so the GPU/scene settles
          // - start the reset while still black
          // - then reveal so the animation is always correct/clean

          // Ensure the loader is fully done BEFORE any reveal/anim
          if (pm) {
            hasShownInitialDollhouseLoader = true;
            await pm.finish();
            pm = null;
          }

          // Extra black hold to prevent a 1-frame wrong rotation flash
          await sleep(150);

          // Start reset while still black, but WAIT until the start pose is prepared
          // before revealing to avoid any wrong-frame flash.
          let preparedResolve;
          const prepared = new Promise((r) => (preparedResolve = r));
          let firstRevealWipePromise = null;

          const resetPromise = resetDollhouseFromCurrentPano(true, {
            allowFullSpin: false,
            onPrepared: () => preparedResolve && preparedResolve(),
            onSpinStart: () => {
              if (firstRevealWipePromise) return;
              if (hasPlayedInitialDollhouseWipe) return;
              if (!activeDollRoot || mode !== "dollhouse") return;

              firstRevealWipePromise = playDollhouseBottomUpWipe(
                activeDollRoot,
                DOLL_WIPE_FIRST_REVEAL_MS
              )
                .then(() => {
                  if (mode === "dollhouse") hasPlayedInitialDollhouseWipe = true;
                })
                .catch((e) => {
                  console.warn("First dollhouse wipe failed:", e);
                });
            },
          });

          // ✅ Keep overlay black until we are in the correct START pose
          await prepared;

          // Now reveal so the user sees the zoom/rotate out animation
          // Start from fully black, then fade in (prevents 1-frame snap)
          revealedEarly = true;
          fadeOverlay.style.opacity = "1";
          await new Promise((r) => requestAnimationFrame(r));
          await fadeOverlayTo(0, 240);
          fadeOverlay.style.opacity = "0";

          await resetPromise;
          if (suppressYouAreHereUntilRelease) {
            setYouAreHereSuppressed(false, { fadeIn: true });
          }
          if (firstRevealWipePromise) await firstRevealWipePromise;
          applyReferenceClippingAndLimits();
        } else {
          // Returning from pano (normal): start reset while black,
          // but reveal only after the start pose is prepared to avoid wrong-frame flash.
          let preparedResolve;
          const prepared = new Promise((r) => (preparedResolve = r));

          const resetPromise = resetDollhouseFromCurrentPano(true, {
            onPrepared: () => preparedResolve && preparedResolve(),
          });

          // ✅ Keep overlay black until we are in the correct START pose
          await prepared;

          // Now reveal so the user sees the zoom/rotate out animation
          // Start from fully black, then fade in (prevents 1-frame snap)
          revealedEarly = true;
          fadeOverlay.style.opacity = "1";
          await new Promise((r) => requestAnimationFrame(r));
          await fadeOverlayTo(0, 240);
          fadeOverlay.style.opacity = "0";

          await resetPromise;
          applyReferenceClippingAndLimits();
        }
      } else if (defaultDollView) {
        applyOrbitViewWithLockedPivot(defaultDollView);
        applyReferenceClippingAndLimits();
      }

      // 11) Reveal (only if we didn’t already reveal during reset)
      // Always fade-in the start of dollhouse view (small, clean reveal)
      if (!revealedEarly) {
        fadeOverlay.style.opacity = "1";
        await new Promise((r) => requestAnimationFrame(r));
        await fadeOverlayTo(0, 240);
        fadeOverlay.style.opacity = "0";
      } else {
        // extra hard guarantee
        fadeOverlay.style.opacity = "0";
      }

      if (isFirstEntryIntoDollhouse && suppressYouAreHereUntilRelease) {
        setYouAreHereSuppressed(false, { fadeIn: true });
      }

// Reveal dollhouse UI only after the model is visible
revealDollUIWhenReady();

      // 12) Finish loader (if it wasn't already finished in the first-entry safety net)
      if (pm) {
        hasShownInitialDollhouseLoader = true;
        pm.finish();
      }
    } catch (e) {
      console.error("Failed to load dollhouse:", e);
      if (pm) pm.cancel();
      setYouAreHereSuppressed(false);

      // Never leave user black
      try {
        fadeOverlay.style.opacity = "1";
        await new Promise((r) => requestAnimationFrame(r));
        await fadeOverlayTo(0, 180);
        fadeOverlay.style.opacity = "0";
      } catch {}
    }
  });
}

// -----------------------------
// Preload start assets
// -----------------------------
let __preloadStartAssetsPromise = null;
const yieldToBrowser = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function preloadStartAssets() {
  if (__preloadStartAssetsPromise) return __preloadStartAssetsPromise;

  __preloadStartAssetsPromise = (async () => {
    await ensurePanoLoaded(0).catch(() => {});
    await yieldToBrowser(0);

    // Priority: down
    await loadDollModel("down").catch(() => {});
    await ensureReferenceReady().catch(() => {});
    await yieldToBrowser(0);

    loadDollModel("full").catch(() => {});
    loadDollModel("up").catch(() => {});

    ensurePanoLoaded(1).catch(() => {});
    if (PANOS.length > 1) loadVideoSrc(transitionPathForward(0)).catch(() => {});

    await yieldToBrowser(50);
  })();

  return __preloadStartAssetsPromise;
}

// -----------------------------
// Hotkeys
// -----------------------------
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (IS_LOCAL_DEV && key === "s") {
    const overlayVisible = !!startOverlay && !startOverlay.classList.contains("hidden");
    if (overlayVisible && startBtn && !startBtn.disabled) {
      e.preventDefault();
      skipIntroOnNextBegin = true;
      startBtn.click();
      return;
    }
  }

  if (key === "h" && mode === "pano") {
    console.log(
      `HERO[${state.index}] = { yaw: ${yaw.toFixed(6)}, pitch: ${pitch.toFixed(6)} };`
    );
  }
});

// -----------------------------
// Resize
// -----------------------------
function resizeRenderer() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;

  panoCamera.aspect = w / h;
  panoCamera.updateProjectionMatrix();

  dollCamera.aspect = w / h;
  dollCamera.updateProjectionMatrix();

  renderer.setSize(w, h);
  if (refReady) applyReferenceClippingAndLimits();
}
function handleViewportResize() {
  applyPlayerScale();
  resizeRenderer();
}
window.addEventListener("resize", handleViewportResize);
if (playerShell) {
  new ResizeObserver(() => handleViewportResize()).observe(playerShell);
} else {
  new ResizeObserver(() => handleViewportResize()).observe(container);
}

// -----------------------------
// Init
// -----------------------------
async function init() {
  setUIEnabled(false);
  setMode("pano");
  showStartOverlay();
  // Hide all tour UI until intro finishes
  setUIEnabled(false);
  if (navWrap) navWrap.classList.add("hidden");
  if (dollBtns) dollBtns.classList.add("hidden");
  if (tabPano) tabPano.style.display = "none";
  if (tabDollhouse) tabDollhouse.style.display = "none";
  hideBrandUIHard();

  blankPanoSphere();

  await loadTourConfig();

  // Build PANOS
  PANOS = Array.from({ length: TOUR.panoCount }, (_, i) => TOUR_BASE + applyPanoPattern(TOUR.panoPattern, i + 1));
  HERO = Array.isArray(TOUR.hero) ? TOUR.hero : [];
  ROOMS = Array.isArray(TOUR.rooms) ? TOUR.rooms : [];

  // cache size
  state.panoTextures = new Array(PANOS.length).fill(null);

  // Models
  DOLLHOUSE_GLB_FULL = TOUR_BASE + TOUR.models.full;
  DOLLHOUSE_GLB_UP = TOUR_BASE + TOUR.models.up;
  DOLLHOUSE_GLB_DOWN = TOUR_BASE + TOUR.models.down;

  // Optional yaw
  DOLL_HOME_YAW_DEG = TOUR.dollHomeYawDeg ?? -90;
  DOLL_HOME_YAW_OFFSET = THREE.MathUtils.degToRad(DOLL_HOME_YAW_DEG);

  // Default doll view from tour.json wins
  if (
    TOUR.dollDefaultView &&
    TOUR.dollDefaultView.camPos &&
    TOUR.dollDefaultView.camQuat &&
    TOUR.dollDefaultView.target
  ) {
    try {
      defaultDollView = {
        camPos: new THREE.Vector3().fromArray(TOUR.dollDefaultView.camPos),
        camQuat: new THREE.Quaternion(
          TOUR.dollDefaultView.camQuat[0],
          TOUR.dollDefaultView.camQuat[1],
          TOUR.dollDefaultView.camQuat[2],
          TOUR.dollDefaultView.camQuat[3]
        ),
        target: new THREE.Vector3().fromArray(TOUR.dollDefaultView.target),
        zoom: TOUR.dollDefaultView.zoom ?? 1,
      };
    } catch (e) {
      console.warn("Invalid TOUR.dollDefaultView, ignoring:", e);
      defaultDollView = null;
    }
  }

  // Start button
  if (startBtn) {
    startBtn.disabled = false;

    const BEGIN_SKIP_MULTI_CLICK_COUNT = 3;
    const BEGIN_SKIP_MULTI_CLICK_WINDOW_MS = 420;

    let beginClickCount = 0;
    let beginClickTimer = null;
    let beginLaunchInProgress = false;

    const resetQueuedBegin = () => {
      beginClickCount = 0;
      if (beginClickTimer) {
        clearTimeout(beginClickTimer);
        beginClickTimer = null;
      }
    };

    const runBeginFlow = async ({ skipIntroViaClicks = false } = {}) => {
      if (beginLaunchInProgress) return;
      beginLaunchInProgress = true;
      resetQueuedBegin();

      const skipIntro = skipIntroOnNextBegin || skipIntroViaClicks;
      skipIntroOnNextBegin = false;
      startBtn.disabled = true;

      // Hard-hide brand UI during begin -> intro to prevent any flicker
      hideBrandUIHard();
      if (startCard) startCard.classList.add("hidden");
      if (!skipIntro && startOverlay) startOverlay.classList.add("videoMode");

      const preloadPromise = preloadStartAssets().catch((e) => {
        console.warn("Preload assets failed (continuing):", e);
      });

      let pm = null;
      let pmTimer = null;

      try {
        if (!skipIntro) {
          await playIntroVideoOnce().catch((e) => {
            console.warn("Intro video failed (continuing):", e);
          });
        } else if (introVideoEl) {
          introVideoEl.pause();
          introVideoEl.classList.remove("show");
          introVideoEl.removeAttribute("src");
        }

        // Only show the loading overlay if the first pano actually takes a moment to load.
        // This prevents a 1-frame flash of the loading bar in the black frame right after the intro.
        pmTimer = setTimeout(() => {
          pm = beginProgressSession("Loading tour…");
        }, 220);

        const first = await ensurePanoLoaded(0, (p) => {
          if (!pm) return;
          const t = pm.__panoTask || (pm.__panoTask = pm.task("pano0", 4.0));
          t.update(p);
        });

        if (pm && pm.__panoTask) pm.__panoTask.done();
        setSphereMap(first);

        clearTimeout(pmTimer);
        pm?.finish?.();

        yaw = HERO[0]?.yaw ?? 0;
        pitch = HERO[0]?.pitch ?? 0;
        targetYaw = yaw;
        targetPitch = pitch;
        applyYawPitch();

        state.index = 0;
        updateIndicator(0);
        preloadNearby(0);

        setUIEnabled(true);
        // Fade pano UI in only after the first pano is actually visible.
        revealPanoUIWhenReady();

        requestAnimationFrame(() => fadeInPano(450, skipIntro ? "black" : "white"));
        if (startOverlay) startOverlay.classList.remove("videoMode");
        hideStartOverlay();

        // Reveal tour UI only AFTER intro video completes.
        if (tabPano) tabPano.style.display = "";
        if (tabDollhouse) tabDollhouse.style.display = "";
        // Now that the intro is finished, allow the brand UI to appear (no flicker).
        showBrandUIHard();
        // Start the 10s logo -> text swap only after the brand UI is visible.
        startBrandSwapTimer(10000);
        // One more guard to ensure no 1-frame flash during the overlay removal.
        __afterNextPaint(() => {
          showBrandUIHard();
          startBrandSwapTimer(10000);
        });

        preloadPromise.then(() => console.log("✅ background preload complete"));
      } catch (e) {
        console.error("Begin tour failed:", e);
        if (pmTimer) clearTimeout(pmTimer);
        pm?.cancel?.();

        if (startOverlay) startOverlay.classList.remove("videoMode");
        if (startCard) startCard.classList.remove("hidden");
        showStartOverlay();

        startBtn.disabled = false;
        beginLaunchInProgress = false;
        if (introVideoEl) introVideoEl.classList.remove("show");
      }
    };

    startBtn.addEventListener("click", () => {
      if (beginLaunchInProgress || startBtn.disabled) return;

      beginClickCount += 1;

      // Keep local-dev "S" skip immediate.
      if (skipIntroOnNextBegin) {
        runBeginFlow({ skipIntroViaClicks: false });
        return;
      }

      if (beginClickCount >= BEGIN_SKIP_MULTI_CLICK_COUNT) {
        runBeginFlow({ skipIntroViaClicks: true });
        return;
      }

      if (beginClickTimer) return;

      beginClickTimer = setTimeout(() => {
        runBeginFlow({
          skipIntroViaClicks: beginClickCount >= BEGIN_SKIP_MULTI_CLICK_COUNT,
        });
      }, BEGIN_SKIP_MULTI_CLICK_WINDOW_MS);
    });
  }

  handleViewportResize();
  applyRenderLookForMode("pano");
}

// -----------------------------
// Render loop
// -----------------------------
let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  applyRenderLookForMode(mode);

  if (mode === "dollhouse") {
    orbit.update();
    updateNodeHover(dt);
    updateYouAreHere(dt, now / 1000);
    renderer.render(dollScene, dollCamera);
  } else {
    renderer.render(panoScene, panoCamera);
  }
}

animate();
init();
