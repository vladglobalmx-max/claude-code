import type { Project } from "@impulso/document-schema";
import { engineError, ok, err, type EngineResult } from "../errors/engineError.js";
import { isPermutationOf } from "./permutation.js";
import type { ContentCommand } from "./command.js";

type AddPageCommand = Extract<ContentCommand, { type: "addPage" }>;
type RemovePageCommand = Extract<ContentCommand, { type: "removePage" }>;
type ReorderPagesCommand = Extract<ContentCommand, { type: "reorderPages" }>;

export function addPage(project: Project, command: AddPageCommand): EngineResult<Project> {
  if (project.document.pages.some((page) => page.id === command.page.id)) {
    return err(engineError("invalid_reorder", `Ya existe una página con id "${command.page.id}".`));
  }
  const pages = [...project.document.pages];
  const insertAt = Math.min(command.index ?? pages.length, pages.length);
  pages.splice(insertAt, 0, command.page);
  return ok({ ...project, document: { ...project.document, pages } });
}

export function removePage(project: Project, command: RemovePageCommand): EngineResult<Project> {
  const { pages } = project.document;
  if (!pages.some((page) => page.id === command.pageId)) {
    return err(engineError("page_not_found", `No existe una página con id "${command.pageId}".`));
  }
  if (pages.length <= 1) {
    return err(engineError("cannot_remove_last_page", "Un Document debe conservar al menos una página."));
  }
  return ok({
    ...project,
    document: { ...project.document, pages: pages.filter((page) => page.id !== command.pageId) },
  });
}

export function reorderPages(project: Project, command: ReorderPagesCommand): EngineResult<Project> {
  const { pages } = project.document;
  const currentIds = pages.map((page) => page.id);
  if (!isPermutationOf(command.pageIds, currentIds)) {
    return err(engineError("invalid_reorder", "reorderPages requiere exactamente el mismo conjunto de páginas."));
  }
  const byId = new Map(pages.map((page) => [page.id, page]));
  // `!`: isPermutationOf ya garantizó que cada id de command.pageIds está en byId.
  const reordered = command.pageIds.map((id) => byId.get(id)!);
  return ok({ ...project, document: { ...project.document, pages: reordered } });
}
