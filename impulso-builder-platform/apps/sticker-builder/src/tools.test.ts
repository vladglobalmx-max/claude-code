import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngine } from "@impulso/engine";
import {
  DocumentIdSchema,
  LayerIdSchema,
  PageIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";
import { computeInsertPosition, createToolsController, mountToolButtons } from "./tools.js";
import { createImageAssetCache } from "./imageAssets.js";

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
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
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
      const cache = createImageAssetCache();
      const controller = createToolsController({ engine, imageCache: cache, now: () => NOW });

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
      const cache = createImageAssetCache();
      const controller = createToolsController({ engine, imageCache: cache, now: () => NOW });

      controller.insertText();
      controller.insertText();

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(2);
      expect(objects[0]?.id).not.toBe(objects[1]?.id);
      expect(objects[0]?.transform.x).not.toBe(objects[1]?.transform.x);
    });

    it("sin now/generateId inyectados, usa los valores por defecto (Date/crypto.randomUUID reales)", () => {
      const engine = createEngine(buildProject());
      const cache = createImageAssetCache();
      const controller = createToolsController({ engine, imageCache: cache });

      controller.insertText();

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects[0]?.id).toMatch(/^object_/);
      expect(objects[0]?.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("con un generateId inyectado, produce un id determinístico", () => {
      const engine = createEngine(buildProject());
      const cache = createImageAssetCache();
      const controller = createToolsController({
        engine,
        imageCache: cache,
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
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("agrega un ImageObject con el dataUrl embebido en customProperties, y lo registra en el cache", async () => {
      const engine = createEngine(buildProject());
      const cache = createImageAssetCache();
      const controller = createToolsController({ engine, imageCache: cache, now: () => NOW });
      const file = new File(["contenido"], "sticker.png", { type: "image/png" });

      await controller.insertImage(file);

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      expect(objects).toHaveLength(1);
      expect(objects[0]?.type).toBe("image");
      if (objects[0]?.type === "image") {
        expect(cache.resolve(objects[0].assetId)).toBeDefined();
        expect(objects[0].customProperties.impulsoImageDataUrl).toMatch(/^data:/);
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
      const cache = createImageAssetCache();
      const controller = createToolsController({ engine, imageCache: cache, now: () => NOW });
      const file = new File(["x"], "chico.png", { type: "image/png" });

      await controller.insertImage(file);

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "image") {
        expect(objects[0].size).toEqual({ width: 50, height: 30 });
      }
    });

    it("reduce el tamaño de imágenes más grandes que MAX_IMAGE_DIMENSION manteniendo el aspect ratio", async () => {
      // FakeImage: 400x100 -> el lado mayor (400) se reduce a 200, escala 0.5 -> 200x50
      const engine = createEngine(buildProject());
      const cache = createImageAssetCache();
      const controller = createToolsController({ engine, imageCache: cache, now: () => NOW });
      const file = new File(["x"], "grande.png", { type: "image/png" });

      await controller.insertImage(file);

      const objects = engine.getProject().document.pages[0]?.layers[0]?.objects ?? [];
      if (objects[0]?.type === "image") {
        expect(objects[0].size).toEqual({ width: 200, height: 50 });
      }
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
    const cache = createImageAssetCache();
    const controller = createToolsController({ engine, imageCache: cache, now: () => NOW });

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
    const insertImage = vi.fn();
    mountToolButtons(div, { insertText, insertImage });

    (div.querySelector(".tool-text") as HTMLButtonElement).click();

    expect(insertText).toHaveBeenCalledOnce();
  });

  it("click en 'Imagen' abre el input de archivo oculto", () => {
    const div = container();
    const controller = { insertText: vi.fn(), insertImage: vi.fn() };
    mountToolButtons(div, controller);

    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    (div.querySelector(".tool-image") as HTMLButtonElement).click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("seleccionar un archivo llama a controller.insertImage(file) y limpia el input", () => {
    const div = container();
    const insertImage = vi.fn().mockResolvedValue(undefined);
    mountToolButtons(div, { insertText: vi.fn(), insertImage });

    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    const file = new File(["x"], "a.png", { type: "image/png" });
    // jsdom no implementa el constructor `DataTransfer`; se define `files`
    // directamente (es una propiedad de solo lectura en el DOM real, pero
    // configurable aquí para el test).
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event("change"));

    expect(insertImage).toHaveBeenCalledWith(file);
    expect(fileInput.value).toBe("");
  });

  it("cambiar el input sin ningún archivo seleccionado no llama a insertImage", () => {
    const div = container();
    const insertImage = vi.fn();
    mountToolButtons(div, { insertText: vi.fn(), insertImage });

    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    fileInput.dispatchEvent(new Event("change"));

    expect(insertImage).not.toHaveBeenCalled();
  });

  it("openFilePicker() abre el input de archivo oculto (usado por el atajo de teclado 'I')", () => {
    const div = container();
    const buttons = mountToolButtons(div, { insertText: vi.fn(), insertImage: vi.fn() });
    const fileInput = div.querySelector(".tool-image-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    buttons.openFilePicker();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("destroy() remueve los botones y el input del DOM", () => {
    const div = container();
    const buttons = mountToolButtons(div, { insertText: vi.fn(), insertImage: vi.fn() });

    buttons.destroy();

    expect(div.querySelector(".tool-text")).toBeNull();
    expect(div.querySelector(".tool-image")).toBeNull();
    expect(div.querySelector(".tool-image-input")).toBeNull();
  });
});
