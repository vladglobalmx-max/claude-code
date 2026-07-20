import { describe, expect, it } from "vitest";
import { checkCropMarksConfig, checkCropMarksGeometry } from "./cropMarksChecks.js";
import { buildPrintJobFor, buildDocument, buildPage, buildProject } from "../testUtils/fixtures.js";

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
});
