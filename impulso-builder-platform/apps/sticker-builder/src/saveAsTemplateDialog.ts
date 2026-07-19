import type { Project } from "@impulso/document-schema";
import type { TemplateStore } from "@impulso/template-library";

export interface SaveAsTemplateDialog {
  open(): void;
  close(): void;
  destroy(): void;
}

export interface MountSaveAsTemplateDialogOptions {
  getProject: () => Project;
  templateStore: TemplateStore;
  moduleId: string;
  /** Cómo generar el thumbnail — inyectado por `app.ts` llamando a
   * `exportProject` de `@impulso/export-engine`; este módulo no depende de
   * Export Engine (mismo límite que `@impulso/template-library`, ver
   * ADR-0013). */
  generateThumbnail: (project: Project) => Promise<Blob>;
  onSaved?: () => void;
  now?: () => string;
  generateId?: () => string;
}

/**
 * Modal "Guardar como plantilla": nombre (requerido) + descripción
 * (opcional). Genera el thumbnail al momento de guardar y crea un
 * Template nuevo (`builtIn: false`, siempre eliminable desde la galería
 * de "Nuevo proyecto") a partir del `Project` actual. Mismo patrón de
 * overlay propio que el resto de los diálogos — ver ADR-0010/ADR-0013.
 */
export function mountSaveAsTemplateDialog(
  container: HTMLElement,
  options: MountSaveAsTemplateDialogOptions,
): SaveAsTemplateDialog {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  const overlay = document.createElement("div");
  overlay.className = "save-as-template-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "save-as-template-dialog";
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.textContent = "Guardar como plantilla";
  dialog.appendChild(title);

  const nameRow = document.createElement("div");
  nameRow.className = "save-as-template-dialog-field";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "save-as-template-dialog-name";
  nameInput.placeholder = "Nombre de la plantilla";
  nameRow.appendChild(document.createTextNode("Nombre"));
  nameRow.appendChild(nameInput);
  dialog.appendChild(nameRow);

  const descriptionRow = document.createElement("div");
  descriptionRow.className = "save-as-template-dialog-field";
  const descriptionInput = document.createElement("textarea");
  descriptionInput.className = "save-as-template-dialog-description";
  descriptionInput.placeholder = "Descripción (opcional)";
  descriptionRow.appendChild(document.createTextNode("Descripción"));
  descriptionRow.appendChild(descriptionInput);
  dialog.appendChild(descriptionRow);

  const statusMessage = document.createElement("p");
  statusMessage.className = "save-as-template-dialog-status";
  statusMessage.style.display = "none";
  dialog.appendChild(statusMessage);

  const errorMessage = document.createElement("p");
  errorMessage.className = "save-as-template-dialog-error";
  errorMessage.style.display = "none";
  dialog.appendChild(errorMessage);

  const actions = document.createElement("div");
  actions.className = "save-as-template-dialog-actions";
  dialog.appendChild(actions);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "save-as-template-dialog-cancel";
  cancelButton.textContent = "Cancelar";
  actions.appendChild(cancelButton);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "save-as-template-dialog-save";
  saveButton.textContent = "Guardar";
  actions.appendChild(saveButton);

  function showError(message: string): void {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
  }

  function close(): void {
    overlay.style.display = "none";
  }

  function open(): void {
    nameInput.value = "";
    descriptionInput.value = "";
    errorMessage.style.display = "none";
    statusMessage.style.display = "none";
    overlay.style.display = "flex";
  }

  async function doSave(): Promise<void> {
    const name = nameInput.value.trim();
    if (!name) {
      showError("El nombre no puede estar vacío.");
      return;
    }

    saveButton.disabled = true;
    errorMessage.style.display = "none";
    statusMessage.textContent = "Guardando…";
    statusMessage.style.display = "block";

    try {
      const project = options.getProject();
      const thumbnail = await options.generateThumbnail(project);
      const id = generateId();
      const timestamp = now();
      const description = descriptionInput.value.trim();

      await options.templateStore.save(
        {
          id,
          moduleId: options.moduleId,
          name,
          description: description.length > 0 ? description : undefined,
          tags: [],
          builtIn: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        { project, thumbnail },
      );

      close();
      options.onSaved?.();
    } catch (error) {
      statusMessage.style.display = "none";
      showError(`No se pudo guardar la plantilla: ${(error as Error).message}`);
    } finally {
      saveButton.disabled = false;
    }
  }

  saveButton.addEventListener("click", () => void doSave());
  cancelButton.addEventListener("click", close);

  container.appendChild(overlay);

  return {
    open,
    close,
    destroy: () => overlay.remove(),
  };
}
