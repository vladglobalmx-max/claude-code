import type { Project } from "@impulso/document-schema";
import { createProjectFromSize, STICKER_SIZE_PRESETS, type StickerShape } from "./projectPresets.js";

const CUSTOM_OPTION_VALUE = "custom";
const DEFAULT_CUSTOM_WIDTH_MM = 50;
const DEFAULT_CUSTOM_HEIGHT_MM = 50;

export interface NewProjectDialog {
  open(): void;
  close(): void;
  destroy(): void;
}

export interface MountNewProjectDialogOptions {
  onCreate: (project: Project) => void;
  now?: () => string;
  generateId?: () => string;
}

/**
 * Modal "Crear proyecto nuevo": los 3 presets curados de
 * `STICKER_SIZE_PRESETS` + "Personalizado" (ancho/alto libres en mm, sin
 * línea de corte predefinida). Overlay propio en vez de `<dialog>` nativo
 * — jsdom no implementa `showModal()`, y un overlay simple es igual de
 * testeable sin depender de esa API — ver ADR-0010.
 */
export function mountNewProjectDialog(container: HTMLElement, options: MountNewProjectDialogOptions): NewProjectDialog {
  const now = options.now ?? (() => new Date().toISOString());

  const overlay = document.createElement("div");
  overlay.className = "new-project-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "new-project-dialog";
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.textContent = "Nuevo proyecto";
  dialog.appendChild(title);

  const optionsList = document.createElement("div");
  optionsList.className = "new-project-dialog-options";
  dialog.appendChild(optionsList);

  const radios: HTMLInputElement[] = [];
  for (const preset of STICKER_SIZE_PRESETS) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "new-project-preset";
    radio.value = preset.id;
    radios.push(radio);
    label.appendChild(radio);
    label.appendChild(document.createTextNode(preset.label));
    optionsList.appendChild(label);
  }

  const customLabel = document.createElement("label");
  const customRadio = document.createElement("input");
  customRadio.type = "radio";
  customRadio.name = "new-project-preset";
  customRadio.value = CUSTOM_OPTION_VALUE;
  customRadio.className = "new-project-dialog-custom-radio";
  radios.push(customRadio);
  customLabel.appendChild(customRadio);
  customLabel.appendChild(document.createTextNode("Personalizado"));
  optionsList.appendChild(customLabel);

  radios[0]!.checked = true;

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

  function updateCustomFieldsVisibility(): void {
    customFields.style.display = customRadio.checked ? "block" : "none";
  }
  for (const radio of radios) {
    radio.addEventListener("change", updateCustomFieldsVisibility);
  }

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

  function close(): void {
    overlay.style.display = "none";
  }

  function open(): void {
    radios[0]!.checked = true;
    updateCustomFieldsVisibility();
    errorMessage.style.display = "none";
    widthInput.value = String(DEFAULT_CUSTOM_WIDTH_MM);
    heightInput.value = String(DEFAULT_CUSTOM_HEIGHT_MM);
    overlay.style.display = "flex";
  }

  function showError(message: string): void {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
  }

  createButton.addEventListener("click", () => {
    const selected = radios.find((radio) => radio.checked);
    // Defensivo: siempre hay un radio marcado (el primero se marca al montar
    // y en cada `open()`), así que `selected` no debería ser `undefined`.
    const selectedValue = selected?.value ?? STICKER_SIZE_PRESETS[0]!.id;

    let widthMm: number;
    let heightMm: number;
    let shape: StickerShape | "custom";

    if (selectedValue === CUSTOM_OPTION_VALUE) {
      widthMm = Number(widthInput.value);
      heightMm = Number(heightInput.value);
      shape = "custom";
      if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
        showError("El ancho y el alto deben ser números mayores que cero.");
        return;
      }
    } else {
      const preset = STICKER_SIZE_PRESETS.find((p) => p.id === selectedValue)!;
      widthMm = preset.widthMm;
      heightMm = preset.heightMm;
      shape = preset.shape;
    }

    const project = createProjectFromSize({ widthMm, heightMm, shape, now: now(), generateId: options.generateId });
    close();
    options.onCreate(project);
  });

  cancelButton.addEventListener("click", close);

  container.appendChild(overlay);

  return {
    open,
    close,
    destroy: () => overlay.remove(),
  };
}
