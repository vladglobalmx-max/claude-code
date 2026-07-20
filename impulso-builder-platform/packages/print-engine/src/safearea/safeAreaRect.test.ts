import { describe, expect, it } from "vitest";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import { computeSafeAreaCanonicalRect } from "./safeAreaRect.js";

function jobFor(pageOverrides: Parameters<typeof buildPage>[2], jobOverrides: Parameters<typeof buildPrintJobFor>[2] = {}) {
  const project = buildProject({ document: buildDocument([buildPage("page_1", [], pageOverrides)]) });
  return buildPrintJobFor(project, "print-pdf", jobOverrides);
}

describe("computeSafeAreaCanonicalRect", () => {
  it("deshabilitado: undefined", () => {
    const job = jobFor({ size: { width: 100, height: 100 }, unit: "px" }, { safeArea: { enabled: false, margin: 0, unit: "mm" } });
    expect(computeSafeAreaCanonicalRect(job)).toBeUndefined();
  });

  it("página en px, margen en px: resta el margen directamente, sin conversión intermedia", () => {
    const job = jobFor({ size: { width: 100, height: 100 }, unit: "px" }, { safeArea: { enabled: true, margin: 10, unit: "px" } });
    expect(computeSafeAreaCanonicalRect(job)).toEqual({ x: 10, y: 10, width: 80, height: 80 });
  });

  it("margen en una unidad distinta a la página (mm sobre página px): se convierte a px canónico", () => {
    const job = jobFor({ size: { width: 960, height: 960 }, unit: "px" }, { safeArea: { enabled: true, margin: 25.4, unit: "mm" } }); // 25.4mm == 1in == 96px canónico
    const rect = computeSafeAreaCanonicalRect(job)!;
    expect(rect.x).toBeCloseTo(96, 6);
    expect(rect.width).toBeCloseTo(960 - 2 * 96, 6);
  });

  it("margen mayor a la mitad del trim: nunca produce un tamaño negativo", () => {
    const job = jobFor({ size: { width: 10, height: 10 }, unit: "px" }, { safeArea: { enabled: true, margin: 100, unit: "px" } });
    const rect = computeSafeAreaCanonicalRect(job)!;
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });
});
