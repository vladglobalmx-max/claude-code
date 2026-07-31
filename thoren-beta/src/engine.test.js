import { describe, expect, it } from "vitest";
import { markJourneyCompleted, markProposalRendered, markProposalSelected, runJourney } from "./engine.js";
import { getTelemetry } from "./telemetry.js";

/**
 * Estas pruebas llaman al Motor Creativo REAL (@impulso/creative-engine,
 * vía el alias del monorepo en vite.config.js) — nada está simulado.
 * Confirman que la Beta lo integra correctamente: ninguna propuesta viene
 * de un SVG hardcodeado, y la instrumentación registra los ocho eventos
 * del contrato de Fase 3.
 */
describe("runJourney (integración real con @impulso/creative-engine)", () => {
  it("produce 3 propuestas reales, cada una con su propio SVG exportado", async () => {
    const proposals = await runJourney("Etiquetas para la boda de Marcela y Andrés");
    expect(proposals).toHaveLength(3);

    const archetypeIds = proposals.map((p) => p.archetypeId).sort();
    expect(archetypeIds).toEqual(["composicion-asimetrica", "insignia-doble-filete", "monograma-anillo"].sort());

    for (const proposal of proposals) {
      expect(proposal.svg.startsWith("<svg")).toBe(true);
      expect(proposal.svg.toLowerCase()).toContain("marcela");
    }

    // Ninguna propuesta comparte el mismo SVG que otra — son composiciones distintas, no copias.
    expect(new Set(proposals.map((p) => p.svg)).size).toBe(3);
  });

  it("registra los eventos y tiempos internos de la fase de generación", async () => {
    await runJourney("Boda de Ana y Luis");
    const telemetry = getTelemetry();
    const eventNames = telemetry.events.map((e) => e.name);

    expect(eventNames).toContain("intent_detected");
    expect(eventNames).toContain("recipe_selected");
    expect(eventNames).toContain("compositions_generated");
    expect(eventNames).toContain("quality_passed");
    expect(eventNames.filter((n) => n === "svg_exported")).toHaveLength(3);

    expect(telemetry.timings).toHaveProperty("interpretacion");
    expect(telemetry.timings).toHaveProperty("composicion");
    expect(telemetry.timings).toHaveProperty("validacion");
    expect(telemetry.timings).toHaveProperty("exportacion");
    expect(telemetry.timings).toHaveProperty("tiempoHastaPrimeraPropuesta");
    expect(telemetry.timings).toHaveProperty("tiempoHastaLoteCompleto");
  });

  it("funciona con una frase corta, sin nombres — nunca bloquea el flujo", async () => {
    const proposals = await runJourney("etiquetas para mi boda");
    expect(proposals).toHaveLength(3);
  });
});

describe("marcadores de UI (proposal_rendered / proposal_selected / journey_completed)", () => {
  it("cada uno agrega exactamente un evento con el archetypeId correcto", async () => {
    await runJourney("Boda de Marcela y Andrés");
    markProposalRendered("monograma-anillo");
    markProposalRendered("insignia-doble-filete");
    markProposalSelected("insignia-doble-filete");
    markJourneyCompleted();

    const events = getTelemetry().events;
    const rendered = events.filter((e) => e.name === "proposal_rendered");
    const selected = events.filter((e) => e.name === "proposal_selected");
    const completed = events.filter((e) => e.name === "journey_completed");

    expect(rendered).toHaveLength(2);
    expect(selected).toEqual([expect.objectContaining({ payload: { archetypeId: "insignia-doble-filete" } })]);
    expect(completed).toHaveLength(1);
    expect(getTelemetry().timings).toHaveProperty("total");
  });
});
