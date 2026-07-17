import type { Project } from "@impulso/document-schema";
import { engineError, ok, err, type EngineResult } from "../errors/engineError.js";
import { isPermutationOf } from "./permutation.js";
import type { ContentCommand } from "./command.js";

type AddLayerCommand = Extract<ContentCommand, { type: "addLayer" }>;
type RemoveLayerCommand = Extract<ContentCommand, { type: "removeLayer" }>;
type ReorderLayersCommand = Extract<ContentCommand, { type: "reorderLayers" }>;

export function addLayer(project: Project, command: AddLayerCommand): EngineResult<Project> {
  const pageIndex = project.document.pages.findIndex((page) => page.id === command.pageId);
  if (pageIndex === -1) {
    return err(engineError("page_not_found", `No existe una página con id "${command.pageId}".`));
  }
  const page = project.document.pages[pageIndex]!;
  if (page.layers.some((layer) => layer.id === command.layer.id)) {
    return err(engineError("invalid_reorder", `Ya existe una layer con id "${command.layer.id}" en esa página.`));
  }
  const layers = [...page.layers];
  const insertAt = Math.min(command.index ?? layers.length, layers.length);
  layers.splice(insertAt, 0, command.layer);

  const pages = [...project.document.pages];
  pages[pageIndex] = { ...page, layers };
  return ok({ ...project, document: { ...project.document, pages } });
}

export function removeLayer(project: Project, command: RemoveLayerCommand): EngineResult<Project> {
  const pageIndex = project.document.pages.findIndex((page) => page.id === command.pageId);
  if (pageIndex === -1) {
    return err(engineError("page_not_found", `No existe una página con id "${command.pageId}".`));
  }
  const page = project.document.pages[pageIndex]!;
  if (!page.layers.some((layer) => layer.id === command.layerId)) {
    return err(engineError("layer_not_found", `No existe una layer con id "${command.layerId}" en esa página.`));
  }
  const pages = [...project.document.pages];
  pages[pageIndex] = { ...page, layers: page.layers.filter((layer) => layer.id !== command.layerId) };
  return ok({ ...project, document: { ...project.document, pages } });
}

export function reorderLayers(project: Project, command: ReorderLayersCommand): EngineResult<Project> {
  const pageIndex = project.document.pages.findIndex((page) => page.id === command.pageId);
  if (pageIndex === -1) {
    return err(engineError("page_not_found", `No existe una página con id "${command.pageId}".`));
  }
  const page = project.document.pages[pageIndex]!;
  const currentIds = page.layers.map((layer) => layer.id);
  if (!isPermutationOf(command.layerIds, currentIds)) {
    return err(engineError("invalid_reorder", "reorderLayers requiere exactamente el mismo conjunto de layers."));
  }
  const byId = new Map(page.layers.map((layer) => [layer.id, layer]));
  const reordered = command.layerIds.map((id) => byId.get(id)!);

  const pages = [...project.document.pages];
  pages[pageIndex] = { ...page, layers: reordered };
  return ok({ ...project, document: { ...project.document, pages } });
}
