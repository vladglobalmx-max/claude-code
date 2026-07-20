import { describe, expect, it } from "vitest";
import { computePdfPageBoxes } from "./pageBoxes.js";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";

function jobFor(pageOverrides: Parameters<typeof buildPage>[2], profile: Parameters<typeof buildPrintJobFor>[1] = "print-pdf") {
  const project = buildProject({ document: buildDocument([buildPage("page_1", [], pageOverrides)]) });
  return buildPrintJobFor(project, profile);
}

describe("computePdfPageBoxes", () => {
  it("A4 (210x297mm) sin bleed produce un MediaBox de ~595x842pt, igual al TrimBox", () => {
    const job = jobFor({ size: { width: 210, height: 297 }, unit: "mm" }, "digital-png");
    const boxes = computePdfPageBoxes(job);
    expect(boxes.mediaWidthPt).toBeCloseTo(595.28, 1);
    expect(boxes.mediaHeightPt).toBeCloseTo(841.89, 1);
    expect(boxes.trimBox).toMatchObject({ x: 0, y: 0 });
    expect(boxes.trimBox.width).toBeCloseTo(boxes.mediaWidthPt, 8);
  });

  it("con bleed estándar (3mm), el TrimBox queda desplazado por igual en los 4 lados", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const boxes = computePdfPageBoxes(job);
    const bleed3mmPt = boxes.trimBox.x; // == bleedLeftPt
    expect(boxes.trimBox.y).toBeCloseTo(bleed3mmPt, 8); // bottom == left con bleed uniforme
    expect(boxes.mediaWidthPt).toBeCloseTo(boxes.trimBox.width + 2 * bleed3mmPt, 8);
  });

  it("con bleed asimétrico, TrimBox.y usa bleedBottom (NUNCA bleedTop)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    job.bleed = { top: 2, right: 4, bottom: 10, left: 8, unit: "mm" };
    const boxes = computePdfPageBoxes(job);
    expect(boxes.trimBox.x).toBeGreaterThan(0); // bleedLeft (8mm)
    expect(boxes.trimBox.y).toBeGreaterThan(boxes.trimBox.x); // bleedBottom (10mm) > bleedLeft (8mm)
    // El espacio que queda POR ENCIMA del trim (mediaHeight - trim.height - trim.y)
    // es el bleedTop (2mm) — menor que el bleedBottom (10mm) usado como trim.y.
    const spaceAboveTrim = boxes.mediaHeightPt - boxes.trimBox.height - boxes.trimBox.y;
    expect(spaceAboveTrim).toBeLessThan(boxes.trimBox.y);
    expect(spaceAboveTrim).toBeGreaterThan(0);
  });

  it("MediaBox == BleedBox == CropBox en Fase 9.2 (sin espacio de marcas todavía)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const boxes = computePdfPageBoxes(job);
    expect(boxes.mediaBox).toEqual(boxes.bleedBox);
    expect(boxes.cropBox).toEqual(boxes.bleedBox);
  });

  it("bleed cero: TrimBox == BleedBox == MediaBox, todos en (0,0)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "digital-png");
    const boxes = computePdfPageBoxes(job);
    expect(boxes.trimBox).toEqual({ x: 0, y: 0, width: boxes.mediaWidthPt, height: boxes.mediaHeightPt });
  });

  it("es el mismo resultado sin importar el contenido — depende solo de dimensions/bleed", () => {
    const job1 = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const job2 = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    expect(computePdfPageBoxes(job1)).toEqual(computePdfPageBoxes(job2));
  });
});
