import { toPixels, type Project } from "@impulso/document-schema";
import {
  exportProject,
  sanitizeFilename,
  triggerBrowserDownload,
  ExportError,
  type ExportAssetResolver,
  type ExportBackground,
  type ExportScale,
  type ExportWarning,
} from "@impulso/export-engine";

export interface ExportDialog {
  open(): void;
  close(): void;
  destroy(): void;
}

export interface MountExportDialogOptions {
  getProject: () => Project;
  resolver: ExportAssetResolver;
  defaultFilename?: () => string;
}

type Format = "png" | "svg";

const SCALES: readonly ExportScale[] = [1, 2, 3, 4];
const DEFAULT_SOLID_COLOR = "#ffffff";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const WARNING_MESSAGES: Record<ExportWarning["code"], string> = {
  asset_reference_missing: "Una imagen referenciaba un Asset que ya no existe en la Biblioteca — se exportó un marcador de posición.",
  asset_binary_missing: "No se encontró el archivo de una imagen en la Biblioteca de Assets — se exportó un marcador de posición.",
  invalid_svg: "Un asset SVG no pudo leerse correctamente.",
  font_unavailable: "Una fuente usada en el documento no está disponible.",
};

/**
 * Modal "Exportar": mismo patrón de overlay propio que
 * `newProjectDialog.ts` (sin `<dialog>` nativo — jsdom no implementa
 * `showModal()`, ver ADR-0010). Formato PNG/SVG, opciones contextuales por
 * formato, dimensiones finales en vivo, nombre de archivo, estado de
 * procesamiento, warnings/errores explícitos y confirmación de descarga —
 * ver ADR-0012 (Epic 3).
 */
export function mountExportDialog(container: HTMLElement, options: MountExportDialogOptions): ExportDialog {
  let format: Format = "png";
  let scale: ExportScale = 1;
  let background: ExportBackground = { type: "transparent" };

  const overlay = document.createElement("div");
  overlay.className = "export-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "export-dialog";
  overlay.appendChild(dialog);

  const title = document.createElement("h2");
  title.textContent = "Exportar";
  dialog.appendChild(title);

  // --- Formato ---
  const formatRow = document.createElement("div");
  formatRow.className = "export-dialog-format";
  dialog.appendChild(formatRow);

  const pngRadio = document.createElement("input");
  pngRadio.type = "radio";
  pngRadio.name = "export-format";
  pngRadio.value = "png";
  pngRadio.checked = true;
  const pngLabel = document.createElement("label");
  pngLabel.appendChild(pngRadio);
  pngLabel.appendChild(document.createTextNode("PNG"));
  formatRow.appendChild(pngLabel);

  const svgRadio = document.createElement("input");
  svgRadio.type = "radio";
  svgRadio.name = "export-format";
  svgRadio.value = "svg";
  const svgLabel = document.createElement("label");
  svgLabel.appendChild(svgRadio);
  svgLabel.appendChild(document.createTextNode("SVG"));
  formatRow.appendChild(svgLabel);

  // --- Opciones PNG ---
  const pngOptions = document.createElement("div");
  pngOptions.className = "export-dialog-png-options";
  dialog.appendChild(pngOptions);

  const backgroundRow = document.createElement("div");
  backgroundRow.className = "export-dialog-background";
  const transparentRadio = document.createElement("input");
  transparentRadio.type = "radio";
  transparentRadio.name = "export-background";
  transparentRadio.value = "transparent";
  transparentRadio.checked = true;
  const transparentLabel = document.createElement("label");
  transparentLabel.appendChild(transparentRadio);
  transparentLabel.appendChild(document.createTextNode("Fondo transparente"));
  backgroundRow.appendChild(transparentLabel);

  const solidRadio = document.createElement("input");
  solidRadio.type = "radio";
  solidRadio.name = "export-background";
  solidRadio.value = "solid";
  const solidLabel = document.createElement("label");
  solidLabel.appendChild(solidRadio);
  solidLabel.appendChild(document.createTextNode("Fondo sólido"));
  backgroundRow.appendChild(solidLabel);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "export-dialog-color";
  colorInput.value = DEFAULT_SOLID_COLOR;
  colorInput.disabled = true;
  backgroundRow.appendChild(colorInput);
  pngOptions.appendChild(backgroundRow);

  const scaleRow = document.createElement("div");
  scaleRow.className = "export-dialog-scale";
  const scaleButtons: HTMLButtonElement[] = [];
  for (const value of SCALES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "export-dialog-scale-button";
    button.textContent = `${value}x`;
    button.dataset.scale = String(value);
    if (value === 1) button.classList.add("active");
    scaleButtons.push(button);
    scaleRow.appendChild(button);
  }
  pngOptions.appendChild(scaleRow);

  // --- Nombre de archivo ---
  const filenameRow = document.createElement("div");
  filenameRow.className = "export-dialog-filename";
  const filenameInput = document.createElement("input");
  filenameInput.type = "text";
  filenameInput.className = "export-dialog-filename-input";
  filenameRow.appendChild(document.createTextNode("Nombre de archivo"));
  filenameRow.appendChild(filenameInput);
  dialog.appendChild(filenameRow);

  // --- Dimensiones en vivo ---
  const dimensions = document.createElement("p");
  dimensions.className = "export-dialog-dimensions";
  dialog.appendChild(dimensions);

  // --- Estado / mensajes ---
  const statusMessage = document.createElement("p");
  statusMessage.className = "export-dialog-status";
  statusMessage.style.display = "none";
  dialog.appendChild(statusMessage);

  const errorMessage = document.createElement("p");
  errorMessage.className = "export-dialog-error";
  errorMessage.style.display = "none";
  dialog.appendChild(errorMessage);

  const warningsList = document.createElement("ul");
  warningsList.className = "export-dialog-warnings";
  warningsList.style.display = "none";
  dialog.appendChild(warningsList);

  // --- Acciones ---
  const actions = document.createElement("div");
  actions.className = "export-dialog-actions";
  dialog.appendChild(actions);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "export-dialog-cancel";
  cancelButton.textContent = "Cancelar";
  actions.appendChild(cancelButton);

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "export-dialog-export";
  exportButton.textContent = "Exportar";
  actions.appendChild(exportButton);

  function updatePngOptionsVisibility(): void {
    pngOptions.style.display = format === "png" ? "block" : "none";
  }

  function updateDimensions(): void {
    const page = options.getProject().document.pages[0];
    if (!page) {
      dimensions.textContent = "";
      return;
    }
    const widthPx = toPixels(page.size.width, page.unit);
    const heightPx = toPixels(page.size.height, page.unit);
    const effectiveScale = format === "png" ? scale : 1;
    const finalWidth = Math.round(widthPx * effectiveScale);
    const finalHeight = Math.round(heightPx * effectiveScale);
    dimensions.textContent = `Dimensiones finales: ${finalWidth} × ${finalHeight} px`;
  }

  function clearMessages(): void {
    statusMessage.style.display = "none";
    errorMessage.style.display = "none";
    warningsList.style.display = "none";
    warningsList.innerHTML = "";
  }

  function showWarnings(warnings: ExportWarning[]): void {
    if (warnings.length === 0) return;
    warningsList.innerHTML = "";
    for (const warning of warnings) {
      const item = document.createElement("li");
      item.textContent = WARNING_MESSAGES[warning.code] ?? warning.message;
      warningsList.appendChild(item);
    }
    warningsList.style.display = "block";
  }

  function showError(message: string): void {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
  }

  pngRadio.addEventListener("change", () => {
    format = "png";
    updatePngOptionsVisibility();
    updateDimensions();
  });
  svgRadio.addEventListener("change", () => {
    format = "svg";
    updatePngOptionsVisibility();
    updateDimensions();
  });

  transparentRadio.addEventListener("change", () => {
    background = { type: "transparent" };
    colorInput.disabled = true;
  });
  solidRadio.addEventListener("change", () => {
    background = { type: "solid", color: colorInput.value };
    colorInput.disabled = false;
  });
  colorInput.addEventListener("input", () => {
    if (solidRadio.checked) background = { type: "solid", color: colorInput.value };
  });

  for (const button of scaleButtons) {
    button.addEventListener("click", () => {
      scale = Number(button.dataset.scale) as ExportScale;
      for (const other of scaleButtons) other.classList.toggle("active", other === button);
      updateDimensions();
    });
  }

  exportButton.addEventListener("click", () => void doExport());

  async function doExport(): Promise<void> {
    clearMessages();
    let filename: string;
    try {
      filename = sanitizeFilename(filenameInput.value);
    } catch (error) {
      showError((error as ExportError).message);
      return;
    }

    exportButton.disabled = true;
    statusMessage.textContent = "Generando…";
    statusMessage.style.display = "block";

    try {
      const project = options.getProject();
      const result =
        format === "png"
          ? await exportProject(project, options.resolver, { format: "png", scale, background })
          : await exportProject(project, options.resolver, { format: "svg" });

      const extension = format === "png" ? "png" : "svg";
      triggerBrowserDownload(result.blob, `${filename}.${extension}`);

      statusMessage.textContent = `Descarga completada: ${filename}.${extension} (${formatBytes(result.byteSize)}).`;
      showWarnings(result.warnings);
    } catch (error) {
      statusMessage.style.display = "none";
      showError(error instanceof ExportError ? error.message : `No se pudo exportar: ${(error as Error).message}`);
    } finally {
      exportButton.disabled = false;
    }
  }

  cancelButton.addEventListener("click", close);

  function close(): void {
    overlay.style.display = "none";
  }

  function open(): void {
    format = "png";
    scale = 1;
    background = { type: "transparent" };
    pngRadio.checked = true;
    svgRadio.checked = false;
    transparentRadio.checked = true;
    solidRadio.checked = false;
    colorInput.value = DEFAULT_SOLID_COLOR;
    colorInput.disabled = true;
    for (const button of scaleButtons) button.classList.toggle("active", button.dataset.scale === "1");
    filenameInput.value = options.defaultFilename?.() ?? "sticker";
    clearMessages();
    updatePngOptionsVisibility();
    updateDimensions();
    overlay.style.display = "flex";
  }

  container.appendChild(overlay);

  return {
    open,
    close,
    destroy: () => overlay.remove(),
  };
}
