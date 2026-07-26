import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngine } from "@impulso/engine";
import {
  DocumentIdSchema,
  LayerIdSchema,
  PageIdSchema,
  ProjectIdSchema,
  AssetIdSchema,
  CURRENT_SCHEMA_VERSION,
  toPixels,
  type Project,
} from "@impulso/document-schema";
import { createMemoryAssetStore } from "@impulso/asset-library";
import { computeInsertPosition, createToolsController, mountToolButtons } from "./tools.js";
import { createResolvedAssetCache } from "./assetResolution.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 400;
  naturalHeight = 100;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

function buildProject(): Project {
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
          size: { width: 200, height: 100 },
          unit: "px",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
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

function stubUrl(): void {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });
}

describe("computeInsertPosition", () => {
  it("centra el object en la página cuando offsetIndex es 0", () => {
    expect(computeInsertPosition(200, 100, 40, 20, 0)).toEqual({ x: 80, y: 40 });
  });

  it("aplica un desplazamiento en cascada según offsetIndex", () => {
    expect(computeInsertPosition(200, 100, 40, 20, 1)).toEqual({ x: 104, y: 64 });
  });

  it("el desplazamiento se repite cada OFFSET_CYCLE (5) inserciones", () => {
    expect(computeInsertPosition(200, 100, 40, 20, 5)).toEqual(computeInsertPosition(200, 100, 40, 20, 0));
  });
});

describe("createToolsController", () => {
  describe("insertText", () => {
    it("agrega un TextObject centrado en la primera Page/Layer", () => {
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });

      controller.insertText();

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(1);
      expect(objects[0]?.type).toBe("text");
      if (objects[0]?.type === "text") {
        expect(objects[0].content).toBe("Texto");
        expect(objects[0].transform.x).toBe(20); // (200 - 160) / 2
        expect(objects[0].transform.y).toBe(30); // (100 - 40) / 2
      }
    });

    it("cada llamada usa un id distinto y aplica el desplazamiento en cascada", () => {
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });

      controller.insertText();
      controller.insertText();

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(2);
      expect(objects[0]?.id).not.toBe(objects[1]?.id);
      expect(objects[0]?.transform.x).not.toBe(objects[1]?.transform.x);
    });

    it("sin now/generateId inyectados, usa los valores por defecto (Date/crypto.randomUUID reales)", () => {
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
      });

      controller.insertText();

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects[0]?.id).toMatch(/^object_/);
      expect(objects[0]?.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("con un generateId inyectado, produce un id determinístico", () => {
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
        generateId: () => "fixed",
      });

      controller.insertText();

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects[0]?.id).toBe("object_fixed");
    });
  });

  describe("insertImage", () => {
    beforeEach(() => {
      vi.stubGlobal("Image", FakeImage);
      stubUrl();
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("registra el Asset en document.assets, guarda el binario, resuelve el cache, e inserta un ImageObject", async () => {
      const engine = createEngine(buildProject());
      const binaryStore = createMemoryAssetStore();
      const resolvedCache = createResolvedAssetCache();
      const controller = createToolsController({ engine, binaryStore, resolvedCache, now: () => NOW, generateId: () => "img1" });
      const file = new File(["contenido"], "sticker.png", { type: "image/png" });

      await controller.insertImage(file);

      const assets = engine.getProject().document.assets;
      expect(assets).toHaveLength(1);
      expect(assets[0]?.type).toBe("image");

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(1);
      expect(objects[0]?.type).toBe("image");
      if (objects[0]?.type === "image" && assets[0]) {
        expect(objects[0].assetId).toBe(assets[0].id);
        expect(await binaryStore.get(assets[0].id)).toBeDefined();
        expect(resolvedCache.resolve(assets[0].id)).toBeDefined();
      }
    });

    it("no reescala imágenes ya dentro de MAX_IMAGE_DIMENSION", async () => {
      class SmallFakeImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 50;
        naturalHeight = 30;
        private _src = "";
        get src() {
          return this._src;
        }
        set src(value: string) {
          this._src = value;
          queueMicrotask(() => this.onload?.());
        }
      }
      vi.stubGlobal("Image", SmallFakeImage);
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });
      const file = new File(["x"], "chico.png", { type: "image/png" });

      await controller.insertImage(file);

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "image") {
        expect(objects[0].size).toEqual({ width: 50, height: 30 });
      }
    });

    it("reduce el tamaño de imágenes más grandes que el límite efectivo manteniendo el aspect ratio", async () => {
      // Página de prueba: 200x100 -> límite efectivo = min(200, min(200,100)*0.8) = 80.
      // FakeImage: 400x100 -> el lado mayor (400) se reduce a 80, escala 0.2 -> 80x20
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });
      const file = new File(["x"], "grande.png", { type: "image/png" });

      await controller.insertImage(file);

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "image") {
        expect(objects[0].size).toEqual({ width: 80, height: 20 });
      }
    });

    it("regresión RC1: en una página pequeña (p.ej. un sticker de 50x50), la imagen importada nunca es más grande que la propia página", async () => {
      // Bug real encontrado en la validación de comprador: antes de este fix,
      // el límite era un valor absoluto (200) sin relación con el tamaño de
      // la página, así que en un sticker de 50x50 una imagen terminaba 4x
      // más grande que el propio sticker, desbordando casi por completo el
      // área visible.
      const smallPageProject = buildProject();
      const page = smallPageProject.document.pages[0];
      if (page) page.size = { width: 50, height: 50 };
      const engine = createEngine(smallPageProject);
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });
      const file = new File(["x"], "grande.png", { type: "image/png" });

      await controller.insertImage(file);

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "image") {
        expect(objects[0].size.width).toBeLessThanOrEqual(50);
        expect(objects[0].size.height).toBeLessThanOrEqual(50);
      }
    });

    it("regresión RC1 (causa raíz): en una página real en mm, la imagen se centra e inserta en píxeles canónicos, no en la unidad cruda de la página", async () => {
      // Bug real de fondo: `Page.size` vive en la unidad física cruda de la
      // página (`Page.unit`, "mm" en cualquier proyecto real creado desde
      // "Nuevo proyecto"), pero `size`/`transform` de cualquier object viven
      // SIEMPRE en píxeles canónicos (ver `pageSizeInCanonicalPx` en
      // tools.ts). Usar `page.size.width/height` sin convertir — como hacía
      // este código antes, incluido el primer intento de fix de esta misma
      // regresión — mezclaba ambas unidades: en una página de 50mm reales
      // (~189px canónicos), el objeto terminaba centrado/dimensionado como
      // si la página midiera 50px, muy por fuera del área visible real.
      const mmProject = buildProject();
      const page = mmProject.document.pages[0];
      if (page) {
        page.size = { width: 50, height: 50 };
        page.unit = "mm";
      }
      const engine = createEngine(mmProject);
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });
      const file = new File(["x"], "grande.png", { type: "image/png" });

      await controller.insertImage(file);

      const pagePx = toPixels(50, "mm"); // ~188.98 — el mismo espacio numérico que `size`/`transform`
      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "image") {
        // La imagen debe caber dentro de la página EN PÍXELES CANÓNICOS, no
        // dentro de un cuadro de "50" unidades (el bug de la mezcla de
        // unidades) — con la conversión correcta, cabe con margen de sobra.
        expect(objects[0].size.width).toBeLessThanOrEqual(pagePx);
        expect(objects[0].size.height).toBeLessThanOrEqual(pagePx);
        // Y debe quedar dentro del área visible de la página (0..pagePx),
        // no desbordando hacia coordenadas muy negativas como con el bug.
        expect(objects[0].transform.x).toBeGreaterThan(0);
        expect(objects[0].transform.y).toBeGreaterThan(0);
        expect(objects[0].transform.x + objects[0].size.width).toBeLessThan(pagePx);
        expect(objects[0].transform.y + objects[0].size.height).toBeLessThan(pagePx);
      }
    });

    it("regresión RC1 (causa raíz): insertText también centra en píxeles canónicos en una página real en mm", () => {
      const mmProject = buildProject();
      const page = mmProject.document.pages[0];
      if (page) {
        page.size = { width: 50, height: 50 };
        page.unit = "mm";
      }
      const engine = createEngine(mmProject);
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });

      controller.insertText();

      const pagePx = toPixels(50, "mm");
      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "text") {
        expect(objects[0].transform.x).toBeGreaterThanOrEqual(0);
        expect(objects[0].transform.y).toBeGreaterThanOrEqual(0);
        expect(objects[0].transform.x).toBeLessThan(pagePx);
        expect(objects[0].transform.y).toBeLessThan(pagePx);
      }
    });
  });

  describe("uploadAsset", () => {
    beforeEach(() => {
      vi.stubGlobal("Image", FakeImage);
      stubUrl();
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("registra el Asset y el binario, pero NO inserta ningún object en el canvas", async () => {
      const engine = createEngine(buildProject());
      const binaryStore = createMemoryAssetStore();
      const resolvedCache = createResolvedAssetCache();
      const controller = createToolsController({ engine, binaryStore, resolvedCache, now: () => NOW });
      const file = new File(["contenido"], "sticker.png", { type: "image/png" });

      await controller.uploadAsset(file);

      const assets = engine.getProject().document.assets;
      expect(assets).toHaveLength(1);
      expect(await binaryStore.get(assets[0]!.id)).toBeDefined();
      expect(resolvedCache.resolve(assets[0]!.id)).toBeDefined();
      expect(engine.getProject().document.pages[0]?.layers[0]?.objects).toHaveLength(0);
    });
  });

  describe("insertImageFromAsset", () => {
    it("inserta un ImageObject reutilizando un Asset ya existente, sin tocar binaryStore/resolvedCache", () => {
      const project = buildProject();
      const engine = createEngine({
        ...project,
        document: {
          ...project.document,
          assets: [
            {
              id: AssetIdSchema.parse("asset_1"),
              type: "image",
              name: "logo.png",
              mimeType: "image/png",
              width: 60,
              height: 40,
              metadata,
              pluginData: {},
              customProperties: {},
            },
          ],
        },
      });
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
        generateId: () => "obj1",
      });

      controller.insertImageFromAsset(AssetIdSchema.parse("asset_1"));

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(1);
      if (objects[0]?.type === "image") {
        expect(objects[0].assetId).toBe("asset_1");
        expect(objects[0].size).toEqual({ width: 60, height: 40 });
      }
    });

    it("no hace nada si el assetId no existe o no es de type image", () => {
      const engine = createEngine(buildProject());
      const controller = createToolsController({
        engine,
        binaryStore: createMemoryAssetStore(),
        resolvedCache: createResolvedAssetCache(),
        now: () => NOW,
      });

      controller.insertImageFromAsset(AssetIdSchema.parse("no_existe"));

      expect(engine.getProject().document.pages[0]?.layers[0]?.objects).toHaveLength(0);
    });
  });

  it("lanza si la primera Page no tiene ninguna Layer", () => {
    const project = buildProject();
    const pageWithoutLayers = { ...project.document.pages[0]!, layers: [] };
    const noLayerProject: Project = {
      ...project,
      document: { ...project.document, pages: [pageWithoutLayers] },
    };
    const engine = createEngine(noLayerProject);
    const controller = createToolsController({
      engine,
      binaryStore: createMemoryAssetStore(),
      resolvedCache: createResolvedAssetCache(),
      now: () => NOW,
    });

    expect(() => controller.insertText()).toThrow(/Page\/Layer/);
  });
});

describe("mountToolButtons", () => {
  function container(): HTMLDivElement {
    const div = document.createElement("div");
    document.body.appendChild(div);
    return div;
  }

  it("click en 'Texto' llama a controller.insertText()", () => {
    const div = container();
    const insertText = vi.fn();
    const uploadAsset = vi.fn();
    const insertImage = vi.fn();
    const insertImageFromAsset = vi.fn();
    mountToolButtons(div, { insertText, uploadAsset, insertImage, insertImageFromAsset });

    (div.querySelector(".tool-text") as HTMLButtonElement).click();

    expect(insertText).toHaveBeenCalledOnce();
  });

  it("click en 'Imagen' abre el input de archivo oculto", () => {
    const div = container();
    const controller = { insertText: vi.fn(), uploadAsset: vi.fn(), insertImage: vi.fn(), insertImageFromAsset: vi.fn() };
    mountToolButtons(div, controller);

    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    (div.querySelector(".tool-image") as HTMLButtonElement).click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("seleccionar un archivo llama a controller.insertImage(file) y limpia el input", () => {
    const div = container();
    const insertImage = vi.fn().mockResolvedValue(undefined);
    mountToolButtons(div, { insertText: vi.fn(), uploadAsset: vi.fn(), insertImage, insertImageFromAsset: vi.fn() });

    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    const file = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event("change"));

    expect(insertImage).toHaveBeenCalledWith(file);
    expect(fileInput.value).toBe("");
  });

  it("cambiar el input sin ningún archivo seleccionado no llama a insertImage", () => {
    const div = container();
    const insertImage = vi.fn();
    mountToolButtons(div, { insertText: vi.fn(), uploadAsset: vi.fn(), insertImage, insertImageFromAsset: vi.fn() });

    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    fileInput.dispatchEvent(new Event("change"));

    expect(insertImage).not.toHaveBeenCalled();
  });

  it("openFilePicker() abre el input de archivo oculto (usado por el atajo de teclado 'I')", () => {
    const div = container();
    const buttons = mountToolButtons(div, { insertText: vi.fn(), uploadAsset: vi.fn(), insertImage: vi.fn(), insertImageFromAsset: vi.fn() });
    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    buttons.openFilePicker();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("destroy() remueve los botones y el input del DOM", () => {
    const div = container();
    const buttons = mountToolButtons(div, { insertText: vi.fn(), uploadAsset: vi.fn(), insertImage: vi.fn(), insertImageFromAsset: vi.fn() });

    buttons.destroy();

    expect(div.querySelector(".tool-text")).toBeNull();
    expect(div.querySelector(".tool-image")).toBeNull();
    expect(div.querySelector(".tool-image-input")).toBeNull();
  });
});
