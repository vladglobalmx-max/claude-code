import { MetadataSchema, type Project, type Metadata } from "@impulso/document-schema";
import { engineError, ok, err, type EngineResult } from "../errors/engineError.js";
import { findObjectInDocument, updateObjectInDocument } from "../tree/objectTree.js";
import type { ContentCommand } from "./command.js";

type UpdateMetadataCommand = Extract<ContentCommand, { type: "updateMetadata" }>;

function mergeMetadata(existing: Metadata, patch: Partial<Metadata>): EngineResult<Metadata> {
  const merged = MetadataSchema.safeParse({ ...existing, ...patch });
  if (!merged.success) {
    return err(engineError("invalid_metadata", merged.error.message));
  }
  return ok(merged.data);
}

/**
 * Un único comando cubre los cinco niveles que tienen Metadata (Project,
 * Document, Page, Layer, Object) — ver entityRef.ts. Nota deliberada:
 * `target.level === "project"` es el único caso que NO toca `document` en
 * absoluto, así que `applyCommand.ts` lo trata como un caso especial que no
 * incrementa `documentVersion` ni agrega una entrada de `history` (el
 * contenido del documento no cambió, solo metadata del Project en sí).
 */
export function updateMetadata(project: Project, command: UpdateMetadataCommand): EngineResult<Project> {
  const { target, metadata: patch } = command;

  switch (target.level) {
    case "project": {
      const merged = mergeMetadata(project.metadata, patch);
      if (!merged.ok) return merged;
      return ok({ ...project, metadata: merged.value });
    }

    case "document": {
      const merged = mergeMetadata(project.document.metadata, patch);
      if (!merged.ok) return merged;
      return ok({ ...project, document: { ...project.document, metadata: merged.value } });
    }

    case "page": {
      const pageIndex = project.document.pages.findIndex((page) => page.id === target.pageId);
      if (pageIndex === -1) {
        return err(engineError("page_not_found", `No existe una página con id "${target.pageId}".`));
      }
      const page = project.document.pages[pageIndex]!;
      const merged = mergeMetadata(page.metadata, patch);
      if (!merged.ok) return merged;
      const pages = [...project.document.pages];
      pages[pageIndex] = { ...page, metadata: merged.value };
      return ok({ ...project, document: { ...project.document, pages } });
    }

    case "layer": {
      const pageIndex = project.document.pages.findIndex((page) => page.id === target.pageId);
      if (pageIndex === -1) {
        return err(engineError("page_not_found", `No existe una página con id "${target.pageId}".`));
      }
      const page = project.document.pages[pageIndex]!;
      const layerIndex = page.layers.findIndex((layer) => layer.id === target.layerId);
      if (layerIndex === -1) {
        return err(engineError("layer_not_found", `No existe una layer con id "${target.layerId}" en esa página.`));
      }
      const layer = page.layers[layerIndex]!;
      const merged = mergeMetadata(layer.metadata, patch);
      if (!merged.ok) return merged;
      const layers = [...page.layers];
      layers[layerIndex] = { ...layer, metadata: merged.value };
      const pages = [...project.document.pages];
      pages[pageIndex] = { ...page, layers };
      return ok({ ...project, document: { ...project.document, pages } });
    }

    case "object": {
      const existing = findObjectInDocument(project.document, target.objectId);
      if (!existing) {
        return err(engineError("object_not_found", `No existe un Object con id "${target.objectId}".`));
      }
      const merged = mergeMetadata(existing.metadata, patch);
      if (!merged.ok) return merged;
      const document = updateObjectInDocument(project.document, target.objectId, (object) => ({
        ...object,
        metadata: merged.value,
      }));
      return ok({ ...project, document });
    }

    case "asset": {
      const assetIndex = project.document.assets.findIndex((asset) => asset.id === target.assetId);
      if (assetIndex === -1) {
        return err(engineError("asset_not_found", `No existe un Asset con id "${target.assetId}".`));
      }
      const existing = project.document.assets[assetIndex]!;
      const merged = mergeMetadata(existing.metadata, patch);
      if (!merged.ok) return merged;
      const assets = [...project.document.assets];
      assets[assetIndex] = { ...existing, metadata: merged.value };
      return ok({ ...project, document: { ...project.document, assets } });
    }
  }
}
