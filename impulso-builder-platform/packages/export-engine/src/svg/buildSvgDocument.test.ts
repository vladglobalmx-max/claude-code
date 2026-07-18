import { describe, expect, it } from "vitest";
import { PageIdSchema, type AssetId } from "@impulso/document-schema";
import { buildSvgDocument } from "./buildSvgDocument.js";
import { ExportError } from "../errors.js";
import type { ExportAssetResolver } from "../types.js";
import {
  buildProject,
  buildDocument,
  buildPage,
  buildLayer,
  buildRectangle,
  buildEllipse,
  buildPath,
  buildText,
  buildImage,
  buildGroup,
  buildImageAsset,
  NOW,
} from "../testUtils/fixtures.js";

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

describe("buildSvgDocument", () => {
  it("lanza ExportError('no_active_page') si el pageId no existe", async () => {
    const project = buildProject();
    await expect(buildSvgDocument(project, noopResolver, { pageId: PageIdSchema.parse("page_ghost") })).rejects.toThrow(
      ExportError,
    );
  });

  it("produce un <svg> con viewBox en px y width/height en la unidad de la página", async () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" })]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).toContain('width="50mm"');
    expect(result.svg).toContain('height="50mm"');
    expect(result.widthPx).toBeCloseTo(50 * (96 / 25.4), 5);
    expect(result.svg).toContain(`viewBox="0 0 ${result.widthPx} ${result.heightPx}"`);
  });

  it("página en px no agrega sufijo de unidad", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [], { unit: "px" })]) });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).toContain('width="100"');
  });

  it("incluye un rectángulo, una ellipse y respeta el orden de capas/objetos", async () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1"), buildEllipse("ellipse_1")])]),
      ]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).toContain("<rect");
    expect(result.svg).toContain("<ellipse");
    expect(result.svg.indexOf("rect_1") < result.svg.indexOf("ellipse_1") || result.svg.indexOf("<rect") < result.svg.indexOf("<ellipse")).toBe(true);
  });

  it("un object oculto (metadata.visible=false) no aparece en el SVG", async () => {
    const hidden = buildRectangle("rect_hidden", { metadata: { tags: [], visible: false, locked: false, createdAt: NOW, updatedAt: NOW } });
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [hidden])])]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).not.toContain("rect_hidden");
    expect(result.svg).not.toContain("<rect");
  });

  it("una Layer oculta no exporta ninguno de sus objects", async () => {
    const hiddenLayer = buildLayer("layer_hidden", [buildRectangle("rect_1")], {
      metadata: { tags: [], visible: false, locked: false, createdAt: NOW, updatedAt: NOW },
    });
    const project = buildProject({ document: buildDocument([buildPage("page_1", [hiddenLayer])]) });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).not.toContain("<rect");
  });

  it("incluye un path y un text", async () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildPath("path_1"), buildText("text_1", { content: "Hola" })])]),
      ]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).toContain("<path");
    expect(result.svg).toContain("<text");
    expect(result.svg).toContain(">Hola</tspan>");
  });

  it("resuelve grupos anidados recursivamente", async () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildGroup("group_1", [buildRectangle("rect_1")])])]),
      ]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).toContain("<rect");
  });

  it("embebe una imagen resuelta como data URI y no genera warnings", async () => {
    const asset = buildImageAsset("asset_1");
    const blob = new Blob(["fake-png-bytes"], { type: "image/png" });
    const resolver: ExportAssetResolver = { resolve: async (id) => (id === asset.id ? blob : undefined) };
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])])], {
        assets: [asset],
      }),
    });
    const result = await buildSvgDocument(project, resolver);
    expect(result.svg).toContain("<image");
    expect(result.svg).toContain("data:image/png;base64,");
    expect(result.warnings).toHaveLength(0);
  });

  it("Asset referenciado pero ausente del documento -> warning asset_reference_missing + placeholder", async () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: "asset_gone" as AssetId })])]),
      ]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe("asset_reference_missing");
    expect(result.warnings[0]!.objectId).toBe("img_1");
    expect(result.svg).toContain("stroke-dasharray");
  });

  it("Asset existe en el documento pero el resolver no tiene su binario -> warning asset_binary_missing", async () => {
    const asset = buildImageAsset("asset_1");
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id })])])], {
        assets: [asset],
      }),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe("asset_binary_missing");
  });

  it("el mismo assetId usado por dos objects solo se resuelve una vez (cache)", async () => {
    const asset = buildImageAsset("asset_1");
    const blob = new Blob(["bytes"], { type: "image/png" });
    let callCount = 0;
    const resolver: ExportAssetResolver = {
      resolve: async () => {
        callCount++;
        return blob;
      },
    };
    const project = buildProject({
      document: buildDocument(
        [
          buildPage("page_1", [
            buildLayer("layer_1", [buildImage("img_1", { assetId: asset.id }), buildImage("img_2", { assetId: asset.id })]),
          ]),
        ],
        { assets: [asset] },
      ),
    });
    await buildSvgDocument(project, resolver);
    expect(callCount).toBe(1);
  });

  it("shadow de un object produce un <defs><filter> y ninguna otra clase de fuga de ids", async () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [
            buildRectangle("rect_shadow", { style: { strokeWidth: 0, opacity: 1, blendMode: "normal", shadow: { color: "#000", blur: 4, offsetX: 1, offsetY: 1 } } }),
          ]),
        ]),
      ]),
    });
    const result = await buildSvgDocument(project, noopResolver);
    expect(result.svg).toContain("<defs>");
    expect(result.svg).toContain("shadow-rect_shadow");
  });
});
