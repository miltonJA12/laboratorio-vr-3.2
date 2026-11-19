
import * as THREE from "three";

export function createHUD(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;

  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 1.61),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false
    })
  );

  board.position.set(0, 2.35, -2.75);
  scene.add(board);

  const categoryNames = {
    esfera: "ESFERAS",
    cubo: "CUBOS",
    piramide: "PIRÁMIDES",
    prisma: "PRISMAS"
  };

  const colors = {
    esfera: "#38aaff",
    cubo: "#ff647b",
    piramide: "#ffd166",
    prisma: "#55e6ac"
  };

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined) {
      return "PENDIENTE";
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  function text(value, x, y, size = 32, color = "#ffffff") {
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, y);
  }

  function render(state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#081323";
    ctx.fillRect(0, 0, 1024, 768);

    ctx.strokeStyle = "#38d9ff";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 1008, 752);

    ctx.fillStyle = "#10243c";
    ctx.fillRect(15, 15, 994, 100);

    text("NEXUS PHYSICS VR", 48, 78, 44, "#38d9ff");

    text(
      state.status.toUpperCase(),
      755,
      78,
      27,
      "#ffffff"
    );

    text("ACIERTOS", 48, 170, 30, "#9badc6");
    text(`${state.correct}/20`, 48, 250, 76, "#ffffff");

    text("ERRORES", 420, 170, 30, "#9badc6");
    text(state.errors, 420, 250, 67, "#ff647b");

    text("PRECISIÓN", 720, 170, 30, "#9badc6");
    text(`${state.precision.toFixed(1)}%`, 720, 250, 51, "#55e6ac");

    text("INTENTOS", 48, 312, 27, "#9badc6");
    text(state.attempts, 205, 312, 30);

    text("TIEMPO", 465, 312, 27, "#9badc6");
    text(formatTime(state.elapsed), 615, 312, 33);

    let y = 390;

    for (const id of Object.keys(categoryNames)) {
      const progress = state.progress[id] ?? 0;
      const completedAt = state.completionTimes[id];

      text(categoryNames[id], 48, y, 30, colors[id]);
      text(`${progress}/5`, 430, y, 30);
      text(formatTime(completedAt), 650, y, 27, "#c8d9ee");

      y += 65;
    }

    ctx.fillStyle = "#10243c";
    ctx.fillRect(24, 675, 976, 70);

    ctx.font = "bold 26px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(
      state.message.slice(0, 65),
      512,
      719
    );
    ctx.textAlign = "left";

    texture.needsUpdate = true;
  }

  function dispose() {
    scene.remove(board);
    board.geometry.dispose();
    board.material.dispose();
    texture.dispose();
  }

  return {
    board,
    render,
    dispose,
    formatTime
  };
}
