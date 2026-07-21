import { describe, expect, it } from "vitest";
import { PageIdSchema } from "@impulso/document-schema";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import { computeImpositionLayout, MAX_IMPOSITION_PIECES, MAX_IMPOSITION_SHEETS } from "./impositionLayout.js";
import type { GridImpositionSpec, PrintJob } from "../types.js";

function gridJob(impositionOverrides: Partial<GridImpositionSpec> = {}, pageSize = { width: 50, height: 50 }): { job: PrintJob; pageId: ReturnType<typeof PageIdSchema.parse> } {
  const page = buildPage("page_1", [], { size: pageSize, unit: "mm" });
  const project = buildProject({ document: buildDocument([page]) });
  const imposition: GridImpositionSpec = {
    mode: "grid",
    sheet: { width: 210, height: 297, unit: "mm" },
    orientation: "portrait",
    quantity: 1,
    placementMode: "automatic",
    gapX: 0,
    gapY: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    alignment: "top-left",
    marksMode: "none",
    ...impositionOverrides,
  };
  const job = buildPrintJobFor(project, "digital-png", { imposition });
  return { job, pageId: page.id };
}

describe("computeImpositionLayout — validación básica", () => {
  it("sheet inválido (0/negativo/NaN): sheet_size_invalid", () => {
    for (const size of [0, -10, NaN]) {
      const { job, pageId } = gridJob({ sheet: { width: size, height: 297, unit: "mm" } });
      expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "sheet_size_invalid" });
    }
  });

  it("quantity inválida (0/negativa/fraccionaria): quantity_invalid", () => {
    for (const quantity of [0, -1, 1.5]) {
      const { job, pageId } = gridJob({ quantity });
      expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "quantity_invalid" });
    }
  });

  it("márgenes que colapsan el área útil: sheet_area_collapsed", () => {
    const { job, pageId } = gridJob({ marginLeft: 110, marginRight: 110 });
    expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "sheet_area_collapsed" });
  });

  it("pieza más grande que el área útil (automatic): piece_does_not_fit", () => {
    const { job, pageId } = gridJob({}, { width: 300, height: 300 });
    expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "piece_does_not_fit" });
  });

  it("fixed-grid que no cabe: fixed_grid_does_not_fit", () => {
    const { job, pageId } = gridJob({ placementMode: "fixed-grid", rows: 100, columns: 100 });
    expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "fixed_grid_does_not_fit" });
  });

  it("quantity por encima del límite de producto: excessive_piece_count", () => {
    const { job, pageId } = gridJob({ quantity: MAX_IMPOSITION_PIECES + 1 });
    expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "excessive_piece_count" });
  });

  it("sheetCount por encima del límite de producto: excessive_sheet_count", () => {
    // 1 pieza por hoja (sheet apenas más grande que la pieza) — con
    // quantity = MAX_IMPOSITION_SHEETS + 1 (todavía <= MAX_IMPOSITION_PIECES),
    // se necesitarían más hojas que el límite permitido.
    const { job, pageId } = gridJob({ sheet: { width: 55, height: 55, unit: "mm" }, quantity: MAX_IMPOSITION_SHEETS + 1 });
    expect(computeImpositionLayout(job, pageId)).toEqual({ ok: false, reason: "excessive_sheet_count" });
  });

  it("lanza si se invoca con mode 'single' (error de programación del caller, no un caso de negocio)", () => {
    const { job, pageId } = gridJob();
    const singleJob: PrintJob = { ...job, imposition: { mode: "single" } };
    expect(() => computeImpositionLayout(singleJob, pageId)).toThrow();
  });
});

describe("computeImpositionLayout — capacidad y colocación", () => {
  it("una sola pieza cabe en una sola hoja", () => {
    const { job, pageId } = gridJob({ quantity: 1 });
    const result = computeImpositionLayout(job, pageId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layout.rows).toBe(5);
    expect(result.layout.columns).toBe(4);
    expect(result.layout.capacityPerSheet).toBe(20);
    expect(result.layout.sheetCount).toBe(1);
    expect(result.layout.sheets[0]!.pieces).toHaveLength(1);
    expect(result.layout.sheets[0]!.pieces[0]!.footprintPosition).toEqual({ x: 0, y: 0 });
  });

  it("quantity > capacidad: múltiples hojas, la última parcialmente ocupada", () => {
    const { job, pageId } = gridJob({ quantity: 25 }); // capacidad 20 por hoja
    const result = computeImpositionLayout(job, pageId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layout.sheetCount).toBe(2);
    expect(result.layout.sheets[0]!.pieces).toHaveLength(20);
    expect(result.layout.sheets[1]!.pieces).toHaveLength(5);
    expect(result.layout.lastSheetPieceCount).toBe(5);
    expect(result.layout.lastSheetEmptyCells).toBe(15);
  });

  it("nunca rellena celdas vacías con copias fantasma", () => {
    const { job, pageId } = gridJob({ quantity: 3 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    expect(result.layout.sheets[0]!.pieces).toHaveLength(3);
  });

  it("orden determinista: filas de arriba hacia abajo, columnas de izquierda a derecha, copyIndex estable", () => {
    const { job, pageId } = gridJob({ quantity: 6 }); // columns=4, así que llena fila 0 (4) y parte de la fila 1 (2)
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const pieces = result.layout.sheets[0]!.pieces;
    expect(pieces.map((p) => [p.row, p.column, p.copyIndex])).toEqual([
      [0, 0, 0],
      [0, 1, 1],
      [0, 2, 2],
      [0, 3, 3],
      [1, 0, 4],
      [1, 1, 5],
    ]);
  });

  it("gaps se reflejan en la posición física de cada pieza colocada", () => {
    const { job, pageId } = gridJob({ quantity: 2, gapX: 10, gapY: 10 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const [first, second] = result.layout.sheets[0]!.pieces;
    expect(second!.footprintPosition.x - first!.footprintPosition.x).toBeCloseTo(50 + 10, 6);
  });

  it("márgenes desplazan el origen del grid completo", () => {
    const { job, pageId } = gridJob({ quantity: 1, marginTop: 10, marginLeft: 15 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    expect(result.layout.sheets[0]!.pieces[0]!.footprintPosition).toEqual({ x: 15, y: 10 });
  });

  it("alineación 'center' centra el grid dentro del área útil restante", () => {
    const { job, pageId } = gridJob({ placementMode: "fixed-grid", rows: 1, columns: 1, alignment: "center" });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const piece = result.layout.sheets[0]!.pieces[0]!;
    expect(piece.footprintPosition.x).toBeCloseTo((210 - 50) / 2, 6);
    expect(piece.footprintPosition.y).toBeCloseTo((297 - 50) / 2, 6);
  });

  it("landscape: la capacidad refleja las dimensiones de hoja intercambiadas", () => {
    const { job, pageId } = gridJob({ orientation: "landscape" });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    expect(result.layout.sheet.width).toBe(297);
    expect(result.layout.sheet.height).toBe(210);
  });

  it("unidades distintas entre hoja y pieza: se normalizan antes de calcular capacidad", () => {
    const { job, pageId } = gridJob({ sheet: { width: 10, height: 10, unit: "in" } }); // pieza declarada en mm (50x50)
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    expect(result.layout.unit).toBe("in");
    // 50mm ≈ 1.9685in; 10in de área útil / 1.9685in ≈ 5 columnas/filas.
    expect(result.layout.columns).toBe(5);
    expect(result.layout.rows).toBe(5);
  });

  it("marksMode 'per-piece' reduce la capacidad frente a 'none' (el footprint es más grande)", () => {
    const cropMarks = { enabled: false, length: 5, offset: 3, strokeWidth: 0.25, unit: "mm" as const, color: "#000000" };
    const { job: noneJob, pageId } = gridJob({ marksMode: "none" });
    const { job: perPieceJob } = gridJob({ marksMode: "per-piece" });
    noneJob.cropMarks = cropMarks;
    perPieceJob.cropMarks = cropMarks;

    const noneResult = computeImpositionLayout(noneJob, pageId);
    const perPieceResult = computeImpositionLayout(perPieceJob, pageId);
    if (!noneResult.ok || !perPieceResult.ok) throw new Error("se esperaban layouts válidos");
    expect(perPieceResult.layout.capacityPerSheet).toBeLessThan(noneResult.layout.capacityPerSheet);
  });

  it("todas las piezas de un pageId dado llevan ese mismo pageId", () => {
    const { job, pageId } = gridJob({ quantity: 5 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    for (const sheet of result.layout.sheets) {
      for (const piece of sheet.pieces) expect(piece.pageId).toBe(pageId);
    }
  });
});
