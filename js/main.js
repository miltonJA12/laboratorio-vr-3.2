
import * as THREE from "three";

import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

import { createLaboratoryScene } from "./scene.js";
import { createPhysicsWorld, FIXED_STEP } from "./physics.js";
import { createPieces, syncPieces, CATEGORIES } from "./pieces.js";
import { createContainers } from "./containers.js";
import { setupXR } from "./xr.js";
import { createHandInteraction } from "./interaction.js";
import { createGame } from "./game.js";
import { createHUD } from "./hud.js";

// ============================================
// NEXUS PHYSICS VR - PRÁCTICA 3.2
// Three.js + cannon-es + WebXR
// ============================================

// ELEMENTOS HTML
const container = document.getElementById("scene-container");
const placeholder = document.getElementById("scene-placeholder");
const status = document.getElementById("lab-status");
const xrStatus = document.getElementById("xr-status");
const startVRButton = document.getElementById("start-vr");
const resetButton = document.getElementById("reset-lab");

if (!container) {
  throw new Error("Falta #scene-container");
}

// ESCENA
const { scene, tables } = createLaboratoryScene();

// FÍSICA
const {
  world,
  staticBodies,
  addStaticBox
} = createPhysicsWorld();

// RECIPIENTES Y FIGURAS
const containers = createContainers(scene, addStaticBox);
const pieces = createPieces(scene, world);

world.broadphase.dirty = true;

// CÁMARA
const camera = new THREE.PerspectiveCamera(
  60, 1, 0.1, 100
);

camera.position.set(5.2, 4.2, 9.2);
camera.lookAt(0, 0.7, 1.2);

// RENDERIZADOR
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.xr.enabled = true;

container.appendChild(renderer.domElement);
placeholder?.remove();

// CONTROLES DE ESCRITORIO
const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.target.set(0, 0.7, 1.2);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2.05;
controls.update();

// RESPONSIVIDAD
function resizeRenderer() {
  const w = container.clientWidth;
  const h = container.clientHeight;

  if (!w || !h) return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(container);
resizeRenderer();

// MARCADOR 3D
const hud = createHUD(scene);

// MARCADOR DE ESCRITORIO
const scorePreview = document.createElement("div");
scorePreview.id = "score-preview";

Object.assign(scorePreview.style, {
  color: "#d6edff",
  background: "#10243c",
  padding: "14px 20px",
  borderTop: "1px solid rgba(56,217,255,.2)",
  fontSize: "14px",
  lineHeight: "1.8",
  textAlign: "center"
});

container.insertAdjacentElement(
  "afterend",
  scorePreview
);

// JUEGO
let displayAccumulator = 0;

const game = createGame({
  pieces,
  containers,
  tables,
  world,
  onChange: renderScore
});

function formatTime(seconds) {
  if (seconds === null) return "Pendiente";

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderScore() {
  const data = game.getState();

  hud.render(data);

  const categories = Object.entries(data.progress)
    .map(([id, count]) => {
      const label = CATEGORIES.find(c => c.id === id);
      return `${label?.name ?? id}: ${count}/5`;
    })
    .join(" | ");

  scorePreview.textContent =
    `Aciertos: ${data.correct}/20 | ` +
    `Errores: ${data.errors} | ` +
    `Intentos: ${data.attempts} | ` +
    `Precisión: ${data.precision.toFixed(1)}% | ` +
    `Tiempo: ${formatTime(data.elapsed)} | ` +
    categories + " | " + data.message;

  if (status) {
    status.textContent =
      data.status === "completado"
        ? "LABORATORIO COMPLETADO"
        : data.status === "jugando"
          ? "CLASIFICACIÓN EN CURSO"
          : "LABORATORIO PREPARADO";
  }
}

// BOTÓN COMENZAR EN ESCRITORIO
const startButton = document.createElement("button");

startButton.id = "start-game";
startButton.type = "button";
startButton.textContent = "Comenzar clasificación";
startButton.className = "btn btn-primary-vr";

const controlBar = document.querySelector(".lab-controls");

if (controlBar) {
  controlBar.prepend(startButton);
}

function startGame() {
  if (game.start()) {
    startButton.disabled = true;
    startButton.textContent = "Partida iniciada";
    console.log("NEXUS: partida iniciada");
  }
}

function resetGame() {
  interaction?.releaseAll();
  game.reset();

  startButton.disabled = false;
  startButton.textContent = "Comenzar clasificación";

  console.log(
    "NEXUS: puntuación reiniciada y figuras redistribuidas"
  );
}

startButton.addEventListener("click", startGame);

if (resetButton) {
  resetButton.disabled = false;
  resetButton.addEventListener("click", resetGame);
}

// ============================================
// BOTONES INMERSIVOS EN 3D
// ============================================

function createVRControl(label, x, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;

  const context = canvas.getContext("2d");

  context.fillStyle = color;
  context.fillRect(0, 0, 512, 160);

  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.strokeRect(5, 5, 502, 150);

  context.font = "bold 53px Arial";
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 256, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.18),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true
    })
  );

  mesh.position.set(x, 1.25, -0.7);
  scene.add(mesh);

  return mesh;
}

const vrStart = createVRControl(
  "COMENZAR",
  -0.33,
  "#17698b"
);

const vrReset = createVRControl(
  "REINICIAR",
  0.33,
  "#9a354c"
);

const vrPinchStates = [false, false];
const pinchPoint = new THREE.Vector3();

function checkVRButtons(hands) {
  if (!renderer.xr.isPresenting) {
    vrPinchStates.fill(false);
    return;
  }

  hands.forEach((hand, index) => {
    const thumb = hand.joints?.["thumb-tip"];
    const finger = hand.joints?.["index-finger-tip"];

    if (!thumb?.visible || !finger?.visible) {
      vrPinchStates[index] = false;
      return;
    }

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    thumb.getWorldPosition(a);
    finger.getWorldPosition(b);

    const distance = a.distanceTo(b);
    const pinching = vrPinchStates[index]
      ? distance < 0.055
      : distance < 0.035;

    if (pinching && !vrPinchStates[index]) {
      pinchPoint.copy(a).add(b).multiplyScalar(0.5);

      if (
        pinchPoint.distanceTo(vrStart.position) < 0.28
      ) {
        startGame();
      } else if (
        pinchPoint.distanceTo(vrReset.position) < 0.28
      ) {
        resetGame();
      }
    }

    vrPinchStates[index] = pinching;
  });
}

// ============================================
// WEBXR
// ============================================

let interaction = null;

const xr = setupXR({
  renderer,
  scene,
  button: startVRButton,
  statusElement: xrStatus,
  onSessionEnd: () => {
    interaction?.releaseAll();
    controls.enabled = true;
    vrPinchStates.fill(false);
  }
});

interaction = createHandInteraction({
  hands: xr.hands,
  pieces,
  renderer
});

// ============================================
// ACTUALIZACIÓN FÍSICA
// ============================================

const clock = new THREE.Clock();
let accumulator = 0;

function updatePhysics(delta) {
  accumulator += delta;

  let steps = 0;

  while (
    accumulator >= FIXED_STEP &&
    steps < 4
  ) {
    world.step(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps++;

    // La validación usa el mismo paso fijo
    // que la simulación de cuerpos rígidos.
    game.update(FIXED_STEP);
  }

  if (steps === 4 && accumulator >= FIXED_STEP) {
    accumulator = 0;
  }

  syncPieces(pieces);
}

// ============================================
// BUCLE PRINCIPAL
// ============================================

function animate() {
  const delta = Math.min(clock.getDelta(), 1 / 30);

  if (renderer.xr.isPresenting) {
    controls.enabled = false;

    checkVRButtons(xr.hands);
    interaction.update(delta);
  } else {
    controls.enabled = true;
    controls.update();
  }

  updatePhysics(delta);

  displayAccumulator += delta;

  if (displayAccumulator >= 0.15) {
    displayAccumulator = 0;
    renderScore();
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

renderer.xr.addEventListener("sessionstart", () => {
  accumulator = 0;
  clock.getDelta();
});

renderer.xr.addEventListener("sessionend", () => {
  accumulator = 0;
  clock.getDelta();
});

// ============================================
// DIAGNÓSTICO EN COMPUTADORA
// ============================================

// Esta función NO forma parte del gameplay.
// Permite probar gravedad, clasificación y
// puntuación sin un dispositivo VR.

function debugDrop(categoryId, containerId) {
  const piece = pieces.find(p =>
    p.category === categoryId &&
    p.state !== "clasificado" &&
    p.state !== "sujeto" &&
    !p._needsRecovery
  );

  const target = containers.find(
    c => c.id === containerId
  );

  if (!piece || !target) {
    console.warn(
      "Figura o recipiente no disponible",
      categoryId,
      containerId
    );
    return false;
  }

  if (game.getState().status !== "jugando") {
    console.warn("Primero presiona Comenzar clasificación.");
    return false;
  }

  const body = piece.body;

  body.type = 1; // CANNON.Body.DYNAMIC
  body.mass = piece.originalMass ?? 0.35;
  body.updateMassProperties();

  body.position.set(
    target.position.x,
    target.interior.rimY + 0.35,
    target.position.z
  );

  body.quaternion.set(0, 0, 0, 1);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);

  body.aabbNeedsUpdate = true;
  body.wakeUp();

  piece.state = "liberado";

  piece._stableTime = 0;
  piece._wrongTime = 0;
  piece._wrongContainer = null;
  piece._errorRegistered = false;

  world.broadphase.dirty = true;

  console.log(
    `Prueba: ${categoryId} soltada en ${containerId}`
  );

  return true;
}

// ============================================
// ESTADÍSTICAS
// ============================================

const categoryCounts = Object.fromEntries(
  CATEGORIES.map(category => [
    category.id,
    pieces.filter(p => p.category === category.id).length
  ])
);

const tableCounts = tables.map((_, index) =>
  pieces.filter(p => p.tableIndex === index).length
);

window.NEXUS_DEBUG = {
  scene,
  camera,
  renderer,
  world,
  tables,
  containers,
  pieces,
  staticBodies,
  categoryCounts,
  tableCounts,
  game,
  hud,
  xr,
  interaction,
  startGame,
  resetGame,
  debugDrop
};

console.log("NEXUS PHYSICS VR — Inicializado");
console.log("Three.js:", THREE.REVISION);
console.log("Mesas:", tables.length);
console.log("Figuras:", pieces.length);
console.log("Recipientes:", containers.length);
console.log("Cuerpos físicos:", world.bodies.length);
console.log("Por mesa:", tableCounts);
console.log("Por categoría:", categoryCounts);

renderScore();
