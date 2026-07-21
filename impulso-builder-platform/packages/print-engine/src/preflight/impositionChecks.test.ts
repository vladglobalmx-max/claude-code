import { describe, expect, it } from "vitest";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import { computeImpositionLayout } from "../imposition/impositionLayout.js";
import { checkImpositionConfig, checkImpositionForPage, mapImpositionLayoutGeometryIssues } from "./impositionChecks.js";
import type { GridImpositionSpec } from "../types.js";

/** Hoja 100x100mm, pieza 20x20mm, gaps/márgenes generosos — capacidad
 * determinista (columns=4, rows=4, capacidad=16) sin marcas ni cut path
 * salvo que el test lo pida explícitamente. */
function gridJob(overrides: Partial<GridImpositionSpec> = {}, jobOverrides: Parameters<typeof buildPrintJobFor>[2] = {}) {
  const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
  const project = buildProject({ document: buildDocument([page]) });
  const imposition: GridImpositionSpec = {
    mode: "grid",
    sheet: { width: 100, height: 100, unit: "mm" },
    orientation: "portrait",
    quantity: 6,
    placementMode: "automatic",
    gapX: 5,
    gapY: 5,
    marginTop: 5,
    marginRight: 5,
    marginBottom: 5,
    marginLeft: 5,
    alignment: "top-left",
    marksMode: "none",
    ...overrides,
  };
  const job = buildPrintJobFor(project, "digital-png", {
    bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
    cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
    imposition,
    ...jobOverrides,
  });
  return { job, pageId: page.id };
}

describe("checkImpositionConfig", () => {
  it("mode 'single': sin issues", () => {
    const { job } = gridJob();
    job.imposition = { mode: "single" };
    expect(checkImpositionConfig(job)).toEqual([]);
  });

  it("configuración válida: sin issues", () => {
    const { job } = gridJob();
    expect(checkImpositionConfig(job)).toEqual([]);
  });

  it("gapX negativo: imposition_invalid", () => {
    const { job } = gridJob({ gapX: -1 });
    const issues = checkImpositionConfig(job);
    expect(issues.some((i) => i.code === "imposition_invalid" && i.severity === "error")).toBe(true);
  });

  it("gapY no finito (NaN): imposition_invalid", () => {
    const { job } = gridJob({ gapY: NaN });
    expect(checkImpositionConfig(job).some((i) => i.code === "imposition_invalid")).toBe(true);
  });

  it("margen negativo (cada uno de los 4 lados): imposition_invalid", () => {
    for (const field of ["marginTop", "marginRight", "marginBottom", "marginLeft"] as const) {
      const { job } = gridJob({ [field]: -5 });
      const issues = checkImpositionConfig(job);
      expect(issues.some((i) => i.code === "imposition_invalid")).toBe(true);
    }
  });

  it("margen Infinity: imposition_invalid", () => {
    const { job } = gridJob({ marginTop: Infinity });
    expect(checkImpositionConfig(job).some((i) => i.code === "imposition_invalid")).toBe(true);
  });

  it("gap 0 sin cut path activo: sin insufficient_gap (piezas a tope es una elección válida sin nada que cortar)", () => {
    const { job } = gridJob({ gapX: 0, gapY: 0 });
    expect(checkImpositionConfig(job)).toEqual([]);
  });

  it("gap más angosto que el grosor del cut path: insufficient_gap (warning)", () => {
    const { job } = gridJob(
      { gapX: 0.1, gapY: 0.1 },
      { cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 1, color: "#ff00ff", logicalLayerName: "DieCut" } },
    );
    const issues = checkImpositionConfig(job);
    expect(issues).toEqual([expect.objectContaining({ code: "insufficient_gap", severity: "warning" })]);
  });

  it("gap igual o más ancho que el grosor del cut path: sin insufficient_gap", () => {
    const { job } = gridJob(
      { gapX: 2, gapY: 2 },
      { cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 1, color: "#ff00ff", logicalLayerName: "DieCut" } },
    );
    expect(checkImpositionConfig(job)).toEqual([]);
  });

  it("gap/margen inválidos: no se evalúa insufficient_gap sobre valores ya inválidos", () => {
    const { job } = gridJob(
      { gapX: -1 },
      { cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 100, color: "#ff00ff", logicalLayerName: "DieCut" } },
    );
    const issues = checkImpositionConfig(job);
    expect(issues.every((i) => i.code === "imposition_invalid")).toBe(true);
  });
});

describe("checkImpositionForPage", () => {
  it("mode 'single': sin issues", () => {
    const { job, pageId } = gridJob();
    job.imposition = { mode: "single" };
    expect(checkImpositionForPage(pageId, job)).toEqual([]);
  });

  it("layout válido y hoja completamente ocupada: sin issues", () => {
    // Área útil 90x90mm (100mm - 5mm margen por lado), pieza 20mm + gap
    // 5mm ⇒ columns=rows=3, capacidad=9 por hoja.
    const { job, pageId } = gridJob({ quantity: 9 }); // capacidad exacta, sin sobrante
    expect(checkImpositionForPage(pageId, job)).toEqual([]);
  });

  it("sheet_size_invalid: hoja con ancho 0", () => {
    const { job, pageId } = gridJob({ sheet: { width: 0, height: 100, unit: "mm" } });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "sheet_size_invalid", severity: "error", pageId })]);
  });

  it("sheet_area_collapsed: márgenes que colapsan el área útil", () => {
    const { job, pageId } = gridJob({ marginLeft: 60, marginRight: 60 }); // 100 - 120 < 0
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "sheet_area_collapsed" })]);
  });

  it("quantity_invalid: cantidad no entera", () => {
    const { job, pageId } = gridJob({ quantity: 1.5 });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "quantity_invalid" })]);
  });

  it("excessive_piece_count: cantidad por encima del límite de producto", () => {
    const { job, pageId } = gridJob({ quantity: 999_999 });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "excessive_piece_count" })]);
  });

  it("grid_rows_invalid: fixed-grid sin rows", () => {
    const { job, pageId } = gridJob({ placementMode: "fixed-grid", columns: 2 });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "grid_rows_invalid" })]);
  });

  it("grid_columns_invalid: fixed-grid sin columns", () => {
    const { job, pageId } = gridJob({ placementMode: "fixed-grid", rows: 2 });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "grid_columns_invalid" })]);
  });

  it("fixed_grid_does_not_fit: rows x columns pedidos no caben en el área útil", () => {
    const { job, pageId } = gridJob({ placementMode: "fixed-grid", rows: 100, columns: 100 });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "fixed_grid_does_not_fit" })]);
  });

  it("piece_does_not_fit: la pieza es más grande que el área útil de la hoja", () => {
    const page = buildPage("page_1", [], { size: { width: 200, height: 200 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "digital-png", {
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: { mode: "grid", sheet: { width: 100, height: 100, unit: "mm" }, orientation: "portrait", quantity: 1, placementMode: "automatic", gapX: 0, gapY: 0, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, alignment: "top-left", marksMode: "none" },
    });
    expect(checkImpositionForPage(page.id, job)).toEqual([expect.objectContaining({ code: "piece_does_not_fit" })]);
  });

  it("excessive_sheet_count: cantidad que requeriría más hojas que el límite de producto (pero sin exceder el límite de piezas)", () => {
    // Capacidad 9/hoja (ver arriba). 1999 <= MAX_IMPOSITION_PIECES (2000)
    // pero ceil(1999/9) = 223 > MAX_IMPOSITION_SHEETS (200).
    const { job, pageId } = gridJob({ quantity: 1999 });
    expect(checkImpositionForPage(pageId, job)).toEqual([expect.objectContaining({ code: "excessive_sheet_count" })]);
  });

  it("sheet_memory_budget_exceeded: el presupuesto de memoria no alcanza para el raster de la hoja completa", () => {
    const { job, pageId } = gridJob({ quantity: 9 }); // capacidad exacta, sin partial_output_required de por medio
    const issues = checkImpositionForPage(pageId, job, 1000); // presupuesto absurdamente bajo
    expect(issues).toEqual([expect.objectContaining({ code: "sheet_memory_budget_exceeded", severity: "error", pageId })]);
  });

  it("partial_output_required (info): la última hoja queda parcialmente ocupada", () => {
    const { job, pageId } = gridJob({ quantity: 5 }); // capacidad 9, sobran 4 celdas en la única hoja
    const issues = checkImpositionForPage(pageId, job);
    expect(issues).toEqual([expect.objectContaining({ code: "partial_output_required", severity: "info", pageId, data: expect.objectContaining({ lastSheetPieceCount: 5, capacityPerSheet: 9, emptyCells: 4 }) })]);
  });

  it("page_not_found (vía el propio computeImpositionLayout): pageId inexistente no revienta, produce sheet_area_collapsed/quantity solo si aplica — en este caso capacidad calculada igual", () => {
    // `computeImpositionLayout` no depende de que la página EXISTA en el
    // Project (es geometría pura sobre `printJob`) — `page_not_found` lo
    // reporta por separado `runPreflight` (Fase 9.1), no este módulo.
    const { job } = gridJob();
    const result = checkImpositionForPage("page_inexistente" as never, job);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("mapImpositionLayoutGeometryIssues", () => {
  it("mode 'single': sin issues", () => {
    const { job, pageId } = gridJob();
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    job.imposition = { mode: "single" };
    expect(mapImpositionLayoutGeometryIssues(result.layout, job, pageId)).toEqual([]);
  });

  it("un layout calculado normalmente nunca produce issues", () => {
    const { job, pageId } = gridJob({ quantity: 6 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    expect(mapImpositionLayoutGeometryIssues(result.layout, job, pageId)).toEqual([]);
  });

  it("piece_outside_sheet: layout corrompido manualmente con una pieza fuera de la hoja", () => {
    const { job, pageId } = gridJob({ quantity: 1 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const corrupted = { ...result.layout, sheets: [{ sheetIndex: 0, pieces: [{ ...result.layout.sheets[0]!.pieces[0]!, footprintPosition: { x: 100000, y: 0 } }] }] };
    expect(mapImpositionLayoutGeometryIssues(corrupted, job, pageId)).toEqual([expect.objectContaining({ code: "piece_outside_sheet", pageId })]);
  });

  it("marksMode 'per-piece' + cutPath activo + footprints solapados: emite AMBOS códigos (crop_marks_overlap y cut_paths_overlap)", () => {
    const { job, pageId } = gridJob(
      { quantity: 2, marksMode: "per-piece" },
      { cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" } },
    );
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const [first, second] = result.layout.sheets[0]!.pieces;
    const corrupted = { ...result.layout, sheets: [{ sheetIndex: 0, pieces: [first!, { ...second!, footprintPosition: { ...first!.footprintPosition } }] }] };
    const issues = mapImpositionLayoutGeometryIssues(corrupted, job, pageId);
    expect(issues.map((i) => i.code).sort()).toEqual(["crop_marks_overlap", "cut_paths_overlap"]);
  });

  it("marksMode 'none' + cutPath 'none' + footprints solapados: no hay nada activo que solaparse, sin issues", () => {
    const { job, pageId } = gridJob({ quantity: 2, marksMode: "none" });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const [first, second] = result.layout.sheets[0]!.pieces;
    const corrupted = { ...result.layout, sheets: [{ sheetIndex: 0, pieces: [first!, { ...second!, footprintPosition: { ...first!.footprintPosition } }] }] };
    expect(mapImpositionLayoutGeometryIssues(corrupted, job, pageId)).toEqual([]);
  });
});
