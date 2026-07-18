import { ProjectSchema, type Project, type HistoryEntry } from "@impulso/document-schema";
import { engineError, err, type EngineResult } from "../errors/engineError.js";
import type { ContentCommand } from "./command.js";
import { addPage, removePage, reorderPages } from "./pageCommands.js";
import { addLayer, removeLayer, reorderLayers } from "./layerCommands.js";
import {
  addObject,
  removeObject,
  updateObjectTransform,
  updateObjectStyle,
  updateObjectContent,
  reorderObjects,
} from "./objectCommands.js";
import { updateMetadata } from "./metadataCommand.js";
import { resizeObject } from "./resizeObjectCommand.js";
import { rotateObject } from "./rotateObjectCommand.js";
import { groupObjects, ungroupObject } from "./groupCommands.js";
import { addAsset, removeAsset, renameAsset } from "./assetCommands.js";

function describeCommand(command: ContentCommand): string {
  switch (command.type) {
    case "addPage":
      return `Agregar página "${command.page.id}"`;
    case "removePage":
      return `Eliminar página "${command.pageId}"`;
    case "reorderPages":
      return "Reordenar páginas";
    case "addLayer":
      return `Agregar layer "${command.layer.id}"`;
    case "removeLayer":
      return `Eliminar layer "${command.layerId}"`;
    case "reorderLayers":
      return "Reordenar layers";
    case "addObject":
      return `Agregar object "${command.object.id}" (${command.object.type})`;
    case "removeObject":
      return `Eliminar object "${command.objectId}"`;
    case "updateObjectTransform":
      return `Transformar object "${command.objectId}"`;
    case "updateObjectStyle":
      return `Cambiar estilo de object "${command.objectId}"`;
    case "reorderObjects":
      return "Reordenar objects";
    case "updateMetadata":
      return `Actualizar metadata (${command.target.level})`;
    case "resizeObject":
      return `Redimensionar object "${command.objectId}" (handle: ${command.handle})`;
    case "rotateObject":
      return `Rotar object "${command.objectId}"`;
    case "updateObjectContent":
      return `Cambiar contenido de object "${command.objectId}"`;
    case "groupObjects":
      return `Agrupar ${command.objectIds.length} objects en "${command.group.id}"`;
    case "ungroupObject":
      return `Desagrupar "${command.objectId}"`;
    case "addAsset":
      return `Agregar asset "${command.asset.id}" (${command.asset.type})`;
    case "removeAsset":
      return `Eliminar asset "${command.assetId}"`;
    case "renameAsset":
      return `Renombrar asset "${command.assetId}"`;
  }
}

function runReducer(project: Project, command: ContentCommand): EngineResult<Project> {
  switch (command.type) {
    case "addPage":
      return addPage(project, command);
    case "removePage":
      return removePage(project, command);
    case "reorderPages":
      return reorderPages(project, command);
    case "addLayer":
      return addLayer(project, command);
    case "removeLayer":
      return removeLayer(project, command);
    case "reorderLayers":
      return reorderLayers(project, command);
    case "addObject":
      return addObject(project, command);
    case "removeObject":
      return removeObject(project, command);
    case "updateObjectTransform":
      return updateObjectTransform(project, command);
    case "updateObjectStyle":
      return updateObjectStyle(project, command);
    case "reorderObjects":
      return reorderObjects(project, command);
    case "updateMetadata":
      return updateMetadata(project, command);
    case "resizeObject":
      return resizeObject(project, command);
    case "rotateObject":
      return rotateObject(project, command);
    case "updateObjectContent":
      return updateObjectContent(project, command);
    case "groupObjects":
      return groupObjects(project, command);
    case "ungroupObject":
      return ungroupObject(project, command);
    case "addAsset":
      return addAsset(project, command);
    case "removeAsset":
      return removeAsset(project, command);
    case "renameAsset":
      return renameAsset(project, command);
  }
}

export interface ApplyContentCommandOptions {
  now: string;
  generateHistoryEntryId: () => string;
}

/**
 * Orquesta un ContentCommand: ejecuta el reducer específico y, salvo el
 * caso especial de `updateMetadata` a nivel "project" (que no toca
 * `document` en absoluto), incrementa `documentVersion`, agrega una entrada
 * a `document.history` y actualiza `updatedAt`. Termina con una validación
 * completa de `ProjectSchema` como red de seguridad: el Engine no puede
 * producir un Project inválido, sin importar qué haga un reducer individual.
 */
export function applyContentCommand(
  project: Project,
  command: ContentCommand,
  options: ApplyContentCommandOptions,
): EngineResult<Project> {
  const result = runReducer(project, command);
  if (!result.ok) return result;

  const isProjectOnlyMetadataUpdate = command.type === "updateMetadata" && command.target.level === "project";

  const withProjectTimestamp: Project = {
    ...result.value,
    metadata: { ...result.value.metadata, updatedAt: options.now },
  };

  const finalProject: Project = isProjectOnlyMetadataUpdate
    ? withProjectTimestamp
    : bumpDocumentVersion(withProjectTimestamp, command, options);

  const validated = ProjectSchema.safeParse(finalProject);
  if (!validated.success) {
    return err(engineError("invariant_violation", validated.error.message));
  }
  return { ok: true, value: validated.data };
}

function bumpDocumentVersion(
  project: Project,
  command: ContentCommand,
  options: ApplyContentCommandOptions,
): Project {
  const before = project.document.documentVersion;
  const after = before + 1;
  const historyEntry: HistoryEntry = {
    id: options.generateHistoryEntryId(),
    createdAt: options.now,
    description: describeCommand(command),
    documentVersionBefore: before,
    documentVersionAfter: after,
  };

  return {
    ...project,
    document: {
      ...project.document,
      documentVersion: after,
      metadata: { ...project.document.metadata, updatedAt: options.now },
      history: { entries: [...project.document.history.entries, historyEntry] },
    },
  };
}
