import type { Project } from "@impulso/document-schema";
import { instantiateTemplate, type TemplateDescriptor, type TemplateStore } from "@impulso/template-library";
import { createProjectFromSize } from "./projectPresets.js";

const CUSTOM_CARD_ID = "__custom__";
const DEFAULT_CUSTOM_WIDTH_MM = 50;
const DEFAULT_CUSTOM_HEIGHT_MM = 50;

export interface NewProjectDialog {
  open(): Promise<void>;
  close(): void;
  destroy(): void;
}

export interface MountNewProjectDialogOptions {
  templateStore: TemplateStore;
  /** Qué módulo filtrar en la galería — "sticker-builder" hoy; cualquier
   * módulo futuro pasa el suyo (Templates es agnóstico al módulo, ver
   * ADR-0013). */
  moduleId: string;
  onCreate: (project: Project) => void;
  now?: () => string;
  generateId?: () => string;
}

/**
 * Modal "Crear proyecto nuevo": galería de Templates (`@impulso/template-library`,
 * filtrada por `moduleId`) + una tarjeta "Personalizado" (ancho/alto libres
 * en mm, sin línea de corte predefinida). Templates es el único punto de
 * entrada para crear un proyecto — los 3 tamaños curados de Epic 1 ahora
 * son Templates incorporados (`builtInTemplates.ts`), no un sistema
 * paralelo (ver ADR-0013). Overlay propio en vez de `<dialog>` nativo —
 * jsdom no implementa `showModal()` — ver ADR-0010.
 */
export function mountNewProjectDialog(container: HTMLElement, options: MountNewProjectDialogOptions): NewProjectDialog {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  const overlay = document.createElement("div");
  overlay.className = "new-project-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "new-project-dialog";
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.textContent = "Nuevo proyecto";
  dialog.appendChild(title);

  const statusMessage = document.createElement("p");
  statusMessage.className = "new-project-dialog-status";
  statusMessage.style.display = "none";
  dialog.appendChild(statusMessage);

  const grid = document.createElement("div");
  grid.className = "new-project-dialog-grid";
  dialog.appendChild(grid);

  const customFields = document.createElement("div");
  customFields.className = "new-project-dialog-custom-fields";
  customFields.style.display = "none";

  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.className = "new-project-dialog-width";
  widthInput.value = String(DEFAULT_CUSTOM_WIDTH_MM);

  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "new-project-dialog-height";
  heightInput.value = String(DEFAULT_CUSTOM_HEIGHT_MM);

  customFields.appendChild(document.createTextNode("Ancho (mm)"));
  customFields.appendChild(widthInput);
  customFields.appendChild(document.createTextNode("Alto (mm)"));
  customFields.appendChild(heightInput);
  dialog.appendChild(customFields);

  const errorMessage = document.createElement("p");
  errorMessage.className = "new-project-dialog-error";
  errorMessage.style.display = "none";
  dialog.appendChild(errorMessage);

  const actions = document.createElement("div");
  actions.className = "new-project-dialog-actions";
  dialog.appendChild(actions);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "new-project-dialog-cancel";
  cancelButton.textContent = "Cancelar";
  actions.appendChild(cancelButton);

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "new-project-dialog-create";
  createButton.textContent = "Crear";
  actions.appendChild(createButton);

  let selectedId: string | null = null;
  let objectUrls: string[] = [];
  const cardsById = new Map<string, HTMLElement>();

  function revokeObjectUrls(): void {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls = [];
  }

  function selectCard(id: string): void {
    selectedId = id;
    for (const card of cardsById.values()) card.classList.remove("selected");
    cardsById.get(id)?.classList.add("selected");
    customFields.style.display = id === CUSTOM_CARD_ID ? "block" : "none";
  }

  function buildTemplateCard(descriptor: TemplateDescriptor): HTMLElement {
    const card = document.createElement("div");
    card.className = "new-project-card";

    const thumbnail = document.createElement("img");
    thumbnail.className = "new-project-card-thumbnail";
    thumbnail.alt = descriptor.name;
    card.appendChild(thumbnail);

    void options.templateStore.getContent(descriptor.id).then((content) => {
      if (content?.thumbnail) {
        const url = URL.createObjectURL(content.thumbnail);
        objectUrls.push(url);
        thumbnail.src = url;
      }
    });

    const name = document.createElement("span");
    name.className = "new-project-card-name";
    name.textContent = descriptor.name;
    card.appendChild(name);

    if (!descriptor.builtIn) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "new-project-card-delete";
      deleteButton.textContent = "🗑";
      deleteButton.title = "Eliminar plantilla";
      deleteButton.addEventListener("click", (evt) => {
        evt.stopPropagation();
        void options.templateStore.delete(descriptor.id).then(() => renderGrid());
      });
      card.appendChild(deleteButton);
    }

    card.addEventListener("click", () => selectCard(descriptor.id));
    return card;
  }

  function buildCustomCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "new-project-card new-project-card-custom";
    const name = document.createElement("span");
    name.className = "new-project-card-name";
    name.textContent = "Personalizado";
    card.appendChild(name);
    card.addEventListener("click", () => selectCard(CUSTOM_CARD_ID));
    return card;
  }

  async function renderGrid(): Promise<void> {
    grid.innerHTML = "";
    cardsById.clear();
    revokeObjectUrls();
    statusMessage.textContent = "Cargando plantillas…";
    statusMessage.style.display = "block";
    errorMessage.style.display = "none";

    let descriptors: TemplateDescriptor[];
    try {
      descriptors = await options.templateStore.listDescriptors({ moduleId: options.moduleId });
    } catch (error) {
      statusMessage.style.display = "none";
      errorMessage.textContent = `No se pudieron cargar las plantillas: ${(error as Error).message}`;
      errorMessage.style.display = "block";
      descriptors = [];
    }
    statusMessage.style.display = "none";

    for (const descriptor of descriptors) {
      const card = buildTemplateCard(descriptor);
      cardsById.set(descriptor.id, card);
      grid.appendChild(card);
    }

    const customCard = buildCustomCard();
    cardsById.set(CUSTOM_CARD_ID, customCard);
    grid.appendChild(customCard);

    selectCard(descriptors[0]?.id ?? CUSTOM_CARD_ID);
  }

  function close(): void {
    overlay.style.display = "none";
    revokeObjectUrls();
  }

  async function open(): Promise<void> {
    errorMessage.style.display = "none";
    widthInput.value = String(DEFAULT_CUSTOM_WIDTH_MM);
    heightInput.value = String(DEFAULT_CUSTOM_HEIGHT_MM);
    overlay.style.display = "flex";
    await renderGrid();
  }

  function showError(message: string): void {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
  }

  createButton.addEventListener("click", () => {
    const id = selectedId ?? CUSTOM_CARD_ID;

    if (id === CUSTOM_CARD_ID) {
      const widthMm = Number(widthInput.value);
      const heightMm = Number(heightInput.value);
      if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
        showError("El ancho y el alto deben ser números mayores que cero.");
        return;
      }
      const project = createProjectFromSize({ widthMm, heightMm, shape: "custom", now: now(), generateId });
      close();
      options.onCreate(project);
      return;
    }

    void options.templateStore.getContent(id).then((content) => {
      if (!content) {
        showError("No se pudo cargar la plantilla seleccionada.");
        return;
      }
      const project = instantiateTemplate(content.project, { now: now(), generateId });
      close();
      options.onCreate(project);
    });
  });

  cancelButton.addEventListener("click", close);

  container.appendChild(overlay);

  return {
    open,
    close,
    destroy: () => {
      revokeObjectUrls();
      overlay.remove();
    },
  };
}
