import { describe, expect, it, vi } from "vitest";
import { createEngine } from "@impulso/engine";
import {
  AssetIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";
import { mountAssetsPanel } from "./assetsPanel.js";
import { createResolvedAssetCache } from "./assetResolution.js";
import type { ToolsController } from "./tools.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

function buildProject(assets: Project["document"]["assets"] = []): Project {
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
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets,
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

function imageAsset(id: string, name = `${id}.png`) {
  return {
    id: AssetIdSchema.parse(id),
    type: "image" as const,
    name,
    mimeType: "image/png",
    width: 100,
    height: 50,
    metadata,
    pluginData: {},
    customProperties: {},
  };
}

function fakeController(overrides: Partial<ToolsController> = {}): ToolsController {
  return {
    insertText: vi.fn(),
    uploadAsset: vi.fn().mockResolvedValue(undefined),
    insertImage: vi.fn().mockResolvedValue(undefined),
    insertImageFromAsset: vi.fn(),
    ...overrides,
  };
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("mountAssetsPanel", () => {
  it("renderiza una fila por Asset del documento", () => {
    const engine = createEngine(buildProject([imageAsset("asset_1"), imageAsset("asset_2")]));
    const div = container();

    mountAssetsPanel(div, engine, fakeController(), createResolvedAssetCache());

    expect(div.querySelectorAll(".asset-item")).toHaveLength(2);
    expect(div.querySelector('[data-asset-id="asset_1"] .asset-name')?.textContent).toBe("asset_1.png");
  });

  it("usa la imagen resuelta en el cache como thumbnail cuando existe", () => {
    const engine = createEngine(buildProject([imageAsset("asset_1")]));
    const div = container();
    const cache = createResolvedAssetCache();
    const image = { src: "blob:resolved" } as HTMLImageElement;
    cache.set(AssetIdSchema.parse("asset_1"), image);

    mountAssetsPanel(div, engine, fakeController(), cache);

    const thumbnail = div.querySelector(".asset-thumbnail") as HTMLImageElement;
    expect(thumbnail.src).toBe("blob:resolved");
  });

  it("sin resolver en el cache, el thumbnail no tiene src", () => {
    const engine = createEngine(buildProject([imageAsset("asset_1")]));
    const div = container();

    mountAssetsPanel(div, engine, fakeController(), createResolvedAssetCache());

    const thumbnail = div.querySelector(".asset-thumbnail") as HTMLImageElement;
    expect(thumbnail.getAttribute("src")).toBeNull();
  });

  it("click en un Asset llama a insertImageFromAsset con su id", () => {
    const engine = createEngine(buildProject([imageAsset("asset_1")]));
    const div = container();
    const insertImageFromAsset = vi.fn();

    mountAssetsPanel(div, engine, fakeController({ insertImageFromAsset }), createResolvedAssetCache());

    (div.querySelector('[data-asset-id="asset_1"]') as HTMLElement).click();

    expect(insertImageFromAsset).toHaveBeenCalledWith("asset_1");
  });

  it("click en eliminar despacha removeAsset sin disparar la inserción", () => {
    const engine = createEngine(buildProject([imageAsset("asset_1")]));
    const div = container();
    const insertImageFromAsset = vi.fn();

    mountAssetsPanel(div, engine, fakeController({ insertImageFromAsset }), createResolvedAssetCache());

    (div.querySelector(".asset-delete") as HTMLButtonElement).click();

    expect(engine.getProject().document.assets).toHaveLength(0);
    expect(insertImageFromAsset).not.toHaveBeenCalled();
  });

  it("click en 'Subir imagen' abre el input de archivo oculto", () => {
    const engine = createEngine(buildProject());
    const div = container();

    mountAssetsPanel(div, engine, fakeController(), createResolvedAssetCache());

    const fileInput = div.querySelector(".assets-upload-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    (div.querySelector(".assets-upload") as HTMLButtonElement).click();

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("seleccionar un archivo llama a controller.uploadAsset(file) y limpia el input", () => {
    const engine = createEngine(buildProject());
    const div = container();
    const uploadAsset = vi.fn().mockResolvedValue(undefined);

    mountAssetsPanel(div, engine, fakeController({ uploadAsset }), createResolvedAssetCache());

    const fileInput = div.querySelector(".assets-upload-input") as HTMLInputElement;
    const file = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event("change"));

    expect(uploadAsset).toHaveBeenCalledWith(file);
    expect(fileInput.value).toBe("");
  });

  it("cambiar el input sin ningún archivo seleccionado no llama a uploadAsset", () => {
    const engine = createEngine(buildProject());
    const div = container();
    const uploadAsset = vi.fn();

    mountAssetsPanel(div, engine, fakeController({ uploadAsset }), createResolvedAssetCache());

    (div.querySelector(".assets-upload-input") as HTMLInputElement).dispatchEvent(new Event("change"));

    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("se actualiza automáticamente cuando el Engine emite projectChanged (ej. tras addAsset)", () => {
    const engine = createEngine(buildProject());
    const div = container();

    mountAssetsPanel(div, engine, fakeController(), createResolvedAssetCache());
    expect(div.querySelectorAll(".asset-item")).toHaveLength(0);

    engine.dispatch({ type: "addAsset", asset: imageAsset("asset_1") });

    expect(div.querySelectorAll(".asset-item")).toHaveLength(1);
  });

  it("destroy() detiene la suscripción y remueve los elementos montados", () => {
    const engine = createEngine(buildProject());
    const div = container();

    const panel = mountAssetsPanel(div, engine, fakeController(), createResolvedAssetCache());
    panel.destroy();

    expect(div.querySelector(".assets-upload")).toBeNull();
    expect(div.querySelector(".assets-upload-input")).toBeNull();
    expect(div.querySelector(".assets-grid")).toBeNull();

    engine.dispatch({ type: "addAsset", asset: imageAsset("asset_1") });
    // Sin la grilla montada, no hay dónde verificar filas — solo confirmamos
    // que dispatch() no lanza tras destroy() (el listener ya no está activo).
  });
});
