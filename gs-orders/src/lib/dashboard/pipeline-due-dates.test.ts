import { describe, expect, it } from "vitest";
import { classifyPipelineDueDate, formatDueInDays, PIPELINE_DUE_SOON_THRESHOLD_DAYS } from "./pipeline-due-dates";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("classifyPipelineDueDate", () => {
  it("una fecha pasada es vencido", () => {
    expect(classifyPipelineDueDate("2026-06-14", NOW)).toBe("vencido");
    expect(classifyPipelineDueDate("2026-05-01", NOW)).toBe("vencido");
  });

  it("hoy mismo es próximo a vencer, no vencido", () => {
    expect(classifyPipelineDueDate("2026-06-15", NOW)).toBe("proximo_a_vencer");
  });

  it(`exactamente en el umbral (${PIPELINE_DUE_SOON_THRESHOLD_DAYS} días) sigue siendo próximo a vencer`, () => {
    expect(classifyPipelineDueDate("2026-06-18", NOW)).toBe("proximo_a_vencer");
  });

  it("un día después del umbral ya es en tiempo", () => {
    expect(classifyPipelineDueDate("2026-06-19", NOW)).toBe("en_tiempo");
  });

  it("una fecha muy lejana es en tiempo", () => {
    expect(classifyPipelineDueDate("2026-12-31", NOW)).toBe("en_tiempo");
  });
});

describe("formatDueInDays", () => {
  it("fecha pasada: 'Vencida hace N días'", () => {
    expect(formatDueInDays("2026-06-14", NOW)).toBe("Vencida hace 1 día");
    expect(formatDueInDays("2026-06-10", NOW)).toBe("Vencida hace 5 días");
  });

  it("hoy: 'Vence hoy'", () => {
    expect(formatDueInDays("2026-06-15", NOW)).toBe("Vence hoy");
  });

  it("fecha futura: 'Vence en N días'", () => {
    expect(formatDueInDays("2026-06-16", NOW)).toBe("Vence en 1 día");
    expect(formatDueInDays("2026-06-18", NOW)).toBe("Vence en 3 días");
  });
});
