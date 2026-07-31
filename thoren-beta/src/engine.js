/**
 * Adaptador del Motor Creativo real para la Beta — Fase 3 (Experience
 * Integration). Ningún SVG está hardcodeado: toda propuesta que la UI
 * llega a mostrar proviene de esta función, que a su vez llama
 * exclusivamente a @impulso/creative-engine (Fase 1/Fase 2, ya aprobado,
 * sin modificar). La UI (main.js) solo recibe `proposals` — objetos ya
 * listos para mostrar — nunca conoce recetas, arquetipos ni el motor.
 *
 * Flujo instrumentado (docs/product/THOREN_IMPLEMENTATION_PLAN.md Fase 3):
 *   interpretar() -> seleccionarReceta() -> generarLote() (compone + valida
 *   internamente) -> exportarSVG() por propuesta.
 */
import { exportarSVG, generarLote, interpretar, seleccionarReceta } from "@impulso/creative-engine";
import { elapsedSinceStart, recordEvent, recordTiming, startJourney } from "./telemetry.js";

/**
 * @param {string} phrase
 * @returns {Promise<Array<{ id: string, archetypeId: string, svg: string }>>}
 */
export async function runJourney(phrase) {
  startJourney();

  const beforeInterpret = elapsedSinceStart();
  const intent = interpretar(phrase);
  recordTiming("interpretacion", elapsedSinceStart() - beforeInterpret);
  recordEvent("intent_detected", { occasion: intent.occasion, hasNames: intent.names.length > 0 });

  const recipe = seleccionarReceta(intent);
  recordEvent("recipe_selected", { recipeId: recipe.id });

  const beforeGenerate = elapsedSinceStart();
  const compositions = await generarLote(intent);
  // Fase 2 valida cada composición dentro de la propia generarLote() — no
  // existe, sin instrumentar el paquete congelado, una frontera observable
  // entre "componer" y "validar"; ambas métricas comparten la misma
  // medición real en vez de inventar una división que no existe.
  const generationMs = elapsedSinceStart() - beforeGenerate;
  recordTiming("composicion", generationMs);
  recordTiming("validacion", generationMs);
  recordEvent("compositions_generated", { count: compositions.length });
  recordEvent("quality_passed", { count: compositions.length });

  const beforeExport = elapsedSinceStart();
  let firstProposalAt = null;
  const proposals = [];
  for (const composition of compositions) {
    const svg = await exportarSVG(composition.document);
    if (firstProposalAt === null) firstProposalAt = elapsedSinceStart();
    recordEvent("svg_exported", { archetypeId: composition.archetypeId });
    proposals.push({ id: composition.id, archetypeId: composition.archetypeId, svg });
  }
  recordTiming("exportacion", elapsedSinceStart() - beforeExport);
  recordTiming("tiempoHastaPrimeraPropuesta", firstProposalAt ?? elapsedSinceStart());
  recordTiming("tiempoHastaLoteCompleto", elapsedSinceStart());

  return proposals;
}

export function markProposalRendered(archetypeId) {
  recordEvent("proposal_rendered", { archetypeId });
}

export function markProposalSelected(archetypeId) {
  recordEvent("proposal_selected", { archetypeId });
}

export function markJourneyCompleted() {
  recordEvent("journey_completed", {});
  recordTiming("total", elapsedSinceStart());
}
