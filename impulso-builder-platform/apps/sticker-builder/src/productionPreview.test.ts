import { afterEach, describe, expect, it } from "vitest";
import {
  ObjectIdSchema,
  PageIdSchema,
  LayerIdSchema,
  DocumentIdSchema,
  ProjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type SceneObject,
} from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { createPrintJob, type GridImpositionSpec, type PrintJob } from "@impulso/print-engine";
import { mountProductionPreview } from "./productionPreview.js";

const NOW = "2026-07-20T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const style = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

function buildRect(id: string, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 20 },
    cornerRadius: 0,
    style: { ...style, fill: "#3366cc" },
    metadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  } as SceneObject;
}

function buildProject(objects: SceneObject[] = [buildRect("obj_1")], pageIds: string[] = ["page_1"]): Project {
  return {
    id: ProjectIdSchema.parse("project_1"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_1"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: pageIds.map((id, index) => ({
        id: PageIdSchema.parse(id),
        size: { width: 20, height: 20 },
        unit: "mm" as const,
        grid: { visible: false, snapEnabled: false, size: 10, type: "lines" as const },
        layers: [{ id: LayerIdSchema.parse(`layer_${index + 1}`), objects: index === 0 ? objects : [], metadata, pluginData: {}, customProperties: {} }],
        metadata,
        pluginData: {},
        customProperties: {},
      })),
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata,
    pluginData: {},
    customProperties: {},
  };
}

/** Hoja 50x50mm, pieza 20x20mm sin sangrado/marcas/gaps/márgenes —
 * capacidad determinista: columns=2, rows=2, capacidad=4 por hoja. */
function gridImposition(overrides: Partial<GridImpositionSpec> = {}): GridImpositionSpec {
  return {
    mode: "grid",
    sheet: { width: 50, height: 50, unit: "mm" },
    orientation: "portrait",
    quantity: 6,
    placementMode: "automatic",
    gapX: 0,
    gapY: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    alignment: "top-left",
    marksMode: "none",
    ...overrides,
  };
}

function buildPrintJob(project: Project, overrides: Parameters<typeof createPrintJob>[0]["overrides"] = {}): PrintJob {
  return createPrintJob({
    documentId: project.document.id,
    pageIds: project.document.pages.map((p) => p.id),
    dimensions: { width: 20, height: 20, unit: "mm" },
    profile: "sticker-sheet",
    now: () => NOW,
    overrides: {
      bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" },
      cropMarks: { enabled: false, length: 0, offset: 0, strokeWidth: 0, unit: "mm", color: "#000000" },
      cutPath: { mode: "none", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0, color: "#ff00ff", logicalLayerName: "CutContour" },
      imposition: gridImposition(),
      ...overrides,
    },
  });
}

const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

let container: HTMLElement;

afterEach(() => {
  container?.remove();
});

function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  return mountProductionPreview(container, { resolver: noopResolver });
}

describe("mountProductionPreview", () => {
  it("renderiza la primera hoja: 4 piezas de 6 en una hoja de capacidad 4, sin modificar el Project", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const before = JSON.parse(JSON.stringify(project));
    const preview = mount();

    await preview.render(project, printJob);

    expect(preview.snapshot).toMatchObject({ ready: true, sheetIndex: 0, sheetCount: 2, pieceCountOnSheet: 4, capacityPerSheet: 4, pageGroupIndex: 0, pageGroupCount: 1 });
    expect(JSON.parse(JSON.stringify(project))).toEqual(before);
    expect(container.querySelector(".production-preview-canvas-slot canvas")).not.toBeNull();
  });

  it("navega entre hojas (última hoja parcial: 2 de 4)", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);

    await preview.nextSheet();
    expect(preview.snapshot).toMatchObject({ sheetIndex: 1, pieceCountOnSheet: 2 });
    expect(container.querySelector(".production-preview-next-sheet") as HTMLButtonElement).toHaveProperty("disabled", true);

    await preview.prevSheet();
    expect(preview.snapshot).toMatchObject({ sheetIndex: 0, pieceCountOnSheet: 4 });
    expect(container.querySelector(".production-preview-prev-sheet") as HTMLButtonElement).toHaveProperty("disabled", true);
  });

  it("prevSheet() en la primera hoja no baja de 0", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);
    await preview.prevSheet();
    expect(preview.snapshot.sheetIndex).toBe(0);
  });

  it("nextSheet() más allá de la última hoja se recorta a la última hoja válida", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);
    await preview.nextSheet();
    await preview.nextSheet();
    expect(preview.snapshot.sheetIndex).toBe(1); // solo 2 hojas (índices 0 y 1)
  });

  it("navega entre grupos de página (cada pageId es un grupo de imposición independiente)", async () => {
    const project = buildProject([buildRect("obj_1")], ["page_1", "page_2"]);
    const printJob = buildPrintJob(project, { imposition: gridImposition({ quantity: 4 }) }); // 1 hoja exacta por página
    const preview = mount();
    await preview.render(project, printJob);

    expect(preview.snapshot).toMatchObject({ pageGroupIndex: 0, pageGroupCount: 2, sheetCount: 1 });

    await preview.nextPageGroup();
    expect(preview.snapshot.pageGroupIndex).toBe(1);
    expect(preview.snapshot.sheetIndex).toBe(0); // se reinicia la hoja al cambiar de página

    await preview.nextPageGroup(); // ya en la última, no avanza más
    expect(preview.snapshot.pageGroupIndex).toBe(1);

    await preview.prevPageGroup();
    expect(preview.snapshot.pageGroupIndex).toBe(0);
    await preview.prevPageGroup(); // ya en la primera, no baja de 0
    expect(preview.snapshot.pageGroupIndex).toBe(0);
  });

  it("imposition.mode !== 'grid': muestra un error legible, sin lanzar", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project, { imposition: { mode: "single" } });
    const preview = mount();

    await preview.render(project, printJob);

    expect(preview.snapshot.error).toMatch(/imposición/i);
    expect(container.querySelector(".production-preview-error") as HTMLElement).toHaveProperty("textContent", expect.stringContaining("imposición"));
  });

  it("imposición inválida (la pieza no cabe en la hoja): muestra un error con el motivo", async () => {
    const project = buildProject([buildRect("obj_1")]);
    // La pieza (20x20mm) es más grande que la hoja (10x10mm).
    const printJob = buildPrintJob(project, { imposition: gridImposition({ sheet: { width: 10, height: 10, unit: "mm" } }) });
    const preview = mount();

    await preview.render(project, printJob);

    expect(preview.snapshot.error).toMatch(/piece_does_not_fit/);
  });

  it("marksMode 'per-piece': dibuja segmentos de marca (>0), reflejados en el resumen", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project, {
      cropMarks: { enabled: true, length: 2, offset: 1, strokeWidth: 0.25, unit: "mm", color: "#000000" },
      imposition: gridImposition({ marksMode: "per-piece" }),
    });
    const preview = mount();
    await preview.render(project, printJob);

    const cropmarkLines = container.querySelectorAll(".production-preview-cropmark");
    expect(cropmarkLines.length).toBeGreaterThan(0);
    expect(container.querySelector(".production-preview-summary")!.textContent).toContain("per-piece");
  });

  it("marksMode 'none': no dibuja ninguna marca", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project, { imposition: gridImposition({ marksMode: "none" }) });
    const preview = mount();
    await preview.render(project, printJob);

    expect(container.querySelectorAll(".production-preview-cropmark").length).toBe(0);
  });

  it("cutPath 'die-cut' con die-line auto-detectado: dibuja un path por pieza colocada", async () => {
    const dieLine = buildRect("die_1", { metadata: { ...metadata, role: "die-line" } });
    const project = buildProject([dieLine]);
    const printJob = buildPrintJob(project, {
      cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
    });
    const preview = mount();
    await preview.render(project, printJob);

    const cutPathElements = container.querySelectorAll(".production-preview-cutpath");
    expect(cutPathElements.length).toBe(4); // capacidad de la primera hoja
  });

  it("cutPath activo pero sin die-line resoluble: no dibuja cut paths ni revienta", async () => {
    const project = buildProject(); // sin ningún object con role: die-line
    const printJob = buildPrintJob(project, {
      cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
    });
    const preview = mount();
    await preview.render(project, printJob);

    expect(container.querySelectorAll(".production-preview-cutpath").length).toBe(0);
  });

  it("los toggles de capas ocultan/muestran su grupo SVG correspondiente", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);

    const sheetToggle = container.querySelector('input[data-overlay-toggle="sheet"]') as HTMLInputElement;
    const sheetGroup = container.querySelector("#production-preview-overlay-sheet") as SVGElement;
    expect(sheetGroup.style.display).toBe("");

    sheetToggle.checked = false;
    sheetToggle.dispatchEvent(new Event("change"));
    expect(sheetGroup.style.display).toBe("none");

    sheetToggle.checked = true;
    sheetToggle.dispatchEvent(new Event("change"));
    expect(sheetGroup.style.display).toBe("");
  });

  it("zoom: el slider y el botón 100% actualizan la escala y el indicador de porcentaje", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);

    const range = container.querySelector(".production-preview-zoom-label input") as HTMLInputElement;
    const readout = container.querySelector(".production-preview-zoom-readout") as HTMLElement;
    const scaleTarget = container.querySelector(".production-preview-scale-target") as HTMLElement;

    range.value = "200";
    range.dispatchEvent(new Event("input"));
    expect(readout.textContent).toBe("200%");
    expect(scaleTarget.style.transform).toBe("scale(2)");

    const oneToOne = container.querySelector(".production-preview-zoom-100") as HTMLButtonElement;
    oneToOne.click();
    expect(readout.textContent).toBe("100%");
    expect(scaleTarget.style.transform).toBe("scale(1)");
  });

  it("zoom 'Ajustar' con clientWidth 0 (jsdom, sin layout real) no cambia el zoom ni revienta", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);

    const readout = container.querySelector(".production-preview-zoom-readout") as HTMLElement;
    const fitButton = container.querySelector(".production-preview-zoom-fit") as HTMLButtonElement;
    expect(() => fitButton.click()).not.toThrow();
    expect(readout.textContent).toBe("100%");
  });

  it("los botones de navegación por hoja disparan la misma navegación que la API", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);

    const nextButton = container.querySelector(".production-preview-next-sheet") as HTMLButtonElement;
    nextButton.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(preview.snapshot.sheetIndex).toBe(1);
  });

  it("destroy() remueve el panel del contenedor", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const preview = mount();
    await preview.render(project, printJob);
    expect(container.querySelector(".production-preview")).not.toBeNull();

    preview.destroy();
    expect(container.querySelector(".production-preview")).toBeNull();
    expect(() => preview.destroy()).not.toThrow(); // idempotente
  });
});
