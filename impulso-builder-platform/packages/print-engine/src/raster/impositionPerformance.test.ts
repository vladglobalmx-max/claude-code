import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildDocument, buildPage, buildPrintJobFor, buildProject } from "../testUtils/fixtures.js";
import { createFakeCanvasContext2D } from "../testUtils/fakeCanvasContext2D.js";
import { computeImpositionLayout } from "../imposition/impositionLayout.js";
import type { GridImpositionSpec } from "../types.js";

const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function onePixelPngBlob(): Blob {
  const binaryString = atob(ONE_BY_ONE_PNG_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  if (typeof blob.arrayBuffer !== "function") {
    (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => bytes.buffer as ArrayBuffer;
  }
  return blob;
}

/**
 * Verificación de performance (Fase 9.4, sección 38 del enunciado) —
 * 100/500 piezas totales, hasta 10 hojas. No mide milisegundos exactos
 * (dependen de la máquina que corre el test) sino DOS garantías reales:
 * (1) la geometría pura escala sin cuadrático evidente (miles de piezas
 * en cientos de ms, nunca minutos), y (2) el exportador reutiliza la
 * pieza rasterizada UNA sola vez sin importar cuántas copias/hojas
 * existan (`uniqueRenderCount`/`renderPageToStageMock` — la garantía
 * central de la sección 13, verificada aquí a la escala real del
 * requisito, no solo con 2-3 piezas de juguete como en los tests
 * unitarios de `exportImpositionToPdf.test.ts`).
 */

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;
let toBlobResult: Blob | null;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

function fakeCanvas(): HTMLCanvasElement {
  return { width: 10, height: 10, toBlob: (cb: (b: Blob | null) => void) => cb(toBlobResult) } as unknown as HTMLCanvasElement;
}

/** Hoja 200x100mm, pieza 20x20mm, sin gaps/márgenes — capacidad
 * determinista: columns=10, rows=5, capacidad=50 por hoja exacta. */
function gridImposition(quantity: number): GridImpositionSpec {
  return {
    mode: "grid",
    sheet: { width: 200, height: 100, unit: "mm" },
    orientation: "portrait",
    quantity,
    placementMode: "automatic",
    gapX: 0,
    gapY: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    alignment: "top-left",
    marksMode: "none",
  };
}

describe("performance de imposición (sección 38: 100/500 piezas, hasta 10 hojas)", () => {
  beforeEach(() => {
    toBlobResult = onePixelPngBlob();
    renderPageToStageMock = vi.fn(() => ({ stage: { toCanvas: () => fakeCanvas() }, widthPx: 10, heightPx: 10, destroy: vi.fn() }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
    // El canvas de composición final (`createBlankCanvas`, un
    // `HTMLCanvasElement` REAL de jsdom, a diferencia del `fakeCanvas()`
    // de arriba) necesita un contexto 2D y `toBlob` fakeados — mismo
    // parche puntual que ya usan `exportImpositionToPdf.test.ts`/
    // `exportImpositionToPng.test.ts`.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => createFakeCanvasContext2D() as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(toBlobResult));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computeImpositionLayout con 500 piezas / 10 hojas termina en menos de 500ms (geometría pura, sin cuadrático evidente)", () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(500),
    });

    const start = performance.now();
    const result = computeImpositionLayout(printJob, page.id);
    const elapsedMs = performance.now() - start;

    if (!result.ok) throw new Error(`se esperaba un layout válido, reason=${result.reason}`);
    expect(result.layout.sheetCount).toBe(10);
    expect(result.layout.capacityPerSheet).toBe(50);
    expect(elapsedMs).toBeLessThan(500);
  });

  it("exportImpositionToPdf con 500 piezas / 10 hojas: rasteriza la pieza UNA sola vez, produce 10 páginas PDF, en menos de 10s", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(500),
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const noopResolver = { resolve: async () => undefined };

    const start = performance.now();
    const result = await exportImpositionToPdf({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "perf",
      fontChecker: { check: async () => "available" },
      imageProbe: { measure: async () => undefined },
      now: () => "2026-07-20T00:00:00.000Z",
    });
    const elapsedMs = performance.now() - start;

    expect(renderPageToStageMock).toHaveBeenCalledTimes(1); // reutilización real a escala, no solo en tests de 2-3 piezas
    expect(result.sheetCount).toBe(10);
    expect(result.pieceCount).toBe(500);
    expect(elapsedMs).toBeLessThan(10_000);
  }, 15_000);

  it("exportImpositionToPng con 100 piezas / 2 hojas: rasteriza la pieza UNA sola vez, produce 2 hojas, en menos de 10s", async () => {
    const page = buildPage("page_1", [], { size: { width: 20, height: 20 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "digital-png", {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(100),
    });
    const { exportImpositionToPng } = await import("./exportImpositionToPng.js");
    const noopResolver = { resolve: async () => undefined };

    const start = performance.now();
    const result = await exportImpositionToPng({
      project,
      printJob,
      resolver: noopResolver,
      projectName: "perf",
      fontChecker: { check: async () => "available" },
      imageProbe: { measure: async () => undefined },
      now: () => "2026-07-20T00:00:00.000Z",
    });
    const elapsedMs = performance.now() - start;

    expect(renderPageToStageMock).toHaveBeenCalledTimes(1);
    expect(result.sheets).toHaveLength(2);
    const totalPieces = result.sheets.length * 50; // capacidad exacta, sin hoja parcial
    expect(totalPieces).toBe(100);
    expect(elapsedMs).toBeLessThan(10_000);
  }, 15_000);
});
