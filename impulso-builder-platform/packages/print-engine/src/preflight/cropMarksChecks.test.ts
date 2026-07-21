import { describe, expect, it, vi } from "vitest";
import { checkCropMarksConfig, checkCropMarksGeometry } from "./cropMarksChecks.js";
import { buildPrintJobFor, buildDocument, buildPage, buildProject } from "../testUtils/fixtures.js";
import * as boxesModule from "../boxes.js";
import * as cropMarksGeometryModule from "../marks/cropMarksGeometry.js";

function jobWithCropMarks(overrides: NonNullable<Parameters<typeof buildPrintJobFor>[2]>["cropMarks"]) {
  const project = buildProject({ document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" })]) });
  return buildPrintJobFor(project, "print-pdf", { cropMarks: overrides });
}

describe("checkCropMarksConfig", () => {
  it("deshabilitado: sin issues, sin importar el resto de los valores", () => {
    const job = jobWithCropMarks({ enabled: false, length: -1, offset: -1, strokeWidth: -1, unit: "mm", color: "no-valido" });
    expect(checkCropMarksConfig(job)).toEqual([]);
  });

  it("configuración válida: sin issues", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    expect(checkCropMarksConfig(job)).toEqual([]);
  });

  it("length <= 0: crop_marks_invalid", () => {
    const job = jobWithCropMarks({ enabled: true, length: 0, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    const issues = checkCropMarksConfig(job);
    expect(issues.some((i) => i.code === "crop_marks_invalid" && i.severity === "error")).toBe(true);
  });

  it("strokeWidth <= 0: crop_marks_invalid", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: 3, strokeWidth: 0, unit: "mm", color: "#000000" });
    expect(checkCropMarksConfig(job).some((i) => i.code === "crop_marks_invalid")).toBe(true);
  });

  it("offset negativo: crop_marks_invalid", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: -1, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    expect(checkCropMarksConfig(job).some((i) => i.code === "crop_marks_invalid")).toBe(true);
  });

  it("color no-hex: crop_marks_invalid", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "red" });
    expect(checkCropMarksConfig(job).some((i) => i.code === "crop_marks_invalid")).toBe(true);
  });

  it("valores no finitos (NaN/Infinity): crop_marks_invalid", () => {
    const job = jobWithCropMarks({ enabled: true, length: NaN, offset: Infinity, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    const issues = checkCropMarksConfig(job);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.every((i) => i.code === "crop_marks_invalid" && i.severity === "error")).toBe(true);
  });
});

describe("checkCropMarksGeometry", () => {
  it("deshabilitado: sin issues", () => {
    const job = jobWithCropMarks({ enabled: false, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    expect(checkCropMarksGeometry(job)).toEqual([]);
  });

  it("configuración válida y normal: sin issues (las marcas caben, no invaden el trim)", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    expect(checkCropMarksGeometry(job)).toEqual([]);
  });

  /**
   * Redes de seguridad puramente DEFENSIVAS (Fase 9.5, error injection) —
   * matemáticamente inalcanzables a través de cualquier `PrintJob` válido
   * (`checkCropMarksConfig` ya garantiza `length > 0`, lo que hace que
   * `computeBoxes` SIEMPRE produzca un MediaBox ≥ BleedBox; ver fórmula en
   * `boxes.ts`). Se verifican corrompiendo deliberadamente el resultado de
   * `computeBoxes`/`computeCropMarksGeometry` — mismo patrón ya establecido
   * en `impositionChecks.test.ts` ("layout corrompido manualmente") para la
   * misma clase de invariante interno, nunca alcanzable desde datos de
   * usuario reales.
   */
  it("insufficient_mark_space: si computeBoxes alguna vez produjera un MediaBox más chico que el BleedBox", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    const spy = vi.spyOn(boxesModule, "computeBoxes").mockReturnValue({
      trim: { width: 50, height: 50, unit: "mm" },
      bleed: { width: 60, height: 60, unit: "mm" },
      media: { width: 55, height: 55, unit: "mm" }, // corrompido: media < bleed
      safeArea: { width: 50, height: 50, unit: "mm" },
      trimOffsetWithinBleed: { x: 5, y: 5 },
      trimOffsetWithinMedia: { x: 7.5, y: 7.5 },
      safeAreaOffsetWithinTrim: { x: 0, y: 0 },
      bleedPerSide: { top: 5, right: 5, bottom: 5, left: 5 },
      bleedOffsetWithinMedia: { x: 2.5, y: 2.5 },
    });
    try {
      const issues = checkCropMarksGeometry(job);
      expect(issues).toEqual([
        expect.objectContaining({ code: "insufficient_mark_space", severity: "error" }),
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it("crop_marks_outside_media_box / crop_marks_overlap_trim: si computeCropMarksGeometry alguna vez produjera segmentos fuera de sus propios invariantes", () => {
    const job = jobWithCropMarks({ enabled: true, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" });
    const spy = vi.spyOn(cropMarksGeometryModule, "computeCropMarksGeometry").mockReturnValue([
      // Un segmento bien fuera del MediaBox real (~66x66mm para esta config).
      { from: { x: -100, y: -100 }, to: { x: -50, y: -50 }, unit: "mm", strokeWidth: 0.25, color: "#000000" },
      // Un segmento cuyo punto medio del TrimBox (7.5..57.5mm) invade el trim.
      { from: { x: 30, y: 30 }, to: { x: 32, y: 32 }, unit: "mm", strokeWidth: 0.25, color: "#000000" },
    ]);
    try {
      const issues = checkCropMarksGeometry(job);
      const codes = issues.map((i) => i.code).sort();
      expect(codes).toEqual(["crop_marks_outside_media_box", "crop_marks_overlap_trim"]);
    } finally {
      spy.mockRestore();
    }
  });
});
