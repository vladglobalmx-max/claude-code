import { describe, expect, it } from "vitest";
import Konva from "konva";
import {
  ObjectIdSchema,
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  AssetIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";
import { mountCanvasRuntime } from "./bootstrap.js";
import { createDemoProject } from "./demoProject.js";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("mountCanvasRuntime — pipeline completo Document Schema -> Engine -> Renderer -> Canvas", () => {
  it("monta un Konva.Stage dimensionado según la página del demo (320x320px)", () => {
    const { renderer } = mountCanvasRuntime(container());
    const stage = renderer.getStage();
    expect(stage).toBeInstanceOf(Konva.Stage);
    expect(stage?.width()).toBe(320);
    expect(stage?.height()).toBe(320);
  });

  it("renderiza los 3 objects del demo como los nodos Konva correctos", () => {
    const { renderer } = mountCanvasRuntime(container());
    const mainLayer = renderer.getStage()?.getChildren()[0] as Konva.Layer;
    const layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    const nodes = layerGroup.getChildren();

    expect(nodes.map((node) => node.id())).toEqual(["background", "badge", "label"]);
    expect(nodes[0]).toBeInstanceOf(Konva.Rect);
    expect(nodes[1]).toBeInstanceOf(Konva.Ellipse);
    expect(nodes[2]).toBeInstanceOf(Konva.Text);
  });

  it("el flujo es reactivo end-to-end: un dispatch en el Engine re-renderiza el Canvas", () => {
    const { engine, renderer } = mountCanvasRuntime(container());

    engine.dispatch({
      type: "updateObjectTransform",
      objectId: ObjectIdSchema.parse("badge"),
      transform: { x: 100 },
    });

    const mainLayer = renderer.getStage()?.getChildren()[0] as Konva.Layer;
    const layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    const badgeNode = layerGroup.getChildren().find((node) => node.id() === "badge");
    // "badge" es un ellipse: Konva lo posiciona por el centro (+ size/2, ver
    // @impulso/renderer-konva coordinates.ts), de ahí 100 + 100 = 200.
    expect(badgeNode?.x()).toBe(200);
  });

  it("acepta un Project explícito en vez del demo por defecto", () => {
    const customProject = createDemoProject();
    const { engine } = mountCanvasRuntime(container(), customProject);
    expect(engine.getProject()).toEqual(customProject);
  });

  it("acepta un resolveAssetSource y lo pasa al Renderer para resolver Images", () => {
    const now = "2026-07-18T00:00:00.000Z";
    const metadata = { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now };
    const project: Project = {
      id: ProjectIdSchema.parse("project_1"),
      moduleId: "sticker-builder",
      document: {
        id: DocumentIdSchema.parse("document_1"),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        documentVersion: 1,
        pages: [
          {
            id: PageIdSchema.parse("page_1"),
            size: { width: 100, height: 100 },
            unit: "px",
            layers: [
              {
                id: LayerIdSchema.parse("layer_1"),
                objects: [
                  {
                    id: ObjectIdSchema.parse("image_1"),
                    type: "image",
                    assetId: AssetIdSchema.parse("asset_1"),
                    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                    size: { width: 10, height: 10 },
                    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
                    metadata,
                    pluginData: {},
                    customProperties: {},
                  },
                ],
                metadata,
                pluginData: {},
                customProperties: {},
              },
            ],
            metadata,
            pluginData: {},
            customProperties: {},
          },
        ],
        metadata,
        history: { entries: [] },
        pluginData: {},
        customProperties: {},
      },
      metadata: { ...metadata, name: "test" },
      pluginData: {},
      customProperties: {},
    };

    const fakeImage = {} as CanvasImageSource;
    const resolveAssetSource = (assetId: string) => (assetId === "asset_1" ? fakeImage : undefined);

    const { renderer } = mountCanvasRuntime(container(), project, { resolveAssetSource });

    const mainLayer = renderer.getStage()?.getChildren()[0] as Konva.Layer;
    const layerGroup = mainLayer.getChildren()[0] as Konva.Group;
    const imageNode = layerGroup.getChildren()[0] as Konva.Image;
    expect(imageNode.image()).toBe(fakeImage);
  });

  it("destroy() del renderer limpia el DOM montado", () => {
    const div = container();
    const { renderer } = mountCanvasRuntime(div);
    expect(div.children.length).toBeGreaterThan(0);

    renderer.destroy();
    expect(div.children.length).toBe(0);
  });
});
