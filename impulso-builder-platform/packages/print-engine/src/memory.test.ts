import { describe, expect, it } from "vitest";
import { estimateMemoryBytes, DEFAULT_MEMORY_BUDGET_BYTES, MEMORY_OVERHEAD_FACTOR } from "./memory.js";

describe("estimateMemoryBytes", () => {
  it("rasterBytes es exactamente width*height*4 (RGBA) — la base, no el total", () => {
    const estimate = estimateMemoryBytes({ canvasWidthPx: 1000, canvasHeightPx: 500 });
    expect(estimate.rasterBytes).toBe(1000 * 500 * 4);
  });

  it("totalEstimatedBytes NUNCA es igual a rasterBytes — siempre aplica overhead (corrección 8)", () => {
    const estimate = estimateMemoryBytes({ canvasWidthPx: 1000, canvasHeightPx: 500 });
    expect(estimate.totalEstimatedBytes).toBeGreaterThan(estimate.rasterBytes);
    expect(estimate.totalEstimatedBytes).toBe(estimate.rasterBytes * MEMORY_OVERHEAD_FACTOR);
  });

  it("simultaneousPages multiplica el total, no el raster base de una sola pieza", () => {
    const one = estimateMemoryBytes({ canvasWidthPx: 1000, canvasHeightPx: 500, simultaneousPages: 1 });
    const three = estimateMemoryBytes({ canvasWidthPx: 1000, canvasHeightPx: 500, simultaneousPages: 3 });
    expect(three.rasterBytes).toBe(one.rasterBytes);
    expect(three.totalEstimatedBytes).toBe(one.totalEstimatedBytes * 3);
  });

  it("withinBudget es true cuando el total no excede el presupuesto (por defecto 256MB)", () => {
    const estimate = estimateMemoryBytes({ canvasWidthPx: 100, canvasHeightPx: 100 });
    expect(estimate.withinBudget).toBe(true);
    expect(estimate.budgetBytes).toBe(DEFAULT_MEMORY_BUDGET_BYTES);
  });

  it("withinBudget es false para un canvas gigante que excede el presupuesto", () => {
    // ~10000x10000 RGBA * overhead ya excede 256MB.
    const estimate = estimateMemoryBytes({ canvasWidthPx: 10_000, canvasHeightPx: 10_000 });
    expect(estimate.withinBudget).toBe(false);
  });

  it("acepta un presupuesto custom (perfiles distintos podrían necesitar uno propio)", () => {
    const estimate = estimateMemoryBytes({ canvasWidthPx: 1000, canvasHeightPx: 1000 }, 1000);
    expect(estimate.withinBudget).toBe(false);
    expect(estimate.budgetBytes).toBe(1000);
  });

  it("canvas de tamaño 0 nunca produce NaN/Infinity", () => {
    const estimate = estimateMemoryBytes({ canvasWidthPx: 0, canvasHeightPx: 0 });
    expect(estimate.rasterBytes).toBe(0);
    expect(estimate.totalEstimatedBytes).toBe(0);
    expect(estimate.withinBudget).toBe(true);
  });
});
