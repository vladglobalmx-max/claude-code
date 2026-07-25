import { describe, expect, it } from "vitest";
import {
  AssetIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";
import { createMemoryAssetStore } from "@impulso/asset-library";
import {
  PROJECT_BACKUP_SCHEMA_VERSION,
  ProjectBackupError,
  importProjectBackup,
  serializeProjectBackup,
} from "./projectBackup.js";

const NOW = "2026-07-25T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

// jsdom's Blob no implementa `.arrayBuffer()` (mismo motivo por el que
// projectBackup.ts usa FileReader en vez de Blob.arrayBuffer) — el test lee
// el Blob restaurado por el mismo camino ampliamente compatible.
function readBlobAsBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el blob."));
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.slice(result.indexOf(",") + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(bytes);
    };
    reader.readAsDataURL(blob);
  });
}

function buildProjectWithAsset(assetId: string): Project {
  return {
    id: ProjectIdSchema.parse("project_backup_test"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_backup_test"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: { width: 100, height: 100 },
          unit: "px",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      history: { entries: [] },
      assets: [
        {
          id: AssetIdSchema.parse(assetId),
          type: "image",
          name: "logo.png",
          mimeType: "image/png",
          width: 64,
          height: 64,
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      metadata,
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name: "Proyecto de prueba" },
    pluginData: {},
    customProperties: {},
  };
}

describe("serializeProjectBackup / importProjectBackup — round-trip", () => {
  it("un proyecto con un asset real sobrevive export -> import conservando contenido y el binario del asset", async () => {
    const sourceStore = createMemoryAssetStore();
    const assetId = AssetIdSchema.parse("asset_logo");
    const originalBytes = new Uint8Array([1, 2, 3, 4, 5]);
    await sourceStore.set(assetId, new Blob([originalBytes], { type: "image/png" }));

    const project = buildProjectWithAsset(assetId);
    const raw = await serializeProjectBackup(project, sourceStore, () => NOW);

    const destinationStore = createMemoryAssetStore();
    const result = await importProjectBackup(raw, destinationStore);

    expect(result.project).toEqual(project);
    expect(result.missingAssetIds).toEqual([]);

    const restoredBlob = await destinationStore.get(assetId);
    expect(restoredBlob).toBeDefined();
    const restoredBytes = await readBlobAsBytes(restoredBlob!);
    expect(Array.from(restoredBytes)).toEqual(Array.from(originalBytes));
    expect(restoredBlob!.type).toBe("image/png");
  });

  it("un asset ya faltante en el store de origen se omite del respaldo sin abortar, y se reporta como missingAssetIds al importar", async () => {
    const sourceStore = createMemoryAssetStore(); // sin escribir el asset — huérfano
    const project = buildProjectWithAsset("asset_missing");
    const raw = await serializeProjectBackup(project, sourceStore, () => NOW);

    const destinationStore = createMemoryAssetStore();
    const result = await importProjectBackup(raw, destinationStore);

    expect(result.project).toEqual(project);
    expect(result.missingAssetIds).toEqual(["asset_missing"]);
  });

  it("un proyecto sin ningún asset se respalda/restaura igual", async () => {
    const sourceStore = createMemoryAssetStore();
    const project: Project = { ...buildProjectWithAsset("unused"), document: { ...buildProjectWithAsset("unused").document, assets: [] } };
    const raw = await serializeProjectBackup(project, sourceStore, () => NOW);
    const destinationStore = createMemoryAssetStore();
    const result = await importProjectBackup(raw, destinationStore);
    expect(result.project.document.assets).toEqual([]);
    expect(result.missingAssetIds).toEqual([]);
  });

  it("el envelope incluye backupSchemaVersion y exportedAt", async () => {
    const sourceStore = createMemoryAssetStore();
    const project = buildProjectWithAsset("asset_x");
    const raw = await serializeProjectBackup(project, sourceStore, () => NOW);
    const parsed = JSON.parse(raw);
    expect(parsed.backupSchemaVersion).toBe(PROJECT_BACKUP_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe(NOW);
  });
});

describe("importProjectBackup — validación y errores diagnosticables", () => {
  it("rechaza un archivo que no es JSON", async () => {
    const store = createMemoryAssetStore();
    await expect(importProjectBackup("esto no es json", store)).rejects.toThrow(ProjectBackupError);
  });

  it("rechaza un JSON que no tiene forma de respaldo (sin 'project'/'backupSchemaVersion')", async () => {
    const store = createMemoryAssetStore();
    await expect(importProjectBackup(JSON.stringify({ foo: "bar" }), store)).rejects.toThrow(
      /formato de un respaldo/,
    );
  });

  it("rechaza una versión de schema de respaldo no soportada", async () => {
    const store = createMemoryAssetStore();
    const project = buildProjectWithAsset("asset_x");
    const badEnvelope = JSON.stringify({ backupSchemaVersion: 999, exportedAt: NOW, project, assets: [] });
    await expect(importProjectBackup(badEnvelope, store)).rejects.toThrow(/versión no soportada/);
  });

  it("rechaza un Project corrupto dentro de un envelope por lo demás válido", async () => {
    const store = createMemoryAssetStore();
    const badEnvelope = JSON.stringify({
      backupSchemaVersion: PROJECT_BACKUP_SCHEMA_VERSION,
      exportedAt: NOW,
      project: { id: "not-a-valid-project" },
      assets: [],
    });
    await expect(importProjectBackup(badEnvelope, store)).rejects.toThrow(/no es válido o está corrupto/);
  });
});
