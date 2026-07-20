import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import { buildPrintJobFor } from "../testUtils/fixtures.js";
import {
  goldenForAsymmetricBleed,
  goldenImage,
  goldenMultiPage,
  goldenObjectCrossingTrim,
  goldenTextAndShape,
  goldenTransparent,
} from "../testUtils/goldenFixtures.js";

/**
 * Fixtures canónicos (sección 22 del enunciado de Fase 9.2) ejercitados a
 * través del pipeline real de orquestación (`exportPrintJobToPng`/
 * `exportPrintJobToPdf`) — mockeando solo la rasterización de bajo nivel
 * (`@impulso/renderer-konva`), igual que el resto de `raster/*.test.ts`.
 * La verificación VISUAL real (píxeles genuinos) y la ESTRUCTURAL de un
 * PDF real (pdf-lib sin mockear) ya se cubren en `pdf/pdfLibBackend.test.ts`,
 * `raster/exportPrintJobToPdf.test.ts`, y — sin ningún mock, en Chromium
 * real — en `apps/sticker-builder/src/printEngineHarness.ts`. Este archivo
 * se enfoca en: comparación dimensional y determinismo de orden/geometría
 * para cada uno de los 6 escenarios nombrados.
 */

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 10,
    height: 10,
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
  } as unknown as HTMLCanvasElement;
}

const NEVER_CHECK: FontChecker = { check: async () => "available" };
const NO_PROBE: ImageDimensionsProbe = { measure: async () => undefined };
const NOW = () => "2026-07-20T00:00:00.000Z";

function resolverFor(assetBytes: Record<string, Blob | undefined> = {}): ExportAssetResolver {
  return { resolve: async (id) => assetBytes[id] };
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

describe("fixtures canónicos del pipeline de raster (sección 22)", () => {
  beforeEach(() => {
    renderPageToStageMock = vi.fn(() => ({
      stage: { toCanvas: () => fakeCanvas() },
      widthPx: 10,
      heightPx: 10,
      destroy: vi.fn(),
    }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("1. texto + shape: exporta sin error y produce exactamente 1 página", async () => {
    const project = goldenTextAndShape();
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");
    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: resolverFor(),
      projectName: "golden",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.pages).toHaveLength(1);
  });

  it("2. imagen: resuelve el asset y exporta sin warnings de asset faltante", async () => {
    const project = goldenImage();
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");
    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: resolverFor({ gold_asset_1: new Blob(["x"]) }),
      projectName: "golden",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.warnings.some((w) => w.code === "asset_reference_missing" || w.code === "asset_binary_missing")).toBe(false);
  });

  it("3. transparencia: perfil digital-png no pasa backgroundColor a renderPageToStage", async () => {
    const project = goldenTransparent();
    const printJob = buildPrintJobFor(project, "digital-png");
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: resolverFor(),
      projectName: "golden",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(renderPageToStageMock).toHaveBeenCalledWith(project, expect.objectContaining({ backgroundColor: undefined }));
  });

  it("4. object cruzando el trim: se exporta sin recorte — geometría intacta pasada al Renderer", async () => {
    const project = goldenObjectCrossingTrim();
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");
    const result = await exportPrintJobToPng({
      project,
      printJob,
      resolver: resolverFor(),
      projectName: "golden",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    expect(result.pages).toHaveLength(1);
    // El object en sí (transform.x=-10) nunca se modifica antes de llegar
    // al Renderer — confirmado por `renderer-konva`'s propios tests de
    // "corrección 7" (ausencia de clipping); aquí solo se confirma que la
    // orquestación no lo excluye ni falla.
  });

  it("5. bleed asimétrico: canvasSizePx/contentOffsetPx reflejan cada lado por separado", async () => {
    const project = goldenForAsymmetricBleed();
    const printJob = buildPrintJobFor(project, "print-pdf", { bleed: { top: 2, right: 4, bottom: 6, left: 8, unit: "mm" } });
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");
    await exportPrintJobToPng({
      project,
      printJob,
      resolver: resolverFor(),
      projectName: "golden",
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
      now: NOW,
    });
    const [, options] = renderPageToStageMock.mock.calls[0]!;
    const opts = options as { contentOffsetPx: { x: number; y: number } };
    // offsetX (bleedLeft=8mm) > offsetY (bleedTop=2mm) — confirma que cada
    // lado se propaga independientemente, no un valor uniforme.
    expect(opts.contentOffsetPx.x).toBeGreaterThan(opts.contentOffsetPx.y);
  });

  it("6. multipágina: exporta las 3 páginas en orden estable, dos veces seguidas (determinismo)", async () => {
    const project = goldenMultiPage();
    const printJob = buildPrintJobFor(project, "print-pdf");
    printJob.pageIds = project.document.pages.map((p) => p.id);
    const { exportPrintJobToPng } = await import("./exportPrintJobToPng.js");

    const runOnce = () =>
      exportPrintJobToPng({
        project,
        printJob,
        resolver: resolverFor({ gold_multi_asset: new Blob(["x"]) }),
        projectName: "golden",
        fontChecker: NEVER_CHECK,
        imageProbe: NO_PROBE,
        now: NOW,
      });

    const resultA = await runOnce();
    const resultB = await runOnce();
    expect(resultA.pages.map((p) => p.pageId)).toEqual(project.document.pages.map((p) => p.id));
    expect(resultA.pages.map((p) => p.pageId)).toEqual(resultB.pages.map((p) => p.pageId));
    expect(resultA.pages.map((p) => p.filename)).toEqual(resultB.pages.map((p) => p.filename));
  });
});
