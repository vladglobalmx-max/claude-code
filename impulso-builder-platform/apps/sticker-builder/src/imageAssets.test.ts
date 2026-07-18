import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DocumentIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  PageIdSchema,
  ProjectIdSchema,
  AssetIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import {
  loadImageFile,
  createImageAssetCache,
  preloadProjectImages,
  IMAGE_DATA_URL_PROPERTY,
} from "./imageAssets.js";

/** jsdom no decodifica imágenes reales (sin red) — este stub reemplaza
 * `window.Image` para que `onload`/`onerror` se disparen de forma
 * controlada y síncrona, sin depender de decodificación real. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 42;
  naturalHeight = 24;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value === "data:image/invalid") {
      queueMicrotask(() => this.onerror?.());
    } else {
      queueMicrotask(() => this.onload?.());
    }
  }
}

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function buildImageObject(id: string, dataUrl?: string): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "image",
    assetId: AssetIdSchema.parse(`asset_${id}`),
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: dataUrl ? { [IMAGE_DATA_URL_PROPERTY]: dataUrl } : {},
  };
}

function buildProjectWithObjects(objects: SceneObject[]): Project {
  return {
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
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects, metadata, pluginData: {}, customProperties: {} }],
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
}

describe("imageAssets", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("loadImageFile", () => {
    it("lee un File y resuelve un LoadedImage con assetId sintético, dataUrl e image cargada", async () => {
      const file = new File(["contenido"], "sticker.png", { type: "image/png" });

      const result = await loadImageFile(file);

      expect(result.assetId).toMatch(/^asset_/);
      expect(result.dataUrl).toMatch(/^data:/);
      expect(result.width).toBe(42);
      expect(result.height).toBe(24);
    });

    it("cada llamada genera un assetId distinto", async () => {
      const file = new File(["x"], "a.png", { type: "image/png" });
      const first = await loadImageFile(file);
      const second = await loadImageFile(file);
      expect(first.assetId).not.toBe(second.assetId);
    });
  });

  describe("createImageAssetCache", () => {
    it("resolve() devuelve undefined para un assetId nunca guardado", () => {
      const cache = createImageAssetCache();
      expect(cache.resolve(AssetIdSchema.parse("asset_x"))).toBeUndefined();
    });

    it("set() + resolve() devuelve la misma imagen guardada", () => {
      const cache = createImageAssetCache();
      const image = new FakeImage() as unknown as HTMLImageElement;
      const assetId = AssetIdSchema.parse("asset_x");

      cache.set(assetId, image);

      expect(cache.resolve(assetId)).toBe(image);
    });

    it("clear() vacía el cache", () => {
      const cache = createImageAssetCache();
      const assetId = AssetIdSchema.parse("asset_x");
      cache.set(assetId, new FakeImage() as unknown as HTMLImageElement);

      cache.clear();

      expect(cache.resolve(assetId)).toBeUndefined();
    });
  });

  describe("preloadProjectImages", () => {
    it("precarga en el cache cada ImageObject con dataUrl embebido", async () => {
      const object = buildImageObject("img_1", "data:image/png;base64,abc");
      const project = buildProjectWithObjects([object]);
      const cache = createImageAssetCache();

      await preloadProjectImages(project, cache);

      expect(cache.resolve(AssetIdSchema.parse("asset_img_1"))).toBeDefined();
    });

    it("ignora objects que no son Image", async () => {
      const rect: SceneObject = {
        id: ObjectIdSchema.parse("rect_1"),
        type: "rectangle",
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        size: { width: 10, height: 10 },
        cornerRadius: 0,
        style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata,
        pluginData: {},
        customProperties: {},
      };
      const project = buildProjectWithObjects([rect]);
      const cache = createImageAssetCache();

      await expect(preloadProjectImages(project, cache)).resolves.toBeUndefined();
    });

    it("ignora un ImageObject sin dataUrl embebido (no lanza)", async () => {
      const object = buildImageObject("img_1"); // sin dataUrl
      const project = buildProjectWithObjects([object]);
      const cache = createImageAssetCache();

      await preloadProjectImages(project, cache);

      expect(cache.resolve(AssetIdSchema.parse("asset_img_1"))).toBeUndefined();
    });

    it("precarga imágenes anidadas dentro de un group, a cualquier profundidad", async () => {
      const innerImage = buildImageObject("img_deep", "data:image/png;base64,deep");
      const group: SceneObject = {
        id: ObjectIdSchema.parse("group_1"),
        type: "group",
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata,
        pluginData: {},
        customProperties: {},
        children: [innerImage],
      };
      const project = buildProjectWithObjects([group]);
      const cache = createImageAssetCache();

      await preloadProjectImages(project, cache);

      expect(cache.resolve(AssetIdSchema.parse("asset_img_deep"))).toBeDefined();
    });
  });
});
