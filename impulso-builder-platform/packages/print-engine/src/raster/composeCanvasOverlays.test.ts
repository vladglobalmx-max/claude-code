import { describe, expect, it, vi, afterEach } from "vitest";
import { createFakeCanvasContext2D } from "../testUtils/fakeCanvasContext2D.js";
import { createMediaCanvasWithContent, drawLineSegmentOnCanvas, drawPathSegmentsOnCanvas } from "./composeCanvasOverlays.js";
import type { RasterLineSegment } from "./canonicalToRasterPoints.js";

describe("drawLineSegmentOnCanvas", () => {
  it("dibuja moveTo->lineTo->stroke con el color/grosor del segmento, envuelto en save/restore", () => {
    const ctx = createFakeCanvasContext2D();
    const segment: RasterLineSegment = { from: { x: 1, y: 2 }, to: { x: 3, y: 4 }, strokeWidthPx: 2, color: "#ff0000" };
    drawLineSegmentOnCanvas(ctx as unknown as CanvasRenderingContext2D, segment);
    expect(ctx.strokeStyle).toBe("#ff0000");
    expect(ctx.lineWidth).toBe(2);
    const methods = ctx.calls.map((c) => c.method);
    expect(methods).toEqual(["save", "beginPath", "moveTo", "lineTo", "stroke", "restore"]);
    expect(ctx.calls.find((c) => c.method === "moveTo")!.args).toEqual([1, 2]);
    expect(ctx.calls.find((c) => c.method === "lineTo")!.args).toEqual([3, 4]);
  });
});

describe("drawPathSegmentsOnCanvas", () => {
  it("traduce cada tipo de PathSegment a su operación Canvas2D correspondiente", () => {
    const ctx = createFakeCanvasContext2D();
    drawPathSegmentsOnCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 0 } },
        { type: "quadraticCurveTo", control: { x: 5, y: 5 }, point: { x: 10, y: 10 } },
        { type: "cubicCurveTo", control1: { x: 1, y: 1 }, control2: { x: 2, y: 2 }, point: { x: 3, y: 3 } },
        { type: "close" },
      ],
      0.5,
      "#ff00ff",
    );
    const methods = ctx.calls.map((c) => c.method);
    expect(methods).toEqual(["save", "beginPath", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "closePath", "stroke", "restore"]);
    expect(ctx.strokeStyle).toBe("#ff00ff");
    expect(ctx.lineWidth).toBe(0.5);
  });

  it("cierra el path incondicionalmente aunque `segments` no incluya un { type: 'close' } explícito (un cut path SIEMPRE es cerrado)", () => {
    const ctx = createFakeCanvasContext2D();
    drawPathSegmentsOnCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 10 } },
      ],
      0.5,
      "#ff00ff",
    );
    const methods = ctx.calls.map((c) => c.method);
    expect(methods).toEqual(["save", "beginPath", "moveTo", "lineTo", "lineTo", "closePath", "stroke", "restore"]);
  });
});

describe("createMediaCanvasWithContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crea un canvas del tamaño de MediaBox y compone el contenido en su offset, sin escalarlo", () => {
    const fakeCtx = createFakeCanvasContext2D();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

    const contentCanvas = { width: 100, height: 100 } as unknown as HTMLCanvasElement;
    const { canvas } = createMediaCanvasWithContent(contentCanvas, 150, 150, { x: 25, y: 25 });

    expect(canvas.width).toBe(150);
    expect(canvas.height).toBe(150);
    expect(fakeCtx.calls).toEqual([{ method: "drawImage", args: [contentCanvas, 25, 25, 100, 100] }]);
    getContextSpy.mockRestore();
  });

  it("lanza un error claro si el entorno no da un contexto 2D (nunca produce un canvas silenciosamente roto)", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const contentCanvas = { width: 10, height: 10 } as unknown as HTMLCanvasElement;
    expect(() => createMediaCanvasWithContent(contentCanvas, 50, 50, { x: 0, y: 0 })).toThrow();
  });
});
