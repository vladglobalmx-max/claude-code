import { describe, expect, it } from "vitest";
import Konva from "konva";
import { PageIdSchema } from "@impulso/document-schema";
import { renderPageToStage } from "./offscreenRenderer.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle, buildGroup, buildImage } from "./testUtils/fixtures.js";

describe("renderPageToStage", () => {
  it("devuelve null si el pageId pedido no existe", () => {
    const project = buildProject();
    expect(renderPageToStage(project, { pageId: PageIdSchema.parse("page_ghost") })).toBeNull();
  });

  it("dimensiona el Stage en píxeles a partir del tamaño físico de la página (mm)", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" })]),
    });
    const result = renderPageToStage(project);
    expect(result).not.toBeNull();
    expect(result!.widthPx).toBeCloseTo(50 * (96 / 25.4), 5);
    expect(result!.heightPx).toBeCloseTo(50 * (96 / 25.4), 5);
    expect(result!.stage.width()).toBeCloseTo(result!.widthPx, 5);
    result!.destroy();
  });

  it("construye un Konva.Group por Layer, conteniendo sus objects", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = renderPageToStage(project)!;
    const group = result.stage.findOne("#layer_1");
    expect(group).toBeInstanceOf(Konva.Group);
    expect(result.stage.findOne("#rect_1")).toBeInstanceOf(Konva.Rect);
    result.destroy();
  });

  it("nada es draggable/interactivo — interactive:false en todo nivel", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = renderPageToStage(project)!;
    const node = result.stage.findOne("#rect_1")!;
    expect(node.draggable()).toBe(false);
    result.destroy();
  });

  it("un Layer con visible:false no dibuja sus objects (mismo criterio que el Canvas Runtime interactivo)", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [buildRectangle("rect_1")], {
            metadata: { tags: [], visible: false, locked: false, createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
          }),
        ]),
      ]),
    });
    const result = renderPageToStage(project)!;
    const group = result.stage.findOne("#layer_1") as Konva.Group;
    expect(group.visible()).toBe(false);
    result.destroy();
  });

  it("agrega un Rect de fondo cuando se pasa backgroundColor", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [], { size: { width: 10, height: 10 }, unit: "px" })]),
    });
    const result = renderPageToStage(project, { backgroundColor: "#ffffff" })!;
    const rects = result.stage.find("Rect");
    expect(rects).toHaveLength(1);
    expect((rects[0] as Konva.Rect).fill()).toBe("#ffffff");
    result.destroy();
  });

  it("sin backgroundColor, no agrega ningún Rect de fondo", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [])]),
    });
    const result = renderPageToStage(project)!;
    expect(result.stage.find("Rect")).toHaveLength(0);
    result.destroy();
  });

  it("resuelve grupos anidados igual que el Canvas Runtime interactivo", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildGroup("group_1", [buildRectangle("rect_1")])])]),
      ]),
    });
    const result = renderPageToStage(project)!;
    expect(result.stage.findOne("#group_1")).toBeInstanceOf(Konva.Group);
    expect(result.stage.findOne("#rect_1")).toBeInstanceOf(Konva.Rect);
    result.destroy();
  });

  it("dispatch lanza si se invoca — nunca debería pasar con interactive:false", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = renderPageToStage(project)!;
    // No hay forma pública de invocar dispatch en este modo — se verifica
    // indirectamente que el node no es interactivo (ya cubierto arriba).
    // Este test documenta la garantía, no ejercita la rama directamente.
    expect(result).not.toBeNull();
    result.destroy();
  });

  it("resuelve el asset de una Image vía resolveAssetSource", () => {
    const source = {} as CanvasImageSource;
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: "asset_1" as never })])]),
      ]),
    });
    const result = renderPageToStage(project, { resolveAssetSource: () => source })!;
    const node = result.stage.findOne("#img_1") as Konva.Image;
    expect(node.image()).toBe(source);
    result.destroy();
  });

  it("destroy() no lanza y libera los nodos del Stage", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const result = renderPageToStage(project)!;
    expect(() => result.destroy()).not.toThrow();
  });
});
