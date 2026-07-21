import { describe, expect, it } from "vitest";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import { computePieceFootprint, convertPieceFootprint } from "./pieceFootprint.js";

function jobWithCropMarks() {
  const project = buildProject({ document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" })]) });
  return buildPrintJobFor(project, "digital-png", {
    cropMarks: { enabled: false, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" },
  });
}

describe("computePieceFootprint", () => {
  it("marksMode 'none': el footprint es exactamente el BleedBox, sin offset de contenido", () => {
    const job = jobWithCropMarks();
    const footprint = computePieceFootprint(job, "none");
    expect(footprint.width).toBeCloseTo(50, 6);
    expect(footprint.height).toBeCloseTo(50, 6);
    expect(footprint.contentOffset).toEqual({ x: 0, y: 0 });
    expect(footprint.bleedWidth).toBeCloseTo(50, 6);
  });

  it("marksMode 'per-sheet': igual que 'none' — las marcas por hoja no expanden el footprint de cada pieza", () => {
    const job = jobWithCropMarks();
    const none = computePieceFootprint(job, "none");
    const perSheet = computePieceFootprint(job, "per-sheet");
    expect(perSheet).toEqual(none);
  });

  it("marksMode 'per-piece': el footprint crece más allá del BleedBox para dar espacio a las marcas, e ignora cropMarks.enabled original", () => {
    const job = jobWithCropMarks(); // cropMarks.enabled: false en el PrintJob base
    const footprint = computePieceFootprint(job, "per-piece");
    expect(footprint.width).toBeGreaterThan(50);
    expect(footprint.height).toBeGreaterThan(50);
    expect(footprint.contentOffset.x).toBeGreaterThan(0);
    expect(footprint.contentOffset.y).toBeGreaterThan(0);
    expect(footprint.bleedWidth).toBeCloseTo(50, 6); // el BleedBox en sí nunca cambia de tamaño
  });
});

describe("convertPieceFootprint", () => {
  it("misma unidad: devuelve el mismo objeto (atajo, sin viaje de ida y vuelta por pulgadas)", () => {
    const footprint = computePieceFootprint(jobWithCropMarks(), "none");
    expect(convertPieceFootprint(footprint, "mm")).toBe(footprint);
  });

  it("convierte width/height/contentOffset/bleed a la unidad destino", () => {
    const footprint = computePieceFootprint(jobWithCropMarks(), "per-piece");
    const converted = convertPieceFootprint(footprint, "in");
    expect(converted.unit).toBe("in");
    expect(converted.width).toBeCloseTo(footprint.width / 25.4, 6);
    expect(converted.contentOffset.x).toBeCloseTo(footprint.contentOffset.x / 25.4, 6);
    expect(converted.bleedWidth).toBeCloseTo(footprint.bleedWidth / 25.4, 6);
  });
});
