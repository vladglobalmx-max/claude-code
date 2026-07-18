import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ObjectIdSchema,
  PageIdSchema,
  DocumentIdSchema,
  LayerIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import { ExportError, type ExportAssetResolver } from "@impulso/export-engine";
import { mountExportDialog } from "./exportDialog.js";

const NOW = "2026-07-18T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

const exportProjectMock = vi.fn();
const triggerBrowserDownloadMock = vi.fn();

vi.mock("@impulso/export-engine", async () => {
  const actual = await vi.importActual<typeof import("@impulso/export-engine")>("@impulso/export-engine");
  return {
    ...actual,
    exportProject: (...args: unknown[]) => exportProjectMock(...args),
    triggerBrowserDownload: (...args: unknown[]) => triggerBrowserDownloadMock(...args),
  };
});

function buildRect(id: string): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata,
    pluginData: {},
    customProperties: {},
  } as SceneObject;
}

function buildProject(): Project {
  return {
    id: ProjectIdSchema.parse("project_1"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_1"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: { width: 100, height: 100 },
          unit: "px",
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [buildRect("rect_1")], metadata, pluginData: {}, customProperties: {} }],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name: "test" },
    pluginData: {},
    customProperties: {},
  };
}

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

function successResult(overrides: Partial<{ byteSize: number; warnings: unknown[] }> = {}) {
  return {
    format: "png" as const,
    blob: new Blob(["x"], { type: "image/png" }),
    width: 100,
    height: 100,
    byteSize: overrides.byteSize ?? 1024,
    warnings: overrides.warnings ?? [],
  };
}

afterEach(() => {
  exportProjectMock.mockReset();
  triggerBrowserDownloadMock.mockReset();
});

describe("mountExportDialog", () => {
  it("está oculto al montar", () => {
    const div = container();
    mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    const overlay = div.querySelector(".export-dialog-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("none");
  });

  it("open()/close() alternan la visibilidad", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    expect((div.querySelector(".export-dialog-overlay") as HTMLElement).style.display).not.toBe("none");
    dialog.close();
    expect((div.querySelector(".export-dialog-overlay") as HTMLElement).style.display).toBe("none");
  });

  it("PNG es el formato por defecto; las opciones PNG están visibles", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    expect((div.querySelector(".export-dialog-png-options") as HTMLElement).style.display).not.toBe("none");
  });

  it("cambiar a SVG oculta las opciones PNG", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    const svgRadio = div.querySelector('input[value="svg"]') as HTMLInputElement;
    svgRadio.checked = true;
    svgRadio.dispatchEvent(new Event("change"));
    expect((div.querySelector(".export-dialog-png-options") as HTMLElement).style.display).toBe("none");
  });

  it("muestra las dimensiones finales a escala 1x por defecto", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    expect((div.querySelector(".export-dialog-dimensions") as HTMLElement).textContent).toContain("100 × 100 px");
  });

  it("cambiar la escala a 2x duplica las dimensiones mostradas", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    const scale2Button = Array.from(div.querySelectorAll(".export-dialog-scale-button")).find(
      (b) => (b as HTMLButtonElement).dataset.scale === "2",
    ) as HTMLButtonElement;
    scale2Button.click();
    expect((div.querySelector(".export-dialog-dimensions") as HTMLElement).textContent).toContain("200 × 200 px");
  });

  it("el selector de color de fondo empieza deshabilitado (transparente por defecto)", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    expect((div.querySelector(".export-dialog-color") as HTMLInputElement).disabled).toBe(true);
  });

  it("elegir 'Fondo sólido' habilita el selector de color", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    const solidRadio = div.querySelector('input[value="solid"]') as HTMLInputElement;
    solidRadio.checked = true;
    solidRadio.dispatchEvent(new Event("change"));
    expect((div.querySelector(".export-dialog-color") as HTMLInputElement).disabled).toBe(false);
  });

  it("nombre de archivo vacío muestra un error y no llama a exportProject", async () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    (div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value = "   ";
    (div.querySelector(".export-dialog-export") as HTMLButtonElement).click();
    await Promise.resolve();
    expect(exportProjectMock).not.toHaveBeenCalled();
    expect((div.querySelector(".export-dialog-error") as HTMLElement).style.display).toBe("block");
  });

  it("exporta PNG con el nombre/escala/fondo elegidos y dispara la descarga", async () => {
    exportProjectMock.mockResolvedValue(successResult());
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    (div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value = "mi-sticker";
    (div.querySelector(".export-dialog-export") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(exportProjectMock).toHaveBeenCalledWith(
      expect.anything(),
      noopResolver,
      expect.objectContaining({ format: "png", scale: 1, background: { type: "transparent" } }),
    );
    expect(triggerBrowserDownloadMock).toHaveBeenCalledWith(expect.any(Blob), "mi-sticker.png");
  });

  it("exporta SVG con la extensión correcta", async () => {
    exportProjectMock.mockResolvedValue({ ...successResult(), format: "svg" as const, blob: new Blob(["<svg/>"], { type: "image/svg+xml" }) });
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    const svgRadio = div.querySelector('input[value="svg"]') as HTMLInputElement;
    svgRadio.checked = true;
    svgRadio.dispatchEvent(new Event("change"));
    (div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value = "vector";
    (div.querySelector(".export-dialog-export") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(exportProjectMock).toHaveBeenCalledWith(expect.anything(), noopResolver, { format: "svg" });
    expect(triggerBrowserDownloadMock).toHaveBeenCalledWith(expect.any(Blob), "vector.svg");
  });

  it("al completar, muestra un mensaje de confirmación con el tamaño del archivo", async () => {
    exportProjectMock.mockResolvedValue(successResult({ byteSize: 2048 }));
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    (div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value = "sticker";
    (div.querySelector(".export-dialog-export") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const status = div.querySelector(".export-dialog-status") as HTMLElement;
    expect(status.textContent).toContain("sticker.png");
    expect(status.textContent).toContain("2.0 KB");
  });

  it("muestra los warnings del resultado en una lista", async () => {
    exportProjectMock.mockResolvedValue(
      successResult({ warnings: [{ code: "asset_binary_missing", message: "x", assetId: "asset_1" }] }),
    );
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    (div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value = "sticker";
    (div.querySelector(".export-dialog-export") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const warningsList = div.querySelector(".export-dialog-warnings") as HTMLElement;
    expect(warningsList.style.display).toBe("block");
    expect(warningsList.textContent).toContain("Biblioteca de Assets");
  });

  it("si exportProject lanza un ExportError, muestra su mensaje y reactiva el botón", async () => {
    exportProjectMock.mockRejectedValue(new ExportError("out_of_memory", "No se pudo generar el PNG."));
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.open();
    (div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value = "sticker";
    const exportButton = div.querySelector(".export-dialog-export") as HTMLButtonElement;
    exportButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect((div.querySelector(".export-dialog-error") as HTMLElement).textContent).toBe("No se pudo generar el PNG.");
    expect(exportButton.disabled).toBe(false);
    expect(triggerBrowserDownloadMock).not.toHaveBeenCalled();
  });

  it("open() usa defaultFilename() si se provee, o 'sticker' si no", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver, defaultFilename: () => "mi-proyecto" });
    dialog.open();
    expect((div.querySelector(".export-dialog-filename-input") as HTMLInputElement).value).toBe("mi-proyecto");
  });

  it("destroy() remueve el overlay del contenedor", () => {
    const div = container();
    const dialog = mountExportDialog(div, { getProject: buildProject, resolver: noopResolver });
    dialog.destroy();
    expect(div.querySelector(".export-dialog-overlay")).toBeNull();
  });
});
