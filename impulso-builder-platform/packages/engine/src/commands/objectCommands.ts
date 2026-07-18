import {
  TransformSchema,
  StyleSchema,
  type Project,
  type Document,
} from "@impulso/document-schema";
import { engineError, ok, err, type EngineResult } from "../errors/engineError.js";
import { findObjectInDocument, updateObjectInDocument, removeObjectFromDocument } from "../tree/objectTree.js";
import { isPermutationOf } from "./permutation.js";
import type { ContentCommand } from "./command.js";

type AddObjectCommand = Extract<ContentCommand, { type: "addObject" }>;
type RemoveObjectCommand = Extract<ContentCommand, { type: "removeObject" }>;
type UpdateObjectTransformCommand = Extract<ContentCommand, { type: "updateObjectTransform" }>;
type UpdateObjectStyleCommand = Extract<ContentCommand, { type: "updateObjectStyle" }>;
type UpdateObjectContentCommand = Extract<ContentCommand, { type: "updateObjectContent" }>;
type ReorderObjectsCommand = Extract<ContentCommand, { type: "reorderObjects" }>;

function withDocument(project: Project, document: Document): Project {
  return { ...project, document };
}

export function addObject(project: Project, command: AddObjectCommand): EngineResult<Project> {
  const { document } = project;
  const pageIndex = document.pages.findIndex((page) => page.id === command.pageId);
  if (pageIndex === -1) {
    return err(engineError("page_not_found", `No existe una página con id "${command.pageId}".`));
  }
  const page = document.pages[pageIndex]!;
  const layerIndex = page.layers.findIndex((layer) => layer.id === command.layerId);
  if (layerIndex === -1) {
    return err(engineError("layer_not_found", `No existe una layer con id "${command.layerId}" en esa página.`));
  }
  if (findObjectInDocument(document, command.object.id)) {
    return err(engineError("invalid_reorder", `Ya existe un Object con id "${command.object.id}" en el documento.`));
  }

  const layer = page.layers[layerIndex]!;
  const objects = [...layer.objects];
  const insertAt = Math.min(command.index ?? objects.length, objects.length);
  objects.splice(insertAt, 0, command.object);

  const layers = [...page.layers];
  layers[layerIndex] = { ...layer, objects };
  const pages = [...document.pages];
  pages[pageIndex] = { ...page, layers };

  return ok(withDocument(project, { ...document, pages }));
}

export function removeObject(project: Project, command: RemoveObjectCommand): EngineResult<Project> {
  if (!findObjectInDocument(project.document, command.objectId)) {
    return err(engineError("object_not_found", `No existe un Object con id "${command.objectId}".`));
  }
  return ok(withDocument(project, removeObjectFromDocument(project.document, command.objectId)));
}

export function updateObjectTransform(
  project: Project,
  command: UpdateObjectTransformCommand,
): EngineResult<Project> {
  const existing = findObjectInDocument(project.document, command.objectId);
  if (!existing) {
    return err(engineError("object_not_found", `No existe un Object con id "${command.objectId}".`));
  }
  const merged = TransformSchema.safeParse({ ...existing.transform, ...command.transform });
  if (!merged.success) {
    return err(engineError("invalid_transform", merged.error.message));
  }
  const document = updateObjectInDocument(project.document, command.objectId, (object) => ({
    ...object,
    transform: merged.data,
  }));
  return ok(withDocument(project, document));
}

export function updateObjectStyle(project: Project, command: UpdateObjectStyleCommand): EngineResult<Project> {
  const existing = findObjectInDocument(project.document, command.objectId);
  if (!existing) {
    return err(engineError("object_not_found", `No existe un Object con id "${command.objectId}".`));
  }
  const merged = StyleSchema.safeParse({ ...existing.style, ...command.style });
  if (!merged.success) {
    return err(engineError("invalid_style", merged.error.message));
  }
  const document = updateObjectInDocument(project.document, command.objectId, (object) => ({
    ...object,
    style: merged.data,
  }));
  return ok(withDocument(project, document));
}

/**
 * Solo aplica a `TextObject.content` — cualquier otro tipo rechaza el
 * comando en vez de ignorarlo silenciosamente (mismo criterio que
 * `updateObjectStyle` rechaza un style resultante inválido, no lo descarta
 * en silencio).
 */
export function updateObjectContent(project: Project, command: UpdateObjectContentCommand): EngineResult<Project> {
  const existing = findObjectInDocument(project.document, command.objectId);
  if (!existing) {
    return err(engineError("object_not_found", `No existe un Object con id "${command.objectId}".`));
  }
  if (existing.type !== "text") {
    return err(
      engineError("invalid_content", `El Object "${command.objectId}" no es de tipo "text"; no tiene contenido de texto.`),
    );
  }
  // La rama `: object` es defensiva: ya se confirmó arriba que `existing`
  // (mismo id) es "text" antes de llegar aquí, así que no hay un camino
  // conocido para ejercitarla — se mantiene por seguridad ante un futuro
  // refactor, no por un caso real observado (mismo criterio que la guarda
  // de tipos en `renderer.ts`, ver su README).
  const document = updateObjectInDocument(project.document, command.objectId, (object) =>
    object.type === "text" ? { ...object, content: command.content } : object,
  );
  return ok(withDocument(project, document));
}

/**
 * Reordena solo los hijos directos (nivel superior) de una Layer. Reordenar
 * los hijos de un Group anidado queda fuera de alcance de Foundation 2 (no
 * se pidió); un futuro `reorderGroupChildren` podría agregarse sin afectar
 * este comando.
 */
export function reorderObjects(project: Project, command: ReorderObjectsCommand): EngineResult<Project> {
  const { document } = project;
  const pageIndex = document.pages.findIndex((page) => page.id === command.pageId);
  if (pageIndex === -1) {
    return err(engineError("page_not_found", `No existe una página con id "${command.pageId}".`));
  }
  const page = document.pages[pageIndex]!;
  const layerIndex = page.layers.findIndex((layer) => layer.id === command.layerId);
  if (layerIndex === -1) {
    return err(engineError("layer_not_found", `No existe una layer con id "${command.layerId}" en esa página.`));
  }
  const layer = page.layers[layerIndex]!;
  const currentIds = layer.objects.map((object) => object.id);
  if (!isPermutationOf(command.objectIds, currentIds)) {
    return err(
      engineError(
        "invalid_reorder",
        "reorderObjects requiere exactamente el mismo conjunto de objects de nivel superior de esa layer.",
      ),
    );
  }
  const byId = new Map(layer.objects.map((object) => [object.id, object]));
  const reordered = command.objectIds.map((id) => byId.get(id)!);

  const layers = [...page.layers];
  layers[layerIndex] = { ...layer, objects: reordered };
  const pages = [...document.pages];
  pages[pageIndex] = { ...page, layers };

  return ok(withDocument(project, { ...document, pages }));
}
