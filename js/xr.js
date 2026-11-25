
import {
  XRHandModelFactory
} from "three/addons/webxr/XRHandModelFactory.js";

// =============================================
// NEXUS PHYSICS VR
// WebXR + Meta Quest 3 + Hand Tracking
// =============================================

export function setupXR({
  renderer,
  scene,
  button,
  statusElement,
  onSessionEnd = () => {}
}) {
  const hands = [];
  const handFactory = new XRHandModelFactory();

  let supported = false;
  let starting = false;
  let activeSession = null;

  // ===========================================
  // 1. CONFIGURAR EL RENDERIZADOR WEBXR
  // ===========================================

  renderer.xr.enabled = true;

  renderer.xr.setReferenceSpaceType("local-floor");

  // ===========================================
  // 2. CREAR AMBAS MANOS
  // ===========================================

  for (let index = 0; index < 2; index++) {
    const hand = renderer.xr.getHand(index);

    const handModel = handFactory.createHandModel(
      hand,
      "mesh"
    );

    hand.add(handModel);
    scene.add(hand);

    hands.push(hand);
  }

  function setStatus(message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function setButton(label, disabled) {
    if (!button) return;

    button.textContent = label;
    button.disabled = disabled;
  }

  // ===========================================
  // 3. COMPROBAR SOPORTE WEBXR
  // ===========================================

  async function checkSupport() {
    if (!window.isSecureContext) {
      setStatus(
        "WebXR requiere HTTPS o localhost seguro."
      );
      setButton("VR no disponible", true);
      return;
    }

    if (!navigator.xr) {
      setStatus(
        "Este navegador no proporciona WebXR immersive-vr."
      );
      setButton("VR no disponible", true);
      return;
    }

    try {
      supported = await navigator.xr.isSessionSupported(
        "immersive-vr"
      );

      if (supported) {
        setButton("Iniciar realidad virtual", false);

        setStatus(
          "WebXR disponible. Activa el seguimiento de manos en tu visor."
        );
      } else {
        setStatus(
          "Modo escritorio: vista previa no inmersiva."
        );

        setButton("VR no disponible", true);
      }
    } catch (error) {
      console.error(
        "Error comprobando WebXR:",
        error
      );

      setStatus(
        "No fue posible comprobar la compatibilidad VR."
      );
      setButton("VR no disponible", true);
    }
  }

  // ===========================================
  // 4. INICIAR SESIÓN INMERSIVA
  // ===========================================

  async function startSession() {
    if (
      !supported ||
      starting ||
      renderer.xr.isPresenting
    ) {
      return;
    }

    starting = true;
    setButton("Conectando Meta Quest...", true);

    try {
      // El navegador puede solicitar permisos.
      // Hand tracking se solicita como función
      // opcional, pero será necesario para jugar.
      const session = await navigator.xr.requestSession(
        "immersive-vr",
        {
          requiredFeatures: ["local-floor"],
          optionalFeatures: ["hand-tracking"]
        }
      );

      activeSession = session;

      await renderer.xr.setSession(session);

      setButton("Realidad virtual activa", true);

      setStatus(
        "Sesión VR activa. Usa tus manos para tomar las figuras."
      );

      console.log(
        "NEXUS VR: sesión immersive-vr iniciada"
      );
    } catch (error) {
      console.error(
        "No se pudo iniciar WebXR:",
        error
      );

      setButton(
        "Iniciar realidad virtual",
        !supported
      );

      setStatus(
        "Error al iniciar VR. Revisa permisos, HTTPS y compatibilidad."
      );
    } finally {
      starting = false;
    }
  }

  // ===========================================
  // 5. SALIR DE REALIDAD VIRTUAL
  // ===========================================

  async function endSession() {
    const session =
      activeSession || renderer.xr.getSession();

    if (!session) return;

    try {
      // NEXUS_TRAZA_CIERRE_32
      console.trace(
        "NEXUS: nuestro codigo solicito terminar WebXR"
      );
      await session.end();
    } catch (error) {
      console.error(
        "Error al finalizar VR:",
        error
      );
    }
  }

  renderer.xr.addEventListener(
    "sessionend",
    () => {
      activeSession = null;

      setButton(
        "Iniciar realidad virtual",
        !supported
      );

      setStatus(
        "Sesión VR finalizada. Vista previa de escritorio."
      );

      onSessionEnd();

      console.log(
        "NEXUS VR: sesión finalizada"
      );
    }
  );

  renderer.xr.addEventListener(
    "sessionstart",
    () => {
      console.log(
        "NEXUS VR: WebXR conectado"
      );
    }
  );

  // ===========================================
  // 6. BOTÓN DE LA PORTADA
  // ===========================================

  if (button) {
    button.addEventListener("click", () => {
      if (renderer.xr.isPresenting) {
          // NEXUS_XR_SALIDA_SEGURA_32
          // Nunca terminar VR desde un clic accidental.
          console.warn(
            "NEXUS: salida accidental bloqueada"
          );
          return;
        }

        startSession();
    });
  }

  checkSupport();

  return {
    hands,
    startSession,
    endSession,
    isPresenting: () => renderer.xr.isPresenting,
    isSupported: () => supported
  };
}


