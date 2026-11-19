
import * as CANNON from "cannon-es";

const STABILITY_SECONDS = 0.8;
const MAX_STABLE_SPEED = 0.18;
const RECOVERY_SECONDS = 1.5;

const SPAWN_SLOTS = [
  [-0.42, -0.20],
  [0, -0.20],
  [0.42, -0.20],
  [-0.22, 0.20],
  [0.22, 0.20]
];

function shuffle(values) {
  const result = [...values];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function randomDistribution(categories) {
  const result = Array.from({ length: 4 }, () => []);

  for (const category of categories) {
    for (let table = 0; table < 4; table++) {
      result[table].push(category);
    }
  }

  const extraTables = shuffle([0, 1, 2, 3]);

  categories.forEach((category, index) => {
    result[extraTables[index]].push(category);
  });

  return result.map(shuffle);
}

export function createGame({
  pieces,
  containers,
  tables,
  world,
  onChange = () => {}
}) {
  const categoryIds = containers.map(c => c.id);

  let state;
  let lastNotification = "";

  function initialState() {
    return {
      status: "preparado",
      elapsed: 0,
      correct: 0,
      errors: 0,
      attempts: 0,
      progress: Object.fromEntries(
        categoryIds.map(id => [id, 0])
      ),
      completionTimes: Object.fromEntries(
        categoryIds.map(id => [id, null])
      ),
      message: "Presiona COMENZAR para iniciar."
    };
  }

  function notify() {
    onChange(getState());
  }

  function getState() {
    return {
      ...state,
      progress: { ...state.progress },
      completionTimes: { ...state.completionTimes },
      precision: state.attempts > 0
        ? 100 * state.correct / state.attempts
        : 0
    };
  }

  function resetPieceTracking(piece) {
    piece._stableTime = 0;
    piece._wrongTime = 0;
    piece._wrongContainer = null;
    piece._recoveryTime = 0;
    piece._counted = false;
    piece._errorRegistered = false;
    piece._needsRecovery = false;
  }

  function findContainer(piece) {
    const p = piece.body.position;

    // Margen aproximado del tamaño del objeto.
    // Evita validar un centro encima del borde.
    const margin = 0.155;

    return containers.find(c => {
      const v = c.interior;

      return (
        p.x > v.minX + margin &&
        p.x < v.maxX - margin &&
        p.z > v.minZ + margin &&
        p.z < v.maxZ - margin &&
        p.y > v.floorY &&
        p.y < v.rimY - 0.03
      );
    }) || null;
  }

  function stopped(piece) {
    return (
      piece.body.velocity.length() < MAX_STABLE_SPEED &&
      piece.body.angularVelocity.length() < 0.45
    );
  }

  function restorePiece(piece) {
    const table = tables[piece.tableIndex];

    const topY = table.userData.surfaceY;

    const x = table.position.x;
    const z = table.position.z;

    const occupied = pieces.filter(other =>
      other !== piece &&
      other.state !== "clasificado" &&
      other.state !== "sujeto" &&
      other.tableIndex === piece.tableIndex &&
      other.body.position.y > topY - 0.15
    );

    const slots = shuffle(SPAWN_SLOTS);

    let chosen = slots[0];

    for (const slot of slots) {
      const sx = x + slot[0];
      const sz = z + slot[1];

      const free = occupied.every(other => {
        const dx = other.body.position.x - sx;
        const dz = other.body.position.z - sz;

        return Math.hypot(dx, dz) > 0.34;
      });

      if (free) {
        chosen = slot;
        break;
      }
    }

    const body = piece.body;

    body.type = CANNON.Body.DYNAMIC;
    body.mass = piece.originalMass ?? 0.35;
    body.updateMassProperties();

    body.position.set(
      x + chosen[0],
      topY + 0.3,
      z + chosen[1]
    );

    body.quaternion.setFromAxisAngle(
      new CANNON.Vec3(0, 1, 0),
      Math.random() * Math.PI * 2
    );

    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);

    body.aabbNeedsUpdate = true;
    body.wakeUp();

    piece.state = "disponible";
    resetPieceTracking(piece);
    world.broadphase.dirty = true;
  }

  function start() {
    if (state.status !== "preparado") {
      return false;
    }

    state.status = "jugando";
    state.message = "Clasifica las 20 figuras.";

    notify();
    return true;
  }

  function reset() {
    // El controlador debe liberar cualquier
    // objeto sujeto antes de llamar reset().
    state = initialState();

    containers.forEach(c => {
      c.count = 0;
    });

    const distribution = randomDistribution(categoryIds);
    const slotsByTable = Array.from(
      { length: 4 },
      () => shuffle(SPAWN_SLOTS)
    );

    const remaining = [...pieces];

    distribution.forEach((categories, tableIndex) => {
      const table = tables[tableIndex];

      categories.forEach((category, slotIndex) => {
        const index = remaining.findIndex(
          p => p.category === category
        );

        if (index < 0) {
          throw new Error(
            "No se encontró una figura para la distribución."
          );
        }

        const piece = remaining.splice(index, 1)[0];
        const [dx, dz] = slotsByTable[tableIndex][slotIndex];

        const body = piece.body;

        piece.tableIndex = tableIndex;
        piece.state = "disponible";

        resetPieceTracking(piece);

        body.type = CANNON.Body.DYNAMIC;
        body.mass = piece.originalMass ?? 0.35;
        body.updateMassProperties();

        body.position.set(
          table.position.x + dx,
          table.userData.surfaceY + 0.3,
          table.position.z + dz
        );

        body.quaternion.setFromAxisAngle(
          new CANNON.Vec3(0, 1, 0),
          Math.random() * Math.PI * 2
        );

        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);

        body.aabbNeedsUpdate = true;
        body.wakeUp();
      });
    });

    world.broadphase.dirty = true;

    notify();
  }

  function recordCorrect(piece, container) {
    if (piece._counted) return;

    piece._counted = true;
    piece.state = "clasificado";

    state.correct++;
    state.attempts++;

    state.progress[container.id]++;
    container.count++;

    // El cuerpo permanece físicamente
    // dentro del bote. No se teletransporta.
    piece.body.velocity.set(0, 0, 0);
    piece.body.angularVelocity.set(0, 0, 0);
    piece.body.sleep();

    state.message =
      `¡Correcto! ${container.name} (${container.count}/5)`;

    if (container.count === 5) {
      state.completionTimes[container.id] =
        state.elapsed;
    }

    if (state.correct === 20) {
      state.status = "completado";
      state.message = "¡Laboratorio completado! 20/20.";
    }

    notify();
  }

  function recordError(piece, container) {
    if (piece._errorRegistered) return;

    piece._errorRegistered = true;
    piece._needsRecovery = true;
    piece._recoveryTime = 0;

    piece.state = "error";

    state.errors++;
    state.attempts++;

    state.message =
      `Error: ${piece.category} no corresponde a ${container.name}.`;

    notify();
  }

  function update(dt) {
    if (state.status !== "jugando") return;

    state.elapsed += dt;

    for (const piece of pieces) {
      if (
        piece.state === "clasificado" ||
        piece.state === "sujeto"
      ) {
        continue;
      }

      if (piece._needsRecovery) {
        piece._recoveryTime += dt;

        if (piece._recoveryTime >= RECOVERY_SECONDS) {
          restorePiece(piece);
        }

        continue;
      }

      // Una pieza en el suelo permanece
      // recuperable mediante interacción manual.
      // No cuenta como intento de clasificación.
      const container = findContainer(piece);

      if (!container) {
        piece._stableTime = 0;
        piece._wrongTime = 0;
        piece._wrongContainer = null;
        continue;
      }

      // Solo validamos piezas que se hayan
      // soltado, nunca una pieza inicial o sujeta.
      if (
        piece.state !== "liberado" &&
        piece.state !== "estabilizandose"
      ) {
        continue;
      }

      if (!stopped(piece)) {
        piece._stableTime = 0;
        piece._wrongTime = 0;
        piece.state = "liberado";
        continue;
      }

      piece.state = "estabilizandose";

      if (container.id === piece.category) {
        piece._stableTime += dt;
        piece._wrongTime = 0;

        if (piece._stableTime >= STABILITY_SECONDS) {
          recordCorrect(piece, container);
        }
      } else {
        if (piece._wrongContainer !== container.id) {
          piece._wrongContainer = container.id;
          piece._wrongTime = 0;
        }

        piece._wrongTime += dt;

        if (piece._wrongTime >= STABILITY_SECONDS) {
          recordError(piece, container);
        }
      }
    }
  }

  state = initialState();

  function snapshot() {
    return getState();
  }

  return {
    start,
    reset,
    update,
    getState: snapshot,
    restorePiece
  };
}
