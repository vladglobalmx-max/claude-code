import { describe, expect, it } from "vitest";
import {
  ObjectIdSchema,
  AssetIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import { createMemoryAssetStore } from "@impulso/asset-library";
import { migrateLegacyEmbeddedImages } from "./legacyMigration.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const LEGACY_DATA_URL = `data:image/png;base64,${btoa("contenido-de-prueba")}`;

/** jsdom implementa `Blob` sin `.text()` — se lee vía `FileReader` en cambio. */
function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el Blob."));
    reader.readAsText(blob);
  });
}

function legacyImageObject(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "image",
    assetId: AssetIdSchema.parse(`asset_legacy_${id}`),
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 40, height: 30 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: { impulsoImageDataUrl: LEGACY_DATA_URL },
    ...overrides,
  } as SceneObject;
}

function buildRect(id: string): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    cornerRadius: 0,
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
  } as SceneObject;
}

function buildProject(objects: SceneObject[]): Project {
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

describe("migrateLegacyEmbeddedImages", () => {
  it("un proyecto sin imágenes legacy no cambia (misma instancia, migratedCount 0)", async () => {
    const project = buildProject([buildRect("a")]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW });

    expect(result.migratedCount).toBe(0);
    expect(result.project).toBe(project);
  });

  it("migra un ImageObject de nivel superior con dataUrl embebido a un Asset real", async () => {
    const project = buildProject([legacyImageObject("img_1")]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW, generateId: () => "new1" });

    expect(result.migratedCount).toBe(1);
    expect(result.project.document.assets).toHaveLength(1);
    const asset = result.project.document.assets[0]!;
    expect(asset.id).toBe("asset_new1");
    expect(asset.type).toBe("image");

    const migratedObject = result.project.document.pages[0]?.layers[0]?.objects[0];
    expect(migratedObject?.type === "image" && migratedObject.assetId).toBe("asset_new1");
    expect(migratedObject?.type === "image" && migratedObject.customProperties.impulsoImageDataUrl).toBeUndefined();

    const storedBlob = await store.get(asset.id);
    expect(storedBlob).toBeDefined();
    expect(await blobToText(storedBlob!)).toBe("contenido-de-prueba");
  });

  it("preserva otros customProperties del object migrado, solo quita la clave legacy", async () => {
    const project = buildProject([
      legacyImageObject("img_1", {
        customProperties: { impulsoImageDataUrl: LEGACY_DATA_URL, miPropiedad: "valor" },
      } as Partial<SceneObject>),
    ]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW });

    const migratedObject = result.project.document.pages[0]?.layers[0]?.objects[0];
    expect(migratedObject?.customProperties).toEqual({ miPropiedad: "valor" });
  });

  it("migra un ImageObject anidado dentro de un group", async () => {
    const group: SceneObject = {
      id: ObjectIdSchema.parse("group_1"),
      type: "group",
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
      metadata,
      pluginData: {},
      customProperties: {},
      children: [legacyImageObject("img_deep"), buildRect("rect_deep")],
    };
    const project = buildProject([group]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW, generateId: () => "deep1" });

    expect(result.migratedCount).toBe(1);
    const migratedGroup = result.project.document.pages[0]?.layers[0]?.objects[0];
    expect(migratedGroup?.type).toBe("group");
    if (migratedGroup?.type === "group") {
      const migratedChild = migratedGroup.children[0];
      expect(migratedChild?.type === "image" && migratedChild.assetId).toBe("asset_deep1");
      expect(migratedGroup.children[1]?.id).toBe("rect_deep"); // hermano sin cambios
    }
  });

  it("no migra un group sin ninguna imagen legacy adentro (misma instancia del group)", async () => {
    const group: SceneObject = {
      id: ObjectIdSchema.parse("group_1"),
      type: "group",
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
      metadata,
      pluginData: {},
      customProperties: {},
      children: [buildRect("rect_a")],
    };
    const project = buildProject([group]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW });

    expect(result.migratedCount).toBe(0);
    expect(result.project).toBe(project);
  });

  it("migra múltiples imágenes, cada una con su propio Asset", async () => {
    const project = buildProject([legacyImageObject("img_1"), legacyImageObject("img_2"), buildRect("rect_1")]);
    const store = createMemoryAssetStore();
    const ids = ["a", "b"];
    let index = 0;

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW, generateId: () => ids[index++]! });

    expect(result.migratedCount).toBe(2);
    expect(result.project.document.assets).toHaveLength(2);
    expect(result.project.document.assets.map((a) => a.id)).toEqual(["asset_a", "asset_b"]);
  });

  it("un ImageObject sin dataUrl embebido (assetId ya real) no se toca", async () => {
    const project = buildProject([
      {
        id: ObjectIdSchema.parse("img_1"),
        type: "image",
        assetId: AssetIdSchema.parse("asset_real"),
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        size: { width: 10, height: 10 },
        style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata,
        pluginData: {},
        customProperties: {},
      } as SceneObject,
    ]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW });

    expect(result.migratedCount).toBe(0);
    expect(result.project).toBe(project);
  });

  it("sin generateId inyectado, usa crypto.randomUUID() real", async () => {
    const project = buildProject([legacyImageObject("img_1")]);
    const store = createMemoryAssetStore();

    const result = await migrateLegacyEmbeddedImages(project, store, { now: NOW });

    expect(result.project.document.assets[0]?.id).toMatch(/^asset_/);
  });
});
