import { describe, expect, it } from "vitest";
import { atLeast, elapsedSinceStart, getTelemetry, recordEvent, recordTiming, resetTelemetry, startJourney } from "./telemetry.js";

describe("telemetry", () => {
  it("no registra nada antes de startJourney()", () => {
    resetTelemetry();
    expect(getTelemetry()).toEqual({ events: [], timings: {} });
    expect(elapsedSinceStart()).toBe(0);
  });

  it("startJourney() reinicia eventos/tiempos previos", () => {
    startJourney();
    recordEvent("intent_detected", { a: 1 });
    startJourney();
    expect(getTelemetry().events).toEqual([]);
  });

  it("recordEvent rechaza nombres de evento desconocidos", () => {
    startJourney();
    expect(() => recordEvent("algo_inventado")).toThrow(/desconocido/);
  });

  it("acepta únicamente los ocho eventos del contrato de Fase 3", () => {
    startJourney();
    const known = [
      "intent_detected",
      "recipe_selected",
      "compositions_generated",
      "quality_passed",
      "proposal_rendered",
      "proposal_selected",
      "svg_exported",
      "journey_completed",
    ];
    for (const name of known) {
      expect(() => recordEvent(name)).not.toThrow();
    }
    expect(getTelemetry().events).toHaveLength(known.length);
  });

  it("recordTiming redondea a milisegundos enteros", () => {
    startJourney();
    recordTiming("interpretacion", 12.7);
    expect(getTelemetry().timings.interpretacion).toBe(13);
  });

  it("getTelemetry devuelve copias — mutarlas no afecta el estado interno", () => {
    startJourney();
    recordEvent("intent_detected");
    const snapshot = getTelemetry();
    snapshot.events.push({ name: "journey_completed", at: 0, payload: null });
    expect(getTelemetry().events).toHaveLength(1);
  });

  it("atLeast nunca resuelve antes del mínimo, incluso si la promesa ya terminó", async () => {
    const start = Date.now();
    await atLeast(Promise.resolve("listo"), 120);
    expect(Date.now() - start).toBeGreaterThanOrEqual(115);
  });

  it("atLeast nunca recorta una promesa que tarda más que el mínimo", async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve("tarde"), 150));
    const start = Date.now();
    const result = await atLeast(slow, 20);
    expect(result).toBe("tarde");
    expect(Date.now() - start).toBeGreaterThanOrEqual(145);
  });

  it("atLeast propaga el resultado real de la promesa", async () => {
    startJourney();
    const result = await atLeast(Promise.resolve({ ok: true }), 10);
    expect(result).toEqual({ ok: true });
  });
});
