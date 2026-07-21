import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { ExportAssetResolver } from "@impulso/export-engine";
import type { FontChecker } from "../preflight/fonts.js";
import type { ImageDimensionsProbe } from "../preflight/imageProbe.js";
import { buildPrintJobFor } from "../testUtils/fixtures.js";
import { createFakeCanvasContext2D } from "../testUtils/fakeCanvasContext2D.js";
import { describePdfStructure } from "../testUtils/pdfStructuralSnapshot.js";
import {
  goldenCircularSticker,
  goldenClosedPathSticker,
  goldenForAsymmetricBleed,
  goldenImage,
  goldenMultiPage,
  goldenObjectCrossingTrim,
  goldenStickerSheet,
  goldenTextAndShape,
  goldenTransparent,
} from "../testUtils/goldenFixtures.js";

/**
 * Golden OUTPUTS (Fase 9.5, secciones 3-4 del enunciado) — snapshots
 * ESTRUCTURALES pequeños (JSON de texto, vía `toMatchSnapshot` de
 * vitest, NUNCA el binario del PDF) para cada fixture canónico, a través
 * del pipeline real (`exportPrintJobToPdf`/`exportImpositionToPdf`, con
 * `pdf-lib` real — solo se mockea la rasterización de bajo nivel de
 * Konva, igual que el resto de `raster/*.test.ts`). Un cambio real de
 * geometría/boxes/cantidad de páginas-imágenes-vectores rompe el
 * snapshot y hay que revisarlo a mano — exactamente la garantía que un
 * golden test debe dar. Los archivos `.snap` resultantes son texto, no
 * binarios pesados.
 */

let renderPageToStageMock: ReturnType<typeof vi.fn>;
let resolveActivePageMock: ReturnType<typeof vi.fn>;

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: (...args: unknown[]) => renderPageToStageMock(...args),
  resolveActivePage: (...args: unknown[]) => resolveActivePageMock(...args),
}));

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
function fakeCanvas(): HTMLCanvasElement {
  return { width: 10, height: 10, toBlob: (cb: (b: Blob | null) => void) => cb(onePixelPngBlob()) } as unknown as HTMLCanvasElement;
}
function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
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

describe("Golden outputs — snapshots estructurales de PDF (Fase 9.5)", () => {
  beforeEach(() => {
    renderPageToStageMock = vi.fn(() => ({ stage: { toCanvas: () => fakeCanvas() }, widthPx: 10, heightPx: 10, destroy: vi.fn() }));
    resolveActivePageMock = vi.fn((project, pageId) => project.document.pages.find((p: { id: unknown }) => p.id === pageId));
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createFakeCanvasContext2D() as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(onePixelPngBlob()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("1. texto + shape", async () => {
    const project = goldenTextAndShape();
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("2. imagen", async () => {
    const project = goldenImage();
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor({ gold_asset_1: new Blob(["x"]) }), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("3. transparencia", async () => {
    const project = goldenTransparent();
    const printJob = buildPrintJobFor(project, "digital-png", { output: "pdf" });
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("4. object cruzando el trim", async () => {
    const project = goldenObjectCrossingTrim();
    const printJob = buildPrintJobFor(project, "print-pdf");
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("5. bleed asimétrico", async () => {
    const project = goldenForAsymmetricBleed();
    const printJob = buildPrintJobFor(project, "print-pdf", { bleed: { top: 2, right: 4, bottom: 6, left: 8, unit: "mm" } });
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("6. multipágina", async () => {
    const project = goldenMultiPage();
    const printJob = buildPrintJobFor(project, "print-pdf");
    printJob.pageIds = project.document.pages.map((p) => p.id);
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor({ gold_multi_asset: new Blob(["x"]) }), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("7. Circular Sticker", async () => {
    const project = goldenCircularSticker();
    const printJob = buildPrintJobFor(project, "sticker-sheet", { imposition: { mode: "single" } });
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("8. Closed Path Sticker", async () => {
    const project = goldenClosedPathSticker();
    const printJob = buildPrintJobFor(project, "sticker-sheet", { imposition: { mode: "single" } });
    const { exportPrintJobToPdf } = await import("./exportPrintJobToPdf.js");
    const result = await exportPrintJobToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    expect(describePdfStructure(doc)).toMatchSnapshot();
  });

  it("9. Sticker Sheet (imposicionado, 50 copias)", async () => {
    const project = goldenStickerSheet();
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      imposition: {
        mode: "grid",
        sheet: { width: 100, height: 60, unit: "mm" },
        orientation: "portrait",
        quantity: 50,
        placementMode: "automatic",
        gapX: 2,
        gapY: 2,
        marginTop: 5,
        marginRight: 5,
        marginBottom: 5,
        marginLeft: 5,
        alignment: "center",
        marksMode: "per-piece",
      },
    });
    const { exportImpositionToPdf } = await import("./exportImpositionToPdf.js");
    const result = await exportImpositionToPdf({ project, printJob, resolver: resolverFor(), projectName: "golden", fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, now: NOW });
    const doc = await PDFDocument.load(await readBlobBytes(result.blob));
    const structure = describePdfStructure(doc);
    // La cantidad TOTAL de operadores de imagen en toda la hoja debe ser
    // exactamente `quantity` (una imagen embebida, dibujada N veces) —
    // dato explícito además del snapshot, para que un cambio de este
    // número en particular sea legible sin abrir el diff.
    expect(structure.pages.reduce((sum, p) => sum + p.imageDrawCount, 0)).toBe(50);
    expect(structure).toMatchSnapshot();
  });
});
