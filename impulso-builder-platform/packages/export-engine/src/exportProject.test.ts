import { describe, expect, it, vi } from "vitest";
import { exportProject } from "./exportProject.js";
import type { ExportAssetResolver } from "./types.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle } from "./testUtils/fixtures.js";

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

vi.mock("@impulso/renderer-konva", () => ({
  renderPageToStage: () => ({
    stage: {
      toCanvas: () =>
        ({ width: 100, height: 100, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })) }) as unknown as HTMLCanvasElement,
    },
    widthPx: 100,
    heightPx: 100,
    destroy: vi.fn(),
  }),
  resolveActivePage: (project: ReturnType<typeof buildProject>) => project.document.pages[0],
}));

describe("exportProject", () => {
  it("format: svg produce un Blob image/svg+xml con svgString expuesto", async () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = await exportProject(project, noopResolver, { format: "svg" });
    expect(result.format).toBe("svg");
    expect(result.blob.type).toBe("image/svg+xml");
    expect(result.svgString).toContain("<svg");
    expect(result.byteSize).toBe(result.blob.size);
  });

  it("format: png produce un Blob image/png, sin svgString", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const result = await exportProject(project, noopResolver, {
      format: "png",
      scale: 1,
      background: { type: "transparent" },
    });
    expect(result.format).toBe("png");
    expect(result.blob.type).toBe("image/png");
    expect(result.svgString).toBeUndefined();
  });

  it("format: png usa konvaPngRasterizer por defecto si no se inyecta ninguno", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const result = await exportProject(project, noopResolver, { format: "png", scale: 2, background: { type: "transparent" } });
    expect(result.blob.type).toBe("image/png");
  });

  it("format: png acepta un pngRasterizer inyectado, sin invocar el de Konva", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const customBlob = new Blob(["custom-png-bytes"], { type: "image/png" });
    const rasterize = vi.fn().mockResolvedValue({ blob: customBlob, width: 42, height: 24, warnings: [] });

    const result = await exportProject(
      project,
      noopResolver,
      { format: "png", scale: 1, background: { type: "transparent" } },
      { pngRasterizer: { rasterize } },
    );

    expect(rasterize).toHaveBeenCalledWith(project, noopResolver, { format: "png", scale: 1, background: { type: "transparent" } });
    expect(result.blob).toBe(customBlob);
    expect(result.width).toBe(42);
    expect(result.height).toBe(24);
  });
});
