import { describe, expect, it } from "vitest";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import { computeImpositionLayout } from "./impositionLayout.js";
import { validateImpositionLayoutGeometry } from "./validateLayoutGeometry.js";
import type { GridImpositionSpec } from "../types.js";

function gridJob(overrides: Partial<GridImpositionSpec> = {}) {
  const page = buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" });
  const project = buildProject({ document: buildDocument([page]) });
  const imposition: GridImpositionSpec = {
    mode: "grid",
    sheet: { width: 210, height: 297, unit: "mm" },
    orientation: "portrait",
    quantity: 6,
    placementMode: "automatic",
    gapX: 5,
    gapY: 5,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    alignment: "top-left",
    marksMode: "none",
    ...overrides,
  };
  const job = buildPrintJobFor(project, "digital-png", { imposition });
  return { job, pageId: page.id };
}

describe("validateImpositionLayoutGeometry", () => {
  it("un layout calculado normalmente nunca produce issues (la garantía real, no solo asumida)", () => {
    const { job, pageId } = gridJob();
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    expect(validateImpositionLayoutGeometry(result.layout)).toEqual([]);
  });

  it("detecta una pieza fuera de la hoja si el layout se corrompe manualmente", () => {
    const { job, pageId } = gridJob({ quantity: 1 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const corrupted = { ...result.layout, sheets: [{ sheetIndex: 0, pieces: [{ ...result.layout.sheets[0]!.pieces[0]!, footprintPosition: { x: 100000, y: 0 } }] }] };
    const issues = validateImpositionLayoutGeometry(corrupted);
    expect(issues).toEqual([{ code: "piece_outside_sheet", sheetIndex: 0, copyIndex: 0 }]);
  });

  it("detecta dos piezas solapadas si el layout se corrompe manualmente", () => {
    const { job, pageId } = gridJob({ quantity: 2 });
    const result = computeImpositionLayout(job, pageId);
    if (!result.ok) throw new Error("se esperaba un layout válido");
    const [first, second] = result.layout.sheets[0]!.pieces;
    const corrupted = { ...result.layout, sheets: [{ sheetIndex: 0, pieces: [first!, { ...second!, footprintPosition: { ...first!.footprintPosition } }] }] };
    const issues = validateImpositionLayoutGeometry(corrupted);
    expect(issues).toEqual([{ code: "footprints_overlap", sheetIndex: 0, copyIndex: second!.copyIndex }]);
  });
});
