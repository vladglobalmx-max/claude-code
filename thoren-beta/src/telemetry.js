/**
 * Instrumentación silenciosa — Fase 3 (Experience Integration).
 *
 * Registra únicamente los eventos y tiempos internos pedidos, sin tocar
 * absolutamente nada de la experiencia: nunca se muestra al usuario salvo
 * dentro del panel de `?beta=true` (ver main.js). No hay dashboards ni
 * envío a ningún servidor — es solo un registro en memoria, preparado
 * para futuras pruebas de usabilidad.
 */

const KNOWN_EVENTS = [
  "intent_detected",
  "recipe_selected",
  "compositions_generated",
  "quality_passed",
  "proposal_rendered",
  "proposal_selected",
  "svg_exported",
  "journey_completed",
];

let events = [];
let timings = {};
let journeyStartedAt = null;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function resetTelemetry() {
  events = [];
  timings = {};
  journeyStartedAt = null;
}

/** Marca el inicio de un recorrido (el usuario acaba de enviar su frase). */
export function startJourney() {
  resetTelemetry();
  journeyStartedAt = now();
}

/** Milisegundos transcurridos desde `startJourney()`, o 0 si no ha empezado. */
export function elapsedSinceStart() {
  return journeyStartedAt == null ? 0 : now() - journeyStartedAt;
}

export function recordEvent(name, payload) {
  if (!KNOWN_EVENTS.includes(name)) {
    throw new Error(`Evento de telemetría desconocido: "${name}"`);
  }
  events.push({ name, at: Math.round(elapsedSinceStart()), payload: payload ?? null });
}

export function recordTiming(key, ms) {
  timings[key] = Math.round(ms);
}

export function getTelemetry() {
  return { events: events.slice(), timings: { ...timings } };
}

/**
 * Espera `promise`, pero nunca resuelve antes de `minMs` — el ritmo
 * aprobado del Experience Blueprint es un piso, nunca un techo: si el
 * Motor Creativo termina antes, la experiencia sigue esperando el mínimo
 * ya afinado; si el motor tarda más, jamás se recorta esa espera real.
 */
export async function atLeast(promise, minMs) {
  const [result] = await Promise.all([promise, new Promise((resolve) => setTimeout(resolve, minMs))]);
  return result;
}
