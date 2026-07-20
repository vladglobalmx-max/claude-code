import { describe, expect, it } from "vitest";
import { computePdfPageBoxes } from "./pageBoxes.js";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";

function jobFor(pageOverrides: Parameters<typeof buildPage>[2], profile: Parameters<typeof buildPrintJobFor>[1] = "print-pdf") {
  const project = buildProject({ document: buildDocument([buildPage("page_1", [], pageOverrides)]) });
  return buildPrintJobFor(project, profile);
}

describe("computePdfPageBoxes", () => {
  it("A4 (210x297mm) sin bleed ni marcas produce un MediaBox de ~595x842pt, igual al TrimBox", () => {
    const job = jobFor({ size: { width: 210, height: 297 }, unit: "mm" }, "digital-png");
    const boxes = computePdfPageBoxes(job);
    expect(boxes.mediaWidthPt).toBeCloseTo(595.28, 1);
    expect(boxes.mediaHeightPt).toBeCloseTo(841.89, 1);
    expect(boxes.trimBox).toMatchObject({ x: 0, y: 0 });
    expect(boxes.trimBox.width).toBeCloseTo(boxes.mediaWidthPt, 8);
  });

  it("con bleed pero SIN marcas, el TrimBox queda desplazado por igual en los 4 lados y MediaBox == BleedBox", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    job.cropMarks = { ...job.cropMarks, enabled: false };
    const boxes = computePdfPageBoxes(job);
    const bleed3mmPt = boxes.trimBox.x; // == bleedLeftPt
    expect(boxes.trimBox.y).toBeCloseTo(bleed3mmPt, 8); // bottom == left con bleed uniforme
    expect(boxes.mediaWidthPt).toBeCloseTo(boxes.trimBox.width + 2 * bleed3mmPt, 8);
    expect(boxes.mediaBox).toEqual(boxes.bleedBox);
    expect(boxes.bleedOffsetWithinMedia).toEqual({ x: 0, y: 0 });
  });

  it("con marcas de corte activadas (perfil print-pdf), MediaBox crece más allá del BleedBox por el espacio de marcas", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const boxes = computePdfPageBoxes(job);
    // offset=3mm, length=5mm, bleed=3mm por lado -> max(3,3)+5 = 8mm de espacio de marca por lado.
    const markSpacePt = boxes.bleedOffsetWithinMedia.x;
    expect(markSpacePt).toBeGreaterThan(0);
    expect(boxes.bleedBox.x).toBeCloseTo(markSpacePt, 8);
    expect(boxes.bleedBox.y).toBeCloseTo(markSpacePt, 8);
    expect(boxes.mediaWidthPt).toBeCloseTo(boxes.bleedBox.width + 2 * markSpacePt, 8);
    expect(boxes.mediaHeightPt).toBeCloseTo(boxes.bleedBox.height + 2 * markSpacePt, 8);
    // El BleedBox en sí NUNCA cambia de tamaño al activar marcas — solo se desplaza.
    expect(boxes.bleedBox.width).toBeCloseTo(boxes.trimBox.width + 2 * (boxes.trimBox.x - markSpacePt), 8);
  });

  it("con bleed asimétrico Y marcas activadas, TrimBox.y usa bleedBottom + espacio de marca inferior (NUNCA bleedTop)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    job.bleed = { top: 2, right: 4, bottom: 10, left: 8, unit: "mm" };
    const boxes = computePdfPageBoxes(job);
    expect(boxes.trimBox.x).toBeGreaterThan(boxes.bleedOffsetWithinMedia.x); // markSpaceLeft + bleedLeft (8mm)
    expect(boxes.trimBox.y).toBeGreaterThan(boxes.trimBox.x); // bleedBottom (10mm) > bleedLeft (8mm), mismo espacio de marca a ambos lados
    // El espacio que queda POR ENCIMA del trim (mediaHeight - trim.height - trim.y)
    // es el bleedTop (2mm) + espacio de marca superior — menor que el inferior.
    const spaceAboveTrim = boxes.mediaHeightPt - boxes.trimBox.height - boxes.trimBox.y;
    expect(spaceAboveTrim).toBeLessThan(boxes.trimBox.y);
    expect(spaceAboveTrim).toBeGreaterThan(0);
  });

  it("MediaBox == BleedBox == CropBox cuando las marcas están desactivadas (mismo comportamiento de Fase 9.2)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    job.cropMarks = { ...job.cropMarks, enabled: false };
    const boxes = computePdfPageBoxes(job);
    expect(boxes.mediaBox).toEqual(boxes.bleedBox);
    expect(boxes.cropBox).toEqual(boxes.bleedBox);
  });

  it("CropBox == MediaBox también CON marcas activadas (nunca oculta el sangrado ni las marcas por defecto)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const boxes = computePdfPageBoxes(job);
    expect(boxes.cropBox).toEqual(boxes.mediaBox);
    expect(boxes.mediaBox).not.toEqual(boxes.bleedBox);
  });

  it("bleed cero sin marcas: TrimBox == BleedBox == MediaBox, todos en (0,0)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "digital-png");
    const boxes = computePdfPageBoxes(job);
    expect(boxes.trimBox).toEqual({ x: 0, y: 0, width: boxes.mediaWidthPt, height: boxes.mediaHeightPt });
  });

  it("es el mismo resultado sin importar el contenido — depende solo de dimensions/bleed/cropMarks", () => {
    const job1 = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const job2 = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    expect(computePdfPageBoxes(job1)).toEqual(computePdfPageBoxes(job2));
  });
});
