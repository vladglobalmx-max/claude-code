import type { Project, ProjectId } from "@impulso/document-schema";
import { duplicateProject, type ProjectDescriptor, type ProjectStore } from "@impulso/project-library";
import type { TemplateStore } from "@impulso/template-library";
import { mountNewProjectDialog, type NewProjectDialog } from "./newProjectDialog.js";
import { createLazyBuiltInTemplateSeeder } from "./builtInTemplates.js";
import { createThumbnailGenerator } from "./app.js";

export interface Workspace {
  refresh(): Promise<void>;
  destroy(): void;
}

export interface MountWorkspaceOptions {
  projectStore: ProjectStore;
  templateStore: TemplateStore;
  /** Qué módulo filtrar — "sticker-builder" hoy; cualquier módulo futuro
   * monta su propia Workspace pasando el suyo (ver ADR-0014). */
  moduleId: string;
  /** Se llama cuando el usuario elige abrir o crear un proyecto — la app
   * decide qué hacer con él (montar el editor). */
  onOpenProject: (project: Project) => void;
  now?: () => string;
  generateId?: () => string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * "Mis proyectos": pantalla de aterrizaje de la app (Workspace-first, ver
 * ADR-0014) — grilla de proyectos guardados con Abrir/Renombrar/Duplicar
 * proyecto/Eliminar, ordenada por última edición. "Nuevo proyecto" reutiliza
 * la galería de Templates ya existente (`newProjectDialog.ts`, Epic 4) tal
 * cual, montada en su propio contenedor con su propio callback `onCreate`.
 *
 * "Duplicar proyecto" es un nombre deliberadamente distinto del botón
 * "Duplicar" del editor (que duplica un *object* seleccionado dentro del
 * canvas) — acciones completamente distintas que conviven en la misma app.
 */
export function mountWorkspace(container: HTMLElement, options: MountWorkspaceOptions): Workspace {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  const root = document.createElement("div");
  root.className = "workspace-screen";

  const header = document.createElement("div");
  header.className = "workspace-header";
  const title = document.createElement("h1");
  title.textContent = "Mis proyectos";
  header.appendChild(title);

  const newButton = document.createElement("button");
  newButton.type = "button";
  newButton.className = "workspace-new-btn";
  newButton.textContent = "Nuevo proyecto";
  header.appendChild(newButton);
  root.appendChild(header);

  const errorMessage = document.createElement("p");
  errorMessage.className = "workspace-error";
  errorMessage.style.display = "none";
  root.appendChild(errorMessage);

  const emptyMessage = document.createElement("p");
  emptyMessage.className = "workspace-empty";
  emptyMessage.textContent = "Todavía no tienes proyectos guardados. Crea uno para empezar.";
  emptyMessage.style.display = "none";
  root.appendChild(emptyMessage);

  const grid = document.createElement("div");
  grid.className = "workspace-grid";
  root.appendChild(grid);

  const newProjectDialogContainer = document.createElement("div");
  root.appendChild(newProjectDialogContainer);

  container.appendChild(root);

  let objectUrls: string[] = [];
  function revokeObjectUrls(): void {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
  }

  function handleOpen(id: ProjectId): void {
    void options.projectStore.getProject(id).then((project) => {
      if (project) options.onOpenProject(project);
    });
  }

  async function handleRename(id: ProjectId, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) {
      await refresh();
      return;
    }
    const project = await options.projectStore.getProject(id);
    if (!project) return;
    await options.projectStore.save({ ...project, metadata: { ...project.metadata, name: trimmed, updatedAt: now() } });
    await refresh();
  }

  function handleDuplicate(id: ProjectId): void {
    void duplicateProject(options.projectStore, id, { now: now(), generateId }).then(() => refresh());
  }

  function handleDelete(id: ProjectId, name: string): void {
    if (!window.confirm(`¿Eliminar el proyecto "${name}"? Esta acción no se puede deshacer.`)) return;
    void options.projectStore.delete(id).then(() => refresh());
  }

  function startRename(nameSpan: HTMLElement, descriptor: ProjectDescriptor): void {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "workspace-card-name-input";
    input.value = descriptor.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    function commit(): void {
      if (settled) return;
      settled = true;
      void handleRename(descriptor.id, input.value);
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        commit();
      } else if (evt.key === "Escape") {
        settled = true;
        void refresh();
      }
    });
  }

  function buildCard(descriptor: ProjectDescriptor): HTMLElement {
    const card = document.createElement("div");
    card.className = "workspace-card";

    const thumbnail = document.createElement("img");
    thumbnail.className = "workspace-card-thumbnail";
    thumbnail.alt = descriptor.name;
    if (descriptor.thumbnail) {
      const url = URL.createObjectURL(descriptor.thumbnail);
      objectUrls.push(url);
      thumbnail.src = url;
    }
    thumbnail.addEventListener("click", () => handleOpen(descriptor.id));
    card.appendChild(thumbnail);

    const nameRow = document.createElement("div");
    nameRow.className = "workspace-card-name-row";
    const name = document.createElement("span");
    name.className = "workspace-card-name";
    name.textContent = descriptor.name;
    name.addEventListener("click", () => handleOpen(descriptor.id));
    nameRow.appendChild(name);

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "workspace-card-rename";
    renameButton.title = "Renombrar";
    renameButton.textContent = "✏️";
    renameButton.addEventListener("click", (evt) => {
      evt.stopPropagation();
      startRename(name, descriptor);
    });
    nameRow.appendChild(renameButton);
    card.appendChild(nameRow);

    const updated = document.createElement("span");
    updated.className = "workspace-card-updated";
    updated.textContent = `Editado ${formatDate(descriptor.updatedAt)}`;
    card.appendChild(updated);

    const actions = document.createElement("div");
    actions.className = "workspace-card-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "workspace-card-open";
    openButton.textContent = "Abrir";
    openButton.addEventListener("click", () => handleOpen(descriptor.id));
    actions.appendChild(openButton);

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button";
    duplicateButton.className = "workspace-card-duplicate";
    duplicateButton.textContent = "Duplicar proyecto";
    duplicateButton.addEventListener("click", () => handleDuplicate(descriptor.id));
    actions.appendChild(duplicateButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "workspace-card-delete";
    deleteButton.textContent = "Eliminar";
    deleteButton.addEventListener("click", () => handleDelete(descriptor.id, descriptor.name));
    actions.appendChild(deleteButton);

    card.appendChild(actions);
    return card;
  }

  async function refresh(): Promise<void> {
    grid.innerHTML = "";
    revokeObjectUrls();
    errorMessage.style.display = "none";

    let descriptors: ProjectDescriptor[];
    try {
      descriptors = await options.projectStore.listDescriptors({ moduleId: options.moduleId });
    } catch (error) {
      errorMessage.textContent = `No se pudieron cargar tus proyectos: ${(error as Error).message}`;
      errorMessage.style.display = "block";
      descriptors = [];
    }

    descriptors.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    emptyMessage.style.display = descriptors.length === 0 ? "block" : "none";

    for (const descriptor of descriptors) {
      grid.appendChild(buildCard(descriptor));
    }
  }

  const newProjectDialog: NewProjectDialog = mountNewProjectDialog(newProjectDialogContainer, {
    templateStore: options.templateStore,
    moduleId: options.moduleId,
    now,
    generateId,
    onCreate: (project) => options.onOpenProject(project),
  });

  // Propia instancia del sembrado perezoso de built-in — el botón "Nuevo
  // proyecto" de la Workspace es, desde esta épica, el punto de entrada
  // primario para crear un proyecto (ver ADR-0014); `app.ts` mantiene la
  // suya propia para su botón "Nuevo" interno del editor. Ambas son
  // inofensivamente redundantes: `seedBuiltInTemplates` es idempotente.
  const builtInTemplatesSeeder = createLazyBuiltInTemplateSeeder(options.templateStore, {
    now,
    generateThumbnail: createThumbnailGenerator({ resolve: () => Promise.resolve(undefined) }),
  });
  newButton.addEventListener("click", () => {
    void builtInTemplatesSeeder.ensureSeeded().then(() => newProjectDialog.open());
  });

  void refresh();

  return {
    refresh,
    destroy: () => {
      revokeObjectUrls();
      newProjectDialog.destroy();
      root.remove();
    },
  };
}
