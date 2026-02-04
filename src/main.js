import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const container = document.getElementById("app");
const navWrap = document.getElementById("navWrap");
const indicator = document.getElementById("indicator");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
// -----------------------------
// Brand link UI (top-right)
// -----------------------------
const brandLink = document.getElementById("brandLink");
const brandLogo = document.getElementById("brandLogo");
const brandText = document.getElementById("brandText");
let brandSwapTimer = null;
// -----------------------------
// Room label UI (bottom-left)
// -----------------------------
const roomLabelEl = document.createElement("div");
roomLabelEl.id = "roomLabel";
roomLabelEl.style.position = "absolute";
roomLabelEl.style.left = "16px";
roomLabelEl.style.bottom = "16px";
roomLabelEl.style.padding = "10px 12px";
roomLabelEl.style.borderRadius = "10px";
roomLabelEl.style.background = "rgba(0,0,0,0.55)";
roomLabelEl.style.backdropFilter = "blur(6px)";
roomLabelEl.style.color = "#fff";
roomLabelEl.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
roomLabelEl.style.fontSize = "13px";
roomLabelEl.style.fontWeight = "600";
roomLabelEl.style.letterSpacing = "0.4px";
roomLabelEl.style.textTransform = "uppercase";
roomLabelEl.style.zIndex = "20";
roomLabelEl.style.pointerEvents = "none";
roomLabelEl.style.userSelect = "none";
roomLabelEl.style.opacity = "0"; // start hidden until we set text

container.appendChild(roomLabelEl);
function startBrandSwapTimer(delayMs = 10000) {
  // If the elements aren't present, do nothing
  if (!brandLogo || !brandText) return;

  // Clear any previous timer (safety)
  if (brandSwapTimer) {
    clearTimeout(brandSwapTimer);
    brandSwapTimer = null;
  }

  // Start in "logo mode"
  brandLogo.classList.remove("hidden");
  brandText.classList.add("hidden");

  brandSwapTimer = setTimeout(() => {
    // Switch to "text mode"
    brandLogo.classList.add("hidden");
    brandText.classList.remove("hidden");
  }, delayMs);
}

const tabPano = document.getElementById("tabPano");
const tabDollhouse = document.getElementById("tabDollhouse");
// -----------------------------
// Begin Tour UI (from index.html)
// -----------------------------
const startOverlay = document.getElementById("startOverlay");
const startCard = document.getElementById("startCard");
const startBtn = document.getElementById("startBtn");
const introVideoEl = document.getElementById("introVideo");
// -----------------------------
// TOUR CONFIG (loads /tours/<id>/tour.json)
// -----------------------------
function getTourId() {
  const params = new URLSearchParams(location.search);
  return params.get("tour") || "prod_demo_house_01";
}

function getApiBase() {
  const params = new URLSearchParams(location.search);
  return (
    params.get("api") ||
    "https://rtf-player-api.fionnmaguire.workers.dev"
  ).replace(/\/$/, "");
}

function isAdminMode() {
  const params = new URLSearchParams(location.search);
  return params.get("admin") === "1";
}

let TOUR = null;
let TOUR_BASE = "";

function pad(n, len) {
  return String(n).padStart(len, "0");
}

// Replace "{0000}" with a 4-digit number
function applyPanoPattern(pattern, i1) {
  return pattern.replace("{0000}", pad(i1, 4));
}

// Replace two "{00}" placeholders (a then b)
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
// Intro video (inside tour folder)
// -----------------------------
function getIntroVideoUrl() {
  // Use MP4 if you convert it (recommended), fallback to mov if not
  // Put the file inside: /tours/<tourId>/intro.mp4 (or intro.mov)
  const mp4 = `${TOUR_BASE}intro/intro.mp4`;
  const mov = `${TOUR_BASE}intro/intro.mov`;

  // If you haven't converted yet, leave as mov by returning mov.
  // If you DO convert, change this to return mp4 only.
  return mp4; // <-- recommended path
  // return mov; // <-- use this if you keep intro.mov
}

function showStartOverlay() {
  if (!startOverlay) return;
  startOverlay.classList.remove("hidden");
}

function hideStartOverlay() {
  if (!startOverlay) return;
  startOverlay.classList.add("hidden");
}

async function playIntroVideoOnce() {
  if (!introVideoEl) return;

  // Make sure the overlay doesn’t dim/blur while video is showing
  if (startOverlay) startOverlay.classList.add("videoMode");

  // Make sure the video element is configured for iOS/Safari
  // Allow sound for intro (user-initiated click)
introVideoEl.muted = false;
introVideoEl.volume = 1.0; // adjust if needed (0.0 – 1.0)
  introVideoEl.playsInline = true;
  introVideoEl.autoplay = true;

  // Set src and load
  introVideoEl.src = getIntroVideoUrl();
  introVideoEl.load();

  // Show the video layer immediately (opacity animates in via CSS)
  introVideoEl.classList.add("show");

  // Wait until the browser has enough data to paint the first frame
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

  // Now play (this should succeed because it is called from the Begin button click)
  try {
    await introVideoEl.play();
  } catch (e) {
    console.warn("Intro video play failed:", e);

    // If it fails, remove videoMode so overlay returns to normal,
    // and hide the video layer so you don't get a stuck black screen.
    if (startOverlay) startOverlay.classList.remove("videoMode");
    introVideoEl.classList.remove("show");
    return;
  }

  // Wait for end
  await new Promise((resolve) => {
    introVideoEl.addEventListener("ended", resolve, { once: true });
  });

  // Hide video layer
  introVideoEl.pause();
  introVideoEl.classList.remove("show");

  // Return overlay to normal mode (you can also hideStartOverlay right after this)
  if (startOverlay) startOverlay.classList.remove("videoMode");
}
// -----------------------------
// Loading overlay (progress bar)
// -----------------------------
const loadingOverlay = document.createElement("div");
loadingOverlay.id = "loadingOverlay";
loadingOverlay.style.position = "absolute";
loadingOverlay.style.left = "0";
loadingOverlay.style.top = "0";
loadingOverlay.style.width = "100%";
loadingOverlay.style.height = "100%";
loadingOverlay.style.display = "none";

// ✅ bottom-middle placement
loadingOverlay.style.alignItems = "flex-end";
loadingOverlay.style.justifyContent = "center";

// keep it above the very bottom UI
loadingOverlay.style.paddingBottom = "78px"; // tweak (60–100px) to taste
loadingOverlay.style.boxSizing = "border-box";
loadingOverlay.style.pointerEvents = "none";
loadingOverlay.style.zIndex = "30"; // above fadeOverlay (10) and UI

const loadingCard = document.createElement("div");
loadingCard.style.minWidth = "260px";
loadingCard.style.maxWidth = "420px";
loadingCard.style.width = "42%";
loadingCard.style.padding = "14px 14px 12px";
loadingCard.style.borderRadius = "12px";
loadingCard.style.background = "rgba(0,0,0,0.65)";
loadingCard.style.backdropFilter = "blur(8px)";
loadingCard.style.border = "1px solid rgba(255,255,255,0.10)";
loadingCard.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";

const loadingText = document.createElement("div");
loadingText.style.color = "rgba(255,255,255,0.92)";
loadingText.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
loadingText.style.fontSize = "12px";
loadingText.style.fontWeight = "600";
loadingText.style.letterSpacing = "0.4px";
loadingText.style.textTransform = "uppercase";
loadingText.style.marginBottom = "10px";
loadingText.textContent = "Loading…";

const loadingBarOuter = document.createElement("div");
loadingBarOuter.style.width = "100%";
loadingBarOuter.style.height = "8px";
loadingBarOuter.style.borderRadius = "999px";
loadingBarOuter.style.background = "rgba(255,255,255,0.14)";
loadingBarOuter.style.overflow = "hidden";

const loadingBarInner = document.createElement("div");
loadingBarInner.style.width = "0%";
loadingBarInner.style.height = "100%";
loadingBarInner.style.borderRadius = "999px";
loadingBarInner.style.background = "rgba(255,255,255,0.92)";
loadingBarInner.style.transition = "width 120ms ease";

const loadingPct = document.createElement("div");
loadingPct.style.color = "rgba(255,255,255,0.75)";
loadingPct.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
loadingPct.style.fontSize = "12px";
loadingPct.style.fontWeight = "600";
loadingPct.style.marginTop = "10px";
loadingPct.style.textAlign = "right";
loadingPct.textContent = "0%";

loadingBarOuter.appendChild(loadingBarInner);
loadingCard.appendChild(loadingText);
loadingCard.appendChild(loadingBarOuter);
loadingCard.appendChild(loadingPct);
loadingOverlay.appendChild(loadingCard);
container.appendChild(loadingOverlay);

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

// Weighted progress aggregator so multiple assets contribute to one bar.
// Usage:
//   const pm = beginProgressSession("Loading dollhouse…");
//   const t1 = pm.task("Pano", 1);
//   t1.update(0.4); ... t1.done();
//   pm.finish();
function beginProgressSession(label = "Loading…") {
  let active = true;
  setLoadingVisible(true, label);

  const tasks = new Map(); // id -> { weight, p }

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
    active = false;
    setLoadingProgress(1);
    setTimeout(() => setLoadingVisible(false), 180);
  };

  const cancel = () => {
    active = false;
    setLoadingVisible(false);
  };

  return { task, finish, cancel };
}
// -----------------------------
// Crossfade overlay (pano <-> dollhouse)
// -----------------------------
const fadeOverlay = document.createElement("div");
fadeOverlay.id = "fadeOverlay";
fadeOverlay.style.position = "absolute";
fadeOverlay.style.left = "0";
fadeOverlay.style.top = "0";
fadeOverlay.style.width = "100%";
fadeOverlay.style.height = "100%";
fadeOverlay.style.background = "#000";
fadeOverlay.style.opacity = "0";
fadeOverlay.style.pointerEvents = "none";
fadeOverlay.style.zIndex = "10"; // above canvas/UI inside container

// Ensure the container can position children absolutely
const cs = window.getComputedStyle(container);
if (cs.position === "static") container.style.position = "relative";

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
      const e = u * u * (3 - 2 * u); // smoothstep

      const v = startOpacity + (targetOpacity - startOpacity) * e;
      fadeOverlay.style.opacity = String(v);

      if (u >= 1) resolve(true);
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Dollhouse model selector UI (bottom-right)
const dollBtns = document.getElementById("dollBtns");
const btnFull = document.getElementById("btnFull");
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");

// -----------------------------
// TOUR DATA (filled from TOUR json)
// -----------------------------
let PANOS = [];
let HERO = [];
let ROOMS = [];

function transitionPathForward(fromIndex) {
  // fromIndex is 0-based
  const a = fromIndex + 1;
  const b = fromIndex + 2;
  return TOUR_BASE + applyTransitionPattern(TOUR.transitionForwardPattern, a, b);
}

function transitionPathReverse(fromIndex) {
  const a = fromIndex + 1;
  const b = fromIndex; // reverse goes down
  return TOUR_BASE + applyTransitionPattern(TOUR.transitionReversePattern, a, b);
}

// You still use pad2 for UI only:
function pad2(n) {
  return String(n).padStart(2, "0");
}

// -----------------------------
// Dollhouse GLBs
// -----------------------------
let DOLLHOUSE_GLB_FULL = "";
let DOLLHOUSE_GLB_UP = "";
let DOLLHOUSE_GLB_DOWN = "";

// -----------------------------
// Dollhouse "home" orientation (default view yaw offset)
// -----------------------------
// + = rotate home view clockwise, - = counter-clockwise
let DOLL_HOME_YAW_DEG = -90;
let DOLL_HOME_YAW_OFFSET = THREE.MathUtils.degToRad(DOLL_HOME_YAW_DEG);

// -----------------------------
// HERO VIEWS
// -----------------------------

// -----------------------------
// Renderer
// -----------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";

renderer.outputColorSpace = THREE.SRGBColorSpace;

// ✅ Separate looks per mode
const PANO_EXPOSURE = 1.0; // neutral for walkthrough
const DOLL_EXPOSURE = 1.35; // brighter for dollhouse

function applyRenderLookForMode(which) {
  if (which === "dollhouse") {
    // Dollhouse: bright + “Apple store”
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = DOLL_EXPOSURE;
  } else {
    // Interior pano: render “as-is” (no ACES / no extra exposure)
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
}

// set an initial default
applyRenderLookForMode("pano");

const NODE_BASE_COLOR = new THREE.Color(0x66ccff);   // light blue
const NODE_HOVER_COLOR = new THREE.Color(0xffffff);  // white
const NODE_BASE_EMISSIVE = new THREE.Color(0x2aa9ff); // blue glow tint
const NODE_HOVER_EMISSIVE = new THREE.Color(0xffffff);

const NODE_BASE_EMISSIVE_INT = 0.25;
const NODE_HOVER_EMISSIVE_INT = 1.8;
const NODE_HOVER_SCALE = 0.25; // keep your same scale amount

// -----------------------------
// Dollhouse nodes (raycast + hover + click)
// -----------------------------
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

let activeNodeMeshes = [];
let hoveredNode = null;

const nodeHoverState = new Map(); // mesh -> { baseScale, hover, target }

// parse NODE_01 -> pano index 0
function parseNodeIndex(name) {
  const m = /^NODE_(\d+)/i.exec(name);
  if (!m) return null;
  return parseInt(m[1], 10) - 1;
}

function styleNode(mesh) {
  // Keep it simple + consistent (doesn't depend on Blender material)
  const mat = new THREE.MeshStandardMaterial({
    color: NODE_BASE_COLOR.clone(),
    emissive: NODE_BASE_EMISSIVE.clone(),
    emissiveIntensity: NODE_BASE_EMISSIVE_INT,
    roughness: 0.25,
    metalness: 0.0,
    toneMapped: true, // keep looking good with ACES
  });

  mesh.material = mat;

  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  nodeHoverState.set(mesh, {
    baseScale: mesh.scale.clone(),
    hover: 0,
    target: 0,
  });
}

function extractNodes(root) {
  const nodes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;

    const panoIndex = parseNodeIndex(o.name);
    if (panoIndex === null) return;

    o.userData.panoIndex = panoIndex;
    styleNode(o);
    nodes.push(o);
  });
  return nodes;
}

function updateMouseNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function raycastNodes(e) {
  if (mode !== "dollhouse") return null;
  if (!activeNodeMeshes.length) return null;

  updateMouseNDC(e);
  raycaster.setFromCamera(mouseNDC, dollCamera);

  const hits = raycaster.intersectObjects(activeNodeMeshes, false);
  return hits.length ? hits[0].object : null;
}

function updateNodeHover(dt) {
  for (const [mesh, s] of nodeHoverState) {
    const target = s.target ?? 0;
    s.hover += (target - s.hover) * Math.min(1, dt * 12);

    // scale
    const scale = 1 + NODE_HOVER_SCALE * s.hover;
    mesh.scale.copy(s.baseScale).multiplyScalar(scale);

    // color + emissive blend
    const mat = mesh.material;
    if (mat && mat.isMeshStandardMaterial) {
      mat.color.copy(NODE_BASE_COLOR).lerp(NODE_HOVER_COLOR, s.hover);
      mat.emissive.copy(NODE_BASE_EMISSIVE).lerp(NODE_HOVER_EMISSIVE, s.hover);
      mat.emissiveIntensity =
        NODE_BASE_EMISSIVE_INT +
        (NODE_HOVER_EMISSIVE_INT - NODE_BASE_EMISSIVE_INT) * s.hover;

      mat.needsUpdate = false; // not required each frame
    }
  }
}

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

// Dollhouse scene/camera/controls
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

  camera.position
    .copy(center)
    .add(new THREE.Vector3(distance, distance * 0.55, distance));
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
// Mode switching (robust + transition-safe)
// -----------------------------
let mode = "pano"; // "pano" | "dollhouse"

function setTabActive(which) {
  tabPano.classList.toggle("active", which === "pano");
  tabDollhouse.classList.toggle("active", which === "dollhouse");
}

// Centralized UI restore when entering pano (prevents “dead pano” after heavy usage)
function ensurePanoUIActive() {
  // restore nav + buttons
  setUIEnabled(true);
  navWrap.classList.remove("hidden");

  // ensure pano input state is sane
  isPointerDown = false;
  autoReorienting = false;
  state.isTransitioning = false;

  // stop any transition video that might still be “owning” the sphere map
  try { transitionVideo.pause(); } catch {}
}

function setMode(which) {
  const prevMode = mode;
  const leavingPano = (prevMode === "pano" && which !== "pano");

  // ✅ If leaving pano while a transition is running, cancel it FIRST (prevents stuck UI)
  if (leavingPano && state.isTransitioning) {
    cancelActivePanoTransition("setMode leaving pano");
  }

  mode = which;

  // ✅ If user is coming from pano -> dollhouse, request reset animation
  if (prevMode === "pano" && which === "dollhouse") {
    needsDollReset = true;
  }

  setTabActive(which);

  // UI visibility
  navWrap.classList.toggle("hidden", which !== "pano");
  if (roomLabelEl) roomLabelEl.style.opacity = (which === "pano" ? roomLabelEl.style.opacity : "0");
  if (dollBtns) dollBtns.classList.toggle("hidden", which !== "dollhouse");

  // Controls
  orbit.enabled = (which === "dollhouse");

  // Render look
  applyRenderLookForMode(which);

  // If we're not in pano, ensure transition video cannot keep “driving” things
  if (which !== "pano") {
    try { transitionVideo.pause(); } catch {}
  } else {
    // ✅ entering pano: make sure UI is alive
    ensurePanoUIActive();
  }

  resizeRenderer();
}

tabPano.addEventListener("click", async () => {
  // If user clicks Pano while a transition is running, cancel it and recover cleanly
  if (state.isTransitioning) {
    cancelActivePanoTransition("tabPano click during transition");
  }

  setMode("pano");
  setRoomLabel(state.index); // ✅ restore pano label immediately when returning

  // Ensure pano texture is shown (and not left as a video texture / blank)
  blankPanoSphere();

  try {
    const tex = await ensurePanoLoaded(state.index);
    setSphereMap(tex);
    requestAnimationFrame(() => fadeInPano(220));
  } catch (e) {
    console.warn("tabPano: failed to reload pano texture:", e);
    // Still ensure UI stays usable
    ensurePanoUIActive();
  }
});
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

// -----------------------------
// Smooth reorientation helpers
// -----------------------------
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
  targetYaw = h.yaw;
  targetPitch = h.pitch;
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
  const dPitch = toPitch - fromPitch;

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

      yaw = fromYaw + dYaw * e;
      pitch = fromPitch + dPitch * e;
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
// Pano sphere (FIXED: no old pano flash, and pano not black)
// -----------------------------
const sphereGeo = new THREE.SphereGeometry(50, 64, 64);
sphereGeo.scale(-1, 1, 1);

const sphereMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,      // ✅ must be white or it will tint/multiply the pano
  transparent: true,
  opacity: 1,
});

const sphere = new THREE.Mesh(sphereGeo, sphereMat);
panoScene.add(sphere);

function setSphereMap(map) {
  sphereMat.map = map || null;

  // Optional: if no map, make it black; if map exists, ensure white
  sphereMat.color.setHex(map ? 0xffffff : 0x000000);

  sphereMat.needsUpdate = true;
}

// Blank the pano immediately so you never see the previous texture
function blankPanoSphere() {
  // cancel any in-flight fade
  panoFadeToken++;

  sphereMat.opacity = 0;   // hide instantly
  setSphereMap(null);      // remove old map so it can't flash
}

// Fade-in (with cancellation so multiple clicks don’t fight)
let panoFadeToken = 0;
function fadeInPano(duration = 450) {
  panoFadeToken++;
  const token = panoFadeToken;

  sphereMat.transparent = true;
  sphereMat.opacity = 0;

  const start = performance.now();
  const tick = () => {
    if (token !== panoFadeToken) return;

    const t = (performance.now() - start) / duration;
    const u = Math.min(1, Math.max(0, t));
    const e = u * u * (3 - 2 * u); // smoothstep

    sphereMat.opacity = e;
    if (u < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Jump directly to a pano index (0-based) from node click
async function jumpToPano(index) {
  // ✅ If a pano transition is mid-flight, kill it so pano input/UI can't get stuck
  if (state.isTransitioning) {
    cancelActivePanoTransition("jumpToPano");
  }

  setMode("pano");

  // ✅ IMPORTANT: undo any node-influenced orbit target so it can't poison the return
  if (refCenter) {
    orbit.target.copy(refCenter);
    orbit.update();
  }

  // ✅ critical: blank immediately so old pano can't flash
  blankPanoSphere();

  const tex = await ensurePanoLoaded(index);

  // set new pano
  setSphereMap(tex);

  state.index = index;
  updateIndicator(index);
  preloadNearby(index);

  yaw = HERO[index]?.yaw ?? 0;
  pitch = HERO[index]?.pitch ?? 0;
  targetYaw = yaw;
  targetPitch = pitch;
  applyYawPitch();

  // fade on next frame
  requestAnimationFrame(() => fadeInPano(450));
}

// -----------------------------
// Preload assets for smooth start (race-safe + no black-screen)
// -----------------------------

// Prevent accidental double-preload (HMR / repeated clicks)
let __preloadStartAssetsPromise = null;

// Tiny yield helper (lets browser breathe between heavy tasks)
const yieldToBrowser = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function preloadStartAssets() {
  if (__preloadStartAssetsPromise) return __preloadStartAssetsPromise;

  __preloadStartAssetsPromise = (async () => {
    // 1) Required: first pano
    await ensurePanoLoaded(0);
    await yieldToBrowser(0);

    // 2) Priority: DOWN dollhouse first (so first Dollhouse click is fast)
    const downPromise = loadDollModel("down")
      .then(async (downRoot) => {
        // Ensure reference center exists (may load FULL once)
        await ensureReferenceReady();

        // ✅ Shader compile warmup:
        // Render ONE frame in dollhouse scene WITHOUT disturbing mode/state,
        // and WITHOUT removing any root that the app might have activated.
        const prevBg = dollScene.background;
        const prevAutoClear = renderer.autoClear;

        try {
          // Force a deterministic clear (prevents “half frame then black” weirdness on some loads)
          renderer.autoClear = true;
          dollScene.background = new THREE.Color(0x000000);

          if (downRoot) {
            // Borrow only if it isn't already in a scene
            let addedByPreload = false;

            if (!downRoot.parent) {
              dollScene.add(downRoot);
              addedByPreload = true;
            }

            // IMPORTANT: render using dollScene/dollCamera, but do NOT touch `mode`
            renderer.render(dollScene, dollCamera);

            // Remove only if preload added it AND it did not become the active root
            if (
              addedByPreload &&
              downRoot !== activeDollRoot &&
              downRoot.parent === dollScene
            ) {
              dollScene.remove(downRoot);
            }
          }

          // Mark readiness (down model loaded successfully)
          dollhouseReady.down = true;
          dollhouseReady.ref = true;
        } catch (e) {
          console.warn("Preload shader-compile render skipped:", e);
        } finally {
          renderer.autoClear = prevAutoClear;
          dollScene.background = prevBg;
        }
      })
      .catch((e) => {
        console.warn("Preload: DOWN dollhouse failed:", e);
      });

    await yieldToBrowser(0);

    // 3) Secondary: FULL + UP in background (don’t block)
    loadDollModel("full")
      .then(() => {
        dollhouseReady.full = true;
        dollhouseReady.ref = true;
      })
      .catch(() => {});

    loadDollModel("up")
      .then(() => {
        dollhouseReady.up = true;
      })
      .catch(() => {});

    // 4) Optional: pano 1 preload
    ensurePanoLoaded(1).catch(() => {});

    // 5) Optional: transition metadata
    if (PANOS.length > 1) {
      loadVideoSrc(transitionPathForward(0)).catch(() => {});
    }

    // Wait for DOWN attempt to finish (so "instant dollhouse" is most likely)
    await downPromise;

    // Tiny delay so main thread breathes after parsing
    await yieldToBrowser(50);
  })();

  return __preloadStartAssetsPromise;
}
// -----------------------------
// Loading helpers
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
// UI helpers
// -----------------------------
function getRoomLabelForIndex(i) {
  const label = ROOMS?.[i];
  return typeof label === "string" && label.trim().length ? label.trim() : "";
}

function setRoomLabel(i) {
  if (!roomLabelEl) return;

  const label = getRoomLabelForIndex(i);
  roomLabelEl.textContent = label;

  // show/hide smoothly
  roomLabelEl.style.opacity = label ? "1" : "0";
}
function showRoomLabelText(text) {
  if (!roomLabelEl) return;
  const t = (text ?? "").toString().trim();
  roomLabelEl.textContent = t;
  roomLabelEl.style.opacity = t ? "1" : "0";
}

function hideRoomLabelText() {
  if (!roomLabelEl) return;
  roomLabelEl.style.opacity = "0";
}
function updateIndicator(i) {
  indicator.textContent = `${pad2(i + 1)} / ${pad2(PANOS.length)}`;
  setRoomLabel(i); // ✅ keep room label in sync anywhere indicator updates
}

function setUIEnabled(enabled) {
  backBtn.disabled = !enabled;
  forwardBtn.disabled = !enabled;
  navWrap.classList.toggle("hidden", !enabled);
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
// Node hover + click handlers (dollhouse) + zoom-then-enter
// -----------------------------
let nodeZoomToken = 0;
let isNodeZooming = false;

function smoothstep01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// Orbit-style "dolly" toward a clicked node, then resolve.
// Keeps camera angle the same (moves along current view direction),
// and shifts orbit.target partially toward the node so it feels like
// you're zooming into that point.
// Orbit-style "dolly" toward a clicked node, and optionally fire a callback
// part-way through (so pano can start fading before zoom finishes).
function zoomTowardNode(
  mesh,
  durationMs = 320,
  distanceFactor = 0.55,
  targetBlend = 0.65,
  {
    triggerAt = 0.7,          // when to fire onTrigger (0..1)
    onTrigger = null,         // async () => {}
  } = {}
) {
  nodeZoomToken++;
  const token = nodeZoomToken;

  isNodeZooming = true;
  const prevOrbitEnabled = orbit.enabled;
  orbit.enabled = false; // stop orbit fighting our animation

  const nodeWorld = new THREE.Vector3();
  mesh.getWorldPosition(nodeWorld);

  const startPos = dollCamera.position.clone();
  const startTarget = orbit.target.clone();

  // direction from target to camera (keep angle)
  const camDir = startPos.clone().sub(startTarget);
  const startDist = camDir.length();
  if (startDist < 1e-6) camDir.set(1, 0, 0);
  else camDir.normalize();

  // Move target toward node (but not all the way, so it feels natural)
  const endTarget = startTarget.clone().lerp(nodeWorld, targetBlend);

  // Dolly closer along the same direction
  const endDist = Math.max(0.15, startDist * distanceFactor);
  const endPos = endTarget.clone().add(camDir.multiplyScalar(endDist));

  const start = performance.now();

  // trigger control
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
      // cancelled by another click
      if (token !== nodeZoomToken) {
        isNodeZooming = false;
        orbit.enabled = prevOrbitEnabled && mode === "dollhouse";
        resolve(false);
        return;
      }

      const uRaw = (performance.now() - start) / durationMs;
      const u = Math.min(1, Math.max(0, uRaw));
      const e = smoothstep01(u);

      // ✅ fire early trigger (e.g. start pano fade)
      if (!triggered && u >= triggerAt) {
        // fire but don't block the zoom animation
        fireTrigger();
      }

      // interpolate target + camera
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

      // ✅ show room label while hovering in dollhouse
      const idx = hoveredNode.userData?.panoIndex;
      if (idx != null) {
        showRoomLabelText(getRoomLabelForIndex(idx));
      }
    } else {
      renderer.domElement.style.cursor = orbit.enabled ? "grab" : "default";

      // ✅ hide room label when not hovering any node (in dollhouse)
      hideRoomLabelText();
    }
  }
});

renderer.domElement.addEventListener(
  "pointerdown",
  async (e) => {
    if (mode !== "dollhouse") return;
    if (isNodeZooming) return; // ignore while zooming (or remove if you want “retarget”)

    const hit = raycastNodes(e);
    if (!hit) return;

    // prevent orbit from grabbing on node click
    e.preventDefault();
    e.stopPropagation();

    const panoIndex = hit.userData.panoIndex;
    if (panoIndex == null) return;

    // optional: clear hover state immediately
    if (hoveredNode) {
      const s = nodeHoverState.get(hoveredNode);
      if (s) s.target = 0;
      hoveredNode = null;
    }
    renderer.domElement.style.cursor = "default";
hideRoomLabelText();

    // zoom to the clicked node, then enter pano
    const ok = await zoomTowardNode(hit, 500, 0.25, 0.85, {
  triggerAt: 0.6,
  onTrigger: () => jumpToPano(panoIndex),
});
if (!ok) return;
return; // important: prevents calling jumpToPano again below
  },
  { passive: false }
);

// -----------------------------
// VideoTexture transition system
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
      toYaw: hero.yaw,
      toPitch: hero.pitch,
      durationSec: dur,
      startFrac: 0.2,
      endFrac: 1.0,
    });
  }

  // Resolve on ended/pause/error, plus a fallback timeout so nothing can hang forever.
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

    // If duration is weird or "ended" never fires, this guarantees we exit.
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

    // If we are already at the end (can happen on some seeks), finish immediately
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
// State + caching
// -----------------------------
const state = {
  index: 0,
  isTransitioning: false,
  panoTextures: [], // will be sized after PANOS is built
};
// -----------------------------
// Transition cancellation (prevents stuck UI after pause/mode switch)
// -----------------------------
let transitionCancelToken = 0;

async function cancelActivePanoTransition(reason = "cancel") {
  transitionCancelToken++;

  state.isTransitioning = false;
  autoReorienting = false;
  isPointerDown = false;

  // stop video safely
  try { transitionVideo.pause(); } catch {}
  try { transitionVideo.currentTime = 0; } catch {}

  // ✅ Restore pano texture so we don't stay stuck on the VideoTexture
  try {
    // If we are in pano, put the current pano back immediately
    if (mode === "pano") {
      const tex = await ensurePanoLoaded(state.index);
      setSphereMap(tex);
      requestAnimationFrame(() => fadeInPano(220));
      setUIEnabled(true);
    }
  } catch (e) {
    console.warn("cancelActivePanoTransition: failed to restore pano texture:", e);
    // At minimum, don't leave old frame visible
    if (mode === "pano") {
      blankPanoSphere();
      setUIEnabled(true);
    }
  }

  console.warn("🛑 Cancelled pano transition:", reason);
}

// -----------------------------
// Pano texture caching
// -----------------------------
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
// -----------------------------
// Navigation (pano) - robust + cancellable
// -----------------------------
// NOTE: transitionCancelToken + cancelActivePanoTransition() are declared ONCE
// in the "Transition cancellation" section above. Do NOT redeclare them here.

// If you need a safety cancel from the nav section, just call:
// cancelActivePanoTransition("reason");
// Optional but recommended: if the user clicks Dollhouse mid transition, cancel pano transition
// Put this inside setMode() where you switch mode (pano -> dollhouse)
// if (prevMode === "pano" && which === "dollhouse") cancelActivePanoTransition("mode switch to dollhouse");

async function goTo(targetIndex) {
  // Hard guards
  if (mode !== "pano") return;
  if (state.isTransitioning) return;
  if (targetIndex === state.index) return;
  if (targetIndex < 0 || targetIndex >= PANOS.length) return;
  if (Math.abs(targetIndex - state.index) !== 1) return;

  const from = state.index;
  const to = targetIndex;

  // ✅ Snapshot current token. DO NOT increment here.
  const myToken = transitionCancelToken;

  const stillValid = () =>
    myToken === transitionCancelToken &&
    mode === "pano";

  state.isTransitioning = true;
  setUIEnabled(false);

  // Watchdog: if something hangs, force-recover
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

    if (to === from + 1) {
      await playTransition(transitionPathForward(from), to);
    } else {
      await playTransition(transitionPathReverse(from), to);
    }
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

    // ✅ Only restore UI if we weren't cancelled
    if (stillValid()) {
      state.isTransitioning = false;
      autoReorienting = false;
      isPointerDown = false;

      if (mode === "pano") setUIEnabled(true);
    }
  }
}

forwardBtn.addEventListener("click", () => goTo(state.index + 1));
backBtn.addEventListener("click", () => goTo(state.index - 1));
// -----------------------------
// Hotkey helpers
// -----------------------------
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // === PANO ===
  if (key === "h" && mode === "pano") {
    console.log(
      `HERO[${state.index}] = { yaw: ${yaw.toFixed(
        6
      )}, pitch: ${pitch.toFixed(6)} };`
    );
  }

    // ✅ Press P in dollhouse to print a tour.json-ready default view block
if (mode === "dollhouse") {
  if (key === "p") {
    // Make sure reference pivot exists so we save the true center pivot
    if (refCenter) {
      orbit.target.copy(refCenter);
      orbit.update();
    }

    const v = saveOrbitView();

    // Force target to refCenter in the saved view (so pivot is consistent across machines)
    if (refCenter) {
      const offset = v.camPos.clone().sub(v.target);
      v.target = refCenter.clone();
      v.camPos = refCenter.clone().add(offset);
    }

    const payload = {
      dollDefaultView: {
        camPos: v.camPos.toArray(),
        camQuat: [v.camQuat.x, v.camQuat.y, v.camQuat.z, v.camQuat.w],
        target: v.target.toArray(),
        zoom: v.zoom,
      },
    };

    const json = JSON.stringify(payload, null, 2);

    console.log("===== COPY INTO tour.json =====");
    console.log(json);
    console.log("================================");

    // Optional: copy to clipboard (works on https or localhost)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => console.log("✅ Copied dollDefaultView JSON to clipboard"),
        () => console.log("ℹ️ Clipboard copy failed (copy from console)")
      );
    }
  }
}
});
// -----------------------------
// Dollhouse: multi-model loading + “act like one model” switching
// -----------------------------
const gltfLoader = new GLTFLoader();
const dollCache = new Map(); // key -> { root, center, size, alignedOnce, nodes }
let activeDollKey = "full";
let activeDollRoot = null;
// -----------------------------
// Dollhouse readiness flags (Step 2C)
// -----------------------------
const dollhouseReady = {
  down: false,
  up: false,
  full: false,
  ref: false, // reference center computed (full loaded + bounds done)
};

let refCenter = null; // Vector3 from FULL model
let refDistance = null;
let refReady = false;
let framedOnce = false;

// -----------------------------
// Dollhouse: reset view on return from pano
// -----------------------------
let defaultDollView = null;     // saved "home" orbit view
let needsDollReset = false;     // set true when switching pano -> dollhouse
// -----------------------------
// Persist default dollhouse view (hotkey save)
// -----------------------------
const DOLL_DEFAULT_VIEW_STORAGE_KEY = "doll_default_view_v1";

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

function saveDefaultDollViewNow() {
  defaultDollView = saveOrbitView();

  // ✅ Lock the saved pivot to refCenter so rotation point never changes
  if (refCenter && defaultDollView?.target && defaultDollView?.camPos) {
    const offset = defaultDollView.camPos.clone().sub(defaultDollView.target);
    defaultDollView.target = refCenter.clone();
    defaultDollView.camPos = refCenter.clone().add(offset);
  }

  try {
    localStorage.setItem(
      DOLL_DEFAULT_VIEW_STORAGE_KEY,
      JSON.stringify(serializeOrbitView(defaultDollView))
    );
    console.log("✅ Saved default dollhouse view (locked pivot)");
  } catch (e) {
    console.warn("Could not save default doll view:", e);
  }
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
// ----------------------------------------
// Dollhouse rotation should follow pano look direction (during zoom-out)
// ----------------------------------------

// If it rotates the wrong way, flip to -1
const PANO_TO_DOLL_SIGN = 1;

// 1 = full match, 0.5 = half as much, etc.
const PANO_TO_DOLL_GAIN = 1.0;

// --- NEW: if user didn't rotate in pano, force a full spin on return ---
const NO_INPUT_EPS_RAD = THREE.MathUtils.degToRad(1.0); // how close to "default" counts as no-input
const FULL_SPIN_RAD = Math.PI * 2;                      // 360°
const FULL_SPIN_SIGN = 1;                               // flip to -1 if you want opposite direction
const RETURN_ROTATE_MS_NORMAL = 1400; // normal return (when user rotated in pano)
const RETURN_ROTATE_MS_FULLSPIN = 2600; // slower, only for no-input 360 spin
const DOLL_RESET_MS = 1400;

function getPanoLookDeltaForIndex(i) {
  const heroYaw = HERO[i]?.yaw ?? 0;
  // yaw is the pano yaw you already track
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

// Rotate a *saved* orbit view around its target by yaw radians
function rotateSavedOrbitViewYaw(view, yawRad) {
  if (!view) return view;

  const t = view.target.clone();
  const offset = view.camPos.clone().sub(t);
  const sph = new THREE.Spherical().setFromVector3(offset);

  sph.theta += yawRad;

  view.camPos = t.clone().add(new THREE.Vector3().setFromSpherical(sph));
  return view;
}

// ----------------------------------------
// Return-to-dollhouse should originate from CURRENT pano (state.index)
// ----------------------------------------

// Find a node mesh for a pano index in a given cache entry
function findNodeInEntry(entry, panoIndex) {
  if (!entry?.nodes?.length) return null;
  return entry.nodes.find((m) => m?.userData?.panoIndex === panoIndex) || null;
}

// Ensure the active doll model contains the node for the current pano.
// If not, fall back to FULL model (so we always have the node).
function hasNodeInKey(key, panoIndex) {
  const entry = dollCache.get(key);
  return !!findNodeInEntry(entry, panoIndex);
}

// Pick the best model for the panoIndex: prefer up/down, avoid full unless needed
async function chooseBestDollKeyForPano(panoIndex) {
  // Make sure models are loaded at least once (cached after)
  await loadDollModel("up").catch(() => {});
  await loadDollModel("down").catch(() => {});
  await loadDollModel("full").catch(() => {});

  // Prefer up/down, only use full if node isn't in either
  if (hasNodeInKey("up", panoIndex)) return "up";
  if (hasNodeInKey("down", panoIndex)) return "down";
  return "full";
}

// Ensure we are on the best model for this pano, then return that node mesh
async function ensureBestModelHasNode(panoIndex) {
  const bestKey = await chooseBestDollKeyForPano(panoIndex);

  if (activeDollKey !== bestKey) {
    activeDollKey = bestKey;
    setDollButtonsActive(bestKey);

    const root = await loadDollModel(bestKey);
    alignModelToReference(bestKey);
    setActiveDollRoot(root);
  }

  const entry = dollCache.get(activeDollKey);
  return findNodeInEntry(entry, panoIndex) || null;
}

// Snap orbit view to a "zoomed in" view around a node.
// Uses the DEFAULT view direction so it feels consistent.
function snapOrbitToNode(mesh, distanceFactor = 0.25) {
  // Start-near-node moment:
  // ✅ DO NOT change pivot away from refCenter
  if (!mesh || !defaultDollView || !refCenter) return;

  const nodeWorld = new THREE.Vector3();
  mesh.getWorldPosition(nodeWorld);

  // Camera offset from default view (relative to its saved target)
  const defaultOffset = defaultDollView.camPos.clone().sub(defaultDollView.target);
  const defaultRadius = Math.max(0.15, defaultOffset.length());

  // Desired radius near the model (a fraction of default radius)
  const endRadius = Math.max(0.15, defaultRadius * distanceFactor);

  // Direction: mostly the default direction, nudged toward the node direction
  const defaultDir = defaultOffset.clone().normalize();

  const nodeDir = nodeWorld.clone().sub(refCenter);
  if (nodeDir.lengthSq() > 1e-8) nodeDir.normalize();
  else nodeDir.copy(defaultDir);

  const dir = defaultDir.clone().lerp(nodeDir, 0.65).normalize();

  // ✅ Hard lock pivot to refCenter
  orbit.target.copy(refCenter);

  // Place camera close-ish, looking toward refCenter (OrbitControls will handle lookAt via update)
  dollCamera.position.copy(refCenter.clone().add(dir.multiplyScalar(endRadius)));
  dollCamera.zoom = defaultDollView.zoom;

  dollCamera.updateProjectionMatrix();
  orbit.update();
}
// When returning from pano -> dollhouse, start "in" on the current pano node,
// then animate out to the default dollhouse view.
async function resetDollhouseFromCurrentPano(animated = true) {
  if (!defaultDollView) return;
  if (refCenter) {
    orbit.target.copy(refCenter);
    orbit.update();
  }

  // cancel any in-progress node zoom animation
  nodeZoomToken++;

    // pano yaw delta (how far user is rotated away from the pano’s default hero view)
  const panoDeltaRaw =
    getPanoLookDeltaForIndex(state.index) * PANO_TO_DOLL_GAIN * PANO_TO_DOLL_SIGN;

  // If there was effectively "no input" in pano, do a full 360 spin on the way out
  const shouldFullSpin = Math.abs(panoDeltaRaw) < NO_INPUT_EPS_RAD;

  // Step 2 uses panoDelta (what to apply immediately). If no-input, this is 0 anyway.
  const panoDelta = panoDeltaRaw;

  // Step 3 rotates back to default. Normally it's -panoDelta.
  // If no-input, rotate a full 360 instead.
  const rotateBackDelta = shouldFullSpin ? FULL_SPIN_RAD * FULL_SPIN_SIGN : -panoDelta;

  // try to find the node corresponding to the pano currently being viewed
  let node = null;
  try {
    node = await ensureBestModelHasNode(state.index);
  } catch (e) {
    console.warn("ensureActiveModelHasNode failed:", e);
  }

  // 1) START near the current pano node (zoomed in)
  if (node) {
    snapOrbitToNode(node, 0.10);
  } else {
    applyOrbitViewWithLockedPivot(defaultDollView);
  }

  // 2) APPLY the pano rotation offset immediately to this starting view
  //    (so the dollhouse begins "facing" the same way the pano was facing)
  if (panoDelta !== 0) {
    const theta = getOrbitThetaAroundTarget(orbit.target);
    setOrbitThetaAroundTarget(orbit.target, theta + panoDelta);
    orbit.update();
  }

  // 3) ZOOM OUT to home while rotating BACK to the default orientation
  //    i.e. rotate by -panoDelta over the duration
  if (animated) {
  const durationMs = shouldFullSpin
    ? RETURN_ROTATE_MS_FULLSPIN
    : RETURN_ROTATE_MS_NORMAL;

  await animateToOrbitView(defaultDollView, durationMs, {
    rotateYawDelta: rotateBackDelta,
    rotateStartAt: 0.15,
    rotateEndAt: 1.0,
  });
} else {
  applyOrbitViewWithLockedPivot(defaultDollView);
}
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

        // ✅ Extract NODE_XX meshes (once per model load)
        const nodes = extractNodes(root);

        dollCache.set(key, { root, center, size, alignedOnce: false, nodes });

// Step 2C: mark whichever model finished
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

  refCenter = info.center.clone();
  refDistance = computeRefDistanceFromBounds(info.size);
  refReady = true;
dollhouseReady.ref = true;

  orbit.target.copy(refCenter);
  applyReferenceClippingAndLimits();
  orbit.update();
// ✅ Now that refCenter exists, ensure defaultDollView (if any) doesn’t carry a different pivot
if (defaultDollView) {
  const offset = defaultDollView.camPos.clone().sub(defaultDollView.target);
  defaultDollView.target = refCenter.clone();
  defaultDollView.camPos = refCenter.clone().add(offset);
}
}

function setActiveDollRoot(root) {
  // remove previous
  if (activeDollRoot) {
    dollScene.remove(activeDollRoot);
  }

  // if root is invalid, just clear active + node meshes and bail
  if (!root) {
    activeDollRoot = null;
    activeNodeMeshes = [];
    renderer.domElement.style.cursor = orbit.enabled ? "grab" : "default";
    return;
  }

  // set + add
  activeDollRoot = root;
  dollScene.add(activeDollRoot);

  // ✅ Activate correct node list for raycasting
  const entry = dollCache.get(activeDollKey);
  activeNodeMeshes = entry?.nodes || [];

  // reset hover when switching models
  if (hoveredNode) {
    const s = nodeHoverState.get(hoveredNode);
    if (s) s.target = 0;
    hoveredNode = null;
  }

  renderer.domElement.style.cursor = orbit.enabled ? "grab" : "default";
}
function saveOrbitView() {
  return {
    camPos: dollCamera.position.clone(),
    camQuat: dollCamera.quaternion.clone(),
    target: orbit.target.clone(),
    zoom: dollCamera.zoom,
  };
}

function restoreOrbitView(v) {
  orbit.target.copy(v.target);
  dollCamera.position.copy(v.camPos);
  dollCamera.quaternion.copy(v.camQuat);
  dollCamera.zoom = v.zoom;
  dollCamera.updateProjectionMatrix();
  orbit.update();
}
// ✅ Apply a saved view BUT keep pivot locked to refCenter (original rotation point)
function applyOrbitViewWithLockedPivot(v) {
  if (!v) return;

  if (!refCenter) {
    // fallback: restore (but even here, OrbitControls will overwrite quaternion on update)
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

// Smoothly animate orbit camera + target back to a saved view
// Optionally also rotate around the target during the animation.
function animateToOrbitView(
  v,
  durationMs = 450,
  {
    spinRad = 0,     // e.g. Math.PI*2 for a full spin, ends in same place
    useShortest = true, // true for normal returns
  } = {}
) {
  if (!v) return Promise.resolve();
  if (!refCenter) {
    applyOrbitViewWithLockedPivot(v);
    return Promise.resolve();
  }

  const prevDamping = orbit.enableDamping;
  orbit.enableDamping = false;

  const pivot = refCenter.clone();

  // Start + end offsets relative to pivot
  const startOffset = dollCamera.position.clone().sub(pivot);
  const endOffset   = v.camPos.clone().sub(pivot);

  const startSph = new THREE.Spherical().setFromVector3(startOffset);
  const endSph   = new THREE.Spherical().setFromVector3(endOffset);

  const startR = startSph.radius;
  const startPhi = startSph.phi;
  const startTheta = startSph.theta;

  const endR = endSph.radius;
  const endPhi = endSph.phi;
  const endThetaBase = endSph.theta;

  // Zoom
  const startZoom = dollCamera.zoom;
  const endZoom = v.zoom ?? 1;

  const smooth = (t) => t * t * (3 - 2 * t);
  const start = performance.now();

  // Choose theta delta
  const thetaDelta =
    (useShortest ? shortestAngleDelta(startTheta, endThetaBase) : (endThetaBase - startTheta))
    + (spinRad || 0);

  return new Promise((resolve) => {
    function tick() {
      const uRaw = (performance.now() - start) / durationMs;
      const u = Math.min(1, Math.max(0, uRaw));
      const e = smooth(u);

      orbit.target.copy(pivot);

      const r = startR + (endR - startR) * e;
      const phi = startPhi + (endPhi - startPhi) * e;
      const theta = startTheta + thetaDelta * e;

      const sph = new THREE.Spherical(r, phi, theta);
      const newPos = new THREE.Vector3().setFromSpherical(sph).add(pivot);

      dollCamera.position.copy(newPos);
      dollCamera.zoom = startZoom + (endZoom - startZoom) * e;
      dollCamera.updateProjectionMatrix();
      orbit.update();

      if (u >= 1) {
        // Set exact end state (no snap because it matches the trajectory)
        const finalTheta = startTheta + thetaDelta; // = endThetaBase (+ spinRad)
        const finalSph = new THREE.Spherical(endR, endPhi, finalTheta);
        dollCamera.position.copy(
          new THREE.Vector3().setFromSpherical(finalSph).add(pivot)
        );
        dollCamera.zoom = endZoom;
        dollCamera.updateProjectionMatrix();
        orbit.target.copy(pivot);
        orbit.update();

        orbit.enableDamping = prevDamping;
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}
async function resetDollhouseView(animated = true) {
  if (!defaultDollView) return;

  if (animated) {
    const panoDeltaRaw =
      getPanoLookDeltaForIndex(state.index) * PANO_TO_DOLL_GAIN * PANO_TO_DOLL_SIGN;

    const shouldFullSpin = Math.abs(panoDeltaRaw) < NO_INPUT_EPS_RAD;
    const rotateDelta = shouldFullSpin ? FULL_SPIN_RAD * FULL_SPIN_SIGN : panoDeltaRaw;

    await animateToOrbitView(defaultDollView, durationMs, {
  spinRad: shouldFullSpin ? FULL_SPIN_RAD * FULL_SPIN_SIGN : 0,
  useShortest: true,
});
  } else {
    
  }
}

let switching = false;
async function switchDollhouseModel(key) {
  if (switching) return;
  if (activeDollKey === key && activeDollRoot) return;

  switching = true;
  setDollButtonsActive(key);

  const view = saveOrbitView();

  try {
    await ensureReferenceReady();

    const root = await loadDollModel(key);
    alignModelToReference(key);

    activeDollKey = key; // ✅ set key BEFORE activating so node list is correct
    setActiveDollRoot(root);

    applyOrbitViewWithLockedPivot(view);
    applyReferenceClippingAndLimits();
  } catch (e) {
    console.error(`Failed to load dollhouse model "${key}"`, e);
    setDollButtonsActive(activeDollKey);
  } finally {
    switching = false;
  }
}
if (btnFull) btnFull.addEventListener("click", () => switchDollhouseModel("full"));
if (btnUp) btnUp.addEventListener("click", () => switchDollhouseModel("up"));
if (btnDown) btnDown.addEventListener("click", () => switchDollhouseModel("down"));

// -----------------------------
// Dollhouse tab click (race-safe + fade-safe)
// -----------------------------

let dollhouseEnterToken = 0;
// Show the progress UI only on the very first time the user enters Dollhouse
let hasShownInitialDollhouseLoader = false;

tabDollhouse.addEventListener("click", async () => {
  dollhouseEnterToken++;
  const token = dollhouseEnterToken;

  const stillValid = () => token === dollhouseEnterToken;

  const comingFromPano = (mode === "pano");
  // Progress bar (only shown during user-visible waits)
  let pm = null;

  try {
    // 1) Fade to black first (only if leaving pano)
    if (comingFromPano) {
      await fadeOverlayTo(1, 100);
      if (!stillValid()) { if (pm) pm.finish(); return; }
    }

    // 2) Switch mode
    setMode("dollhouse");

    // ✅ Only show the loader on FIRST entry to dollhouse (initial download / first-time setup)
    const shouldShowLoader = !hasShownInitialDollhouseLoader;

    let tRef = null;
    let tModel = null;

    if (shouldShowLoader) {
      pm = beginProgressSession("Loading dollhouse…");
      tRef = pm.task("reference", 2.0);
      tModel = pm.task("model", 3.0);
    }

    // 3) HARD guarantee: even if fadeOverlayTo got cancelled mid-flight,
    //    we are definitely black while loading.
    fadeOverlay.style.opacity = "1";
    if (!stillValid()) { if (pm) pm.finish(); return; }

    setDollButtonsActive(activeDollKey);

    // 4) Ensure reference is ready (bounds, refCenter, limits)
    // ensureReferenceReady may load FULL internally; show that as part of "reference"
    await ensureReferenceReady();
    if (tRef) tRef.done();
    if (!stillValid()) { if (pm) pm.finish(); return; }

    // 5) If returning from pano, let reset pick correct model first
    if (needsDollReset) {
      needsDollReset = false;

      // Ensure we have a real default view
      if (!defaultDollView) {
        const saved = loadSavedDefaultDollView();
        if (saved) {
          defaultDollView = saved;
        } else {
          await loadDollModel("full").catch(() => {});
          const fullEntry = dollCache.get("full");

          if (fullEntry?.root) {
            frameCameraToObject(dollCamera, orbit, fullEntry.root, 0.7);
            applyReferenceClippingAndLimits();

            defaultDollView = saveOrbitView();
            framedOnce = true;

            if (isAdminMode()) {
              try {
                localStorage.setItem(
                  DOLL_DEFAULT_VIEW_STORAGE_KEY,
                  JSON.stringify(serializeOrbitView(defaultDollView))
                );
              } catch {}
            }
          } else {
            defaultDollView = saveOrbitView();
          }
        }
      }

      // The reset animation is visual; once reference is ready, treat "loading" as complete.
      if (tModel) tModel.done();
      const resetPromise = resetDollhouseFromCurrentPano(true);

      // Reveal immediately so user sees *something* while the reset anim runs
      fadeOverlay.style.opacity = "0";
      await fadeOverlayTo(0, 150);
      if (!stillValid()) { if (pm) pm.finish(); return; }

      await resetPromise;
      if (!stillValid()) { if (pm) pm.finish(); return; }

      // Final hard guarantee (never stuck black)
      fadeOverlay.style.opacity = "0";
      if (pm) {
        hasShownInitialDollhouseLoader = true;
        pm.finish();
      }
      return;
    }

    // 6) Otherwise load whatever the user last selected
    setDollButtonsActive(activeDollKey);

    const root = await loadDollModel(
      activeDollKey,
      tModel ? (p) => tModel.update(p) : null
    );
    if (tModel) tModel.done();
    if (!stillValid()) { if (pm) pm.finish(); return; }

    alignModelToReference(activeDollKey);
    setActiveDollRoot(root);

    // 7) First-time entry: establish default view
    if (!framedOnce) {
      framedOnce = true;

      await loadDollModel("full").catch(() => {});
      if (!stillValid()) { if (pm) pm.finish(); return; }

      if (defaultDollView) {
        applyOrbitViewWithLockedPivot(defaultDollView);
        applyReferenceClippingAndLimits();
      } else {
        const saved = loadSavedDefaultDollView();
        if (saved) {
          defaultDollView = saved;
          applyOrbitViewWithLockedPivot(defaultDollView);
          applyReferenceClippingAndLimits();
        } else {
          frameCameraToObject(dollCamera, orbit, dollCache.get("full").root, 0.7);
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
        }
      }
    }

    // 8) Fade back in
    fadeOverlay.style.opacity = "0";
    await fadeOverlayTo(0, 150);

    // Final hard guarantee
    fadeOverlay.style.opacity = "0";
    if (pm) {
      hasShownInitialDollhouseLoader = true;
      pm.finish();
    }
  } catch (e) {
    console.error("Failed to load dollhouse GLB:", e);
    if (pm) pm.cancel();
    // Never leave user on a black overlay if something errors
    try {
      fadeOverlay.style.opacity = "0";
      await fadeOverlayTo(0, 120);
    } catch {}
  }
});
// -----------------------------
// Init
// -----------------------------
async function init() {
  setUIEnabled(false);

  // 1) Load tour config
  await loadTourConfig();

  // 2) Build PANOS array from tour.json
  PANOS = Array.from({ length: TOUR.panoCount }, (_, i) => {
    return TOUR_BASE + applyPanoPattern(TOUR.panoPattern, i + 1);
  });

  // 3) HERO from tour.json
  HERO = TOUR.hero || [];
// 3b) ROOMS from tour.json (optional)
ROOMS = Array.isArray(TOUR.rooms) ? TOUR.rooms : [];
// ✅ Permanent dollhouse default view from tour.json (wins over localStorage)
if (TOUR.dollDefaultView && TOUR.dollDefaultView.camPos && TOUR.dollDefaultView.camQuat && TOUR.dollDefaultView.target) {
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
  }
}

// Optional sanity check (won't break anything)
if (ROOMS.length && ROOMS.length !== TOUR.panoCount) {
  console.warn(`rooms[] length (${ROOMS.length}) does not match panoCount (${TOUR.panoCount}).`);
}

  // 4) GLB paths from tour.json
  DOLLHOUSE_GLB_FULL = TOUR_BASE + TOUR.models.full;
  DOLLHOUSE_GLB_UP = TOUR_BASE + TOUR.models.up;
  DOLLHOUSE_GLB_DOWN = TOUR_BASE + TOUR.models.down;

  // 5) Doll home yaw from tour.json (optional)
  DOLL_HOME_YAW_DEG = TOUR.dollHomeYawDeg ?? -90;
  DOLL_HOME_YAW_OFFSET = THREE.MathUtils.degToRad(DOLL_HOME_YAW_DEG);

  // 6) Now that PANOS exists, size panoTextures cache
  state.panoTextures = new Array(PANOS.length).fill(null);

// -----------------------------
// Gated start: show Begin Tour overlay
// -----------------------------
setMode("pano"); // ensure we start in pano
showStartOverlay();
setUIEnabled(false);

// Hide nav until tour starts
navWrap.classList.add("hidden");
if (dollBtns) dollBtns.classList.add("hidden");

// Ensure sphere starts blank so you don’t see anything behind overlay
blankPanoSphere();

// Button click starts everything
if (startBtn) {
  startBtn.disabled = false;

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;

  let pm = null;
  let pmTimer = setTimeout(() => {
    // Only show if loading takes longer than a moment
    pm = beginProgressSession("Loading tour…");
  }, 350);

  startBrandSwapTimer(10000);
  if (startCard) startCard.classList.add("hidden");
  if (startOverlay) startOverlay.classList.add("videoMode");

  // 🔥 Start preload, but do NOT block first pano on it.
  const preloadPromise = preloadStartAssets().catch((e) => {
    console.warn("Preload assets failed (continuing):", e);
  });

  try {
    // Run intro (don’t care if preload is still running)
    await playIntroVideoOnce().catch((e) => {
      console.warn("Intro video failed (continuing):", e);
    });

    // ✅ Only require pano 0 for first view
    const first = await ensurePanoLoaded(0, (p) => {
      if (pm) {
        const t = pm.__panoTask || (pm.__panoTask = pm.task("pano0", 4.0));
        t.update(p);
      }
    });
    if (pm && pm.__panoTask) pm.__panoTask.done();
    setSphereMap(first);

    clearTimeout(pmTimer);
    if (pm) pm.finish();

    yaw = HERO[0]?.yaw ?? 0;
    pitch = HERO[0]?.pitch ?? 0;
    targetYaw = yaw;
    targetPitch = pitch;
    applyYawPitch();

    state.index = 0;
    updateIndicator(0);
    preloadNearby(0);

    setUIEnabled(true);
    navWrap.classList.remove("hidden");
    requestAnimationFrame(() => fadeInPano(450));

    if (startOverlay) startOverlay.classList.remove("videoMode");
    hideStartOverlay();

    // ✅ Let preloading continue in the background
    // Optionally: await it AFTER pano is visible (won’t block UX)
    preloadPromise.then(() => console.log("✅ background preload complete"));
  } catch (e) {
    console.error("Begin tour failed:", e);
    clearTimeout(pmTimer);
    if (pm) pm.cancel();

    if (startOverlay) startOverlay.classList.remove("videoMode");
    if (startCard) startCard.classList.remove("hidden");
    showStartOverlay();

    startBtn.disabled = false;
    if (introVideoEl) introVideoEl.classList.remove("show");
  }
}, { once: true });
resizeRenderer();
applyRenderLookForMode("pano");
} // end if (startBtn)

} // ✅ end init()

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

window.addEventListener("resize", resizeRenderer);

const ro = new ResizeObserver(() => {
  resizeRenderer();
});
ro.observe(container);

// -----------------------------
// Render loop (mode-based)
// -----------------------------
let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // ✅ guarantee the correct exposure every frame
  applyRenderLookForMode(mode);

  if (mode === "dollhouse") {
    orbit.update();
    updateNodeHover(dt);
    renderer.render(dollScene, dollCamera);
  } else {
    renderer.render(panoScene, panoCamera);
  }
}
animate();

init();





