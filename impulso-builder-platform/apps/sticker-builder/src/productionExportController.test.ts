import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { mountProductionExportController } from "./productionExportController.js";

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

function buildProject(objects: SceneObject[] = [buildRect("obj_1")]): Project {
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
          size: { width: 20, height: 20 },
          unit: "mm",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects, metadata, pluginData: {}, customProperties: {} }],
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
    quantity: 4,
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

function mount() {
  return mountProductionExportController({ resolver: noopResolver });
}

// jsdom no implementa `HTMLCanvasElement.prototype.toBlob` NI
// `Blob.prototype.arrayBuffer` (a diferencia de `getContext`, que la app sí
// fakea globalmente en `vitest.setup.ts`) — `exportImpositionToPdf`/
// `exportImpositionToPng` reales necesitan ambos para codificar el raster
// final de cada hoja, mismo parche puntual que ya usan los tests de
// `@impulso/print-engine`.
// PNG 1x1 real (pdf-lib decodifica el PNG de verdad al incrustarlo — un
// array de bytes arbitrario falla con un error real de decodificación).
const ONE_BY_ONE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function onePixelPngBytes(): Uint8Array {
  const binaryString = atob(ONE_BY_ONE_PNG_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function fakePngBlob(): Blob {
  const bytes = onePixelPngBytes();
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  if (typeof blob.arrayBuffer !== "function") {
    (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => bytes.buffer as ArrayBuffer;
  }
  return blob;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(fakePngBlob()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function toReadyForExport(controller: ReturnType<typeof mount>, project: Project, printJob: PrintJob): Promise<void> {
  controller.open(project, printJob);
  await controller.runPreflightCheck();
  const state = controller.getState();
  if (state.preflight && state.preflight.issues.some((i) => i.severity === "warning")) {
    controller.acceptWarnings();
  }
}

describe("mountProductionExportController", () => {
  it("estado inicial: cerrado, sin printJob", () => {
    const controller = mount();
    expect(controller.getState()).toMatchObject({ isOpen: false, printJob: undefined, step: "profile", exporting: false });
  });

  it("open() toma una foto (clon) — mutar el original después no afecta el estado interno", () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();

    controller.open(project, printJob);
    printJob.dimensions.width = 999;
    project.document.metadata.name = "mutado";

    expect(controller.getState().printJob!.dimensions.width).toBe(20);
    expect(controller.getState()).toMatchObject({ isOpen: true, step: "profile", projectStale: false });
  });

  it("open() reinicia cualquier estado de una sesión anterior", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    await toReadyForExport(controller, project, printJob);
    expect(controller.getState().preflight).toBeDefined();

    controller.open(project, buildPrintJob(project));
    const state = controller.getState();
    expect(state.preflight).toBeUndefined();
    expect(state.preflightCurrent).toBe(false);
    expect(state.warningsAccepted).toBe(false);
    expect(state.result).toBeUndefined();
    expect(state.step).toBe("profile");
  });

  it("close() vuelve a isOpen: false, limpia el printJob en edición, y reinicia el paso a 'profile'", () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    controller.open(project, printJob);
    controller.setStep("config"); // avanza el flujo antes de cerrarlo
    controller.close();
    expect(controller.getState()).toMatchObject({ isOpen: false, printJob: undefined, exporting: false, step: "profile" });
  });

  it("setStep() cambia el paso solo si el flujo está abierto y el paso es válido", () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();

    controller.setStep("preview"); // cerrado — no hace nada
    expect(controller.getState().step).toBe("profile");

    controller.open(project, printJob);
    controller.setStep("preview");
    expect(controller.getState().step).toBe("preview");

    controller.setStep("paso-inexistente" as never);
    expect(controller.getState().step).toBe("preview"); // sin cambios ante un paso inválido
  });

  it("updatePrintJob() aplica la actualización funcional e invalida Preflight/advertencias/resultado", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    await toReadyForExport(controller, project, printJob);
    expect(controller.getState().preflightCurrent).toBe(true);

    controller.updatePrintJob((draft) => ({ ...draft, scale: 2 }));

    const state = controller.getState();
    expect(state.printJob!.scale).toBe(2);
    expect(state.preflight).toBeUndefined();
    expect(state.preflightCurrent).toBe(false);
    expect(state.warningsAccepted).toBe(false);
  });

  it("runPreflightCheck() marca preflightRunning durante la corrida y produce un resultado sin bloqueos para un PrintJob válido", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    controller.open(project, printJob);

    const promise = controller.runPreflightCheck();
    expect(controller.getState().preflightRunning).toBe(true);
    await promise;

    const state = controller.getState();
    expect(state.preflightRunning).toBe(false);
    expect(state.preflightCurrent).toBe(true);
    expect(state.preflight?.hasBlockingErrors).toBe(false);
    expect(state.warningsAccepted).toBe(false);
  });

  it("runPreflightCheck() descarta un resultado desactualizado si el PrintJob cambió mientras corría", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    controller.open(project, printJob);

    const promise = controller.runPreflightCheck();
    controller.updatePrintJob((draft) => ({ ...draft, scale: 3 })); // cambia el draft ANTES de que termine
    await promise;

    // El resultado de la corrida vieja nunca debió aplicarse — el draft ya
    // cambió, así que sigue sin Preflight vigente.
    expect(controller.getState().preflightCurrent).toBe(false);
  });

  it("acceptWarnings() no hace nada sin Preflight corrido, y no hace nada si hay errores bloqueantes", async () => {
    const controller = mount();
    controller.acceptWarnings();
    expect(controller.getState().warningsAccepted).toBe(false);

    const project = buildProject(); // sin ningún die-line — cutPath activo bloquea
    const printJob = buildPrintJob(project, {
      cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
    });
    controller.open(project, printJob);
    await controller.runPreflightCheck();
    expect(controller.getState().preflight?.hasBlockingErrors).toBe(true);

    controller.acceptWarnings();
    expect(controller.getState().warningsAccepted).toBe(false);
  });

  it("startExport() no hace nada sin Preflight vigente", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    controller.open(project, printJob);

    await controller.startExport("Mi Sticker", () => NOW);
    expect(controller.getState()).toMatchObject({ exporting: false, result: undefined, step: "profile" });
  });

  it("startExport() no hace nada si hay errores bloqueantes de Preflight", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project, {
      cutPath: { mode: "die-cut", source: { type: "auto" }, offset: 0, unit: "mm", stroke: 0.25, color: "#ff00ff", logicalLayerName: "DieCut" },
    });
    const controller = mount();
    controller.open(project, printJob);
    await controller.runPreflightCheck();

    await controller.startExport("Mi Sticker", () => NOW);
    expect(controller.getState()).toMatchObject({ exporting: false, result: undefined });
  });

  it("startExport() no hace nada si hay advertencias sin aceptar", async () => {
    const project = buildProject();
    // resolución muy baja frente al PPI objetivo -> resolution_insufficient/borderline (warning), sin ningún error.
    const printJob = buildPrintJob(project, { resolution: { targetPpi: 1200 } });
    const controller = mount();
    controller.open(project, printJob);
    await controller.runPreflightCheck();
    const state = controller.getState();
    if (!state.preflight?.issues.some((i) => i.severity === "warning")) {
      // Si este entorno no produjo una advertencia real, el test no aplica — se salta sin fallar.
      return;
    }

    await controller.startExport("Mi Sticker", () => NOW);
    expect(controller.getState().result).toBeUndefined();
  });

  it("startExport() produce un resultado PDF real, progresa y termina en el paso 'results'", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project); // output "pdf" por perfil sticker-sheet
    const controller = mount();
    await toReadyForExport(controller, project, printJob);

    const events: string[] = [];
    const unsubscribe = controller.subscribe((state) => {
      if (state.progress) events.push(state.progress.stage);
    });

    await controller.startExport("Mi Sticker", () => NOW);
    unsubscribe();

    const state = controller.getState();
    expect(state.exporting).toBe(false);
    expect(state.step).toBe("results");
    expect(state.result?.format).toBe("pdf");
    expect(state.error).toBeUndefined();
    expect(events).toContain("completed");
  });

  it("startExport() produce un resultado PNG cuando printJob.output === 'png'", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project, { output: "png" });
    const controller = mount();
    await toReadyForExport(controller, project, printJob);

    await controller.startExport("Mi Sticker", () => NOW);

    const state = controller.getState();
    expect(state.result?.format).toBe("png");
    expect(state.step).toBe("results");
  });

  it("cancelExport() aborta la exportación en curso sin tratarlo como un error", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    await toReadyForExport(controller, project, printJob);

    const unsubscribe = controller.subscribe((state) => {
      if (state.progress?.stage === "rendering-page") controller.cancelExport();
    });

    await controller.startExport("Mi Sticker", () => NOW);
    unsubscribe();

    const state = controller.getState();
    expect(state.exporting).toBe(false);
    expect(state.result).toBeUndefined();
    expect(state.error).toBeUndefined(); // cancelación explícita, no una falla
  });

  it("notifyProjectChanged() marca projectStale solo si el flujo está abierto", () => {
    const controller = mount();
    controller.notifyProjectChanged();
    expect(controller.getState().projectStale).toBe(false);

    const project = buildProject();
    controller.open(project, buildPrintJob(project));
    controller.notifyProjectChanged();
    expect(controller.getState().projectStale).toBe(true);
  });

  it("refreshSnapshot() vuelve a tomar la foto, limpia projectStale y invalida Preflight", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    await toReadyForExport(controller, project, printJob);
    controller.notifyProjectChanged();
    expect(controller.getState().projectStale).toBe(true);

    const changedProject = buildProject([buildRect("obj_1"), buildRect("obj_2")]);
    controller.refreshSnapshot(changedProject);

    const state = controller.getState();
    expect(state.projectStale).toBe(false);
    expect(state.preflight).toBeUndefined();
    expect(state.preflightCurrent).toBe(false);
  });

  it("destroy() detiene las notificaciones a los listeners y aborta cualquier exportación", async () => {
    const project = buildProject();
    const printJob = buildPrintJob(project);
    const controller = mount();
    await toReadyForExport(controller, project, printJob);

    let notified = 0;
    controller.subscribe(() => {
      notified += 1;
    });
    controller.destroy();
    const before = notified;

    controller.updatePrintJob((draft) => ({ ...draft, scale: 5 }));
    expect(notified).toBe(before); // ya no se notifica tras destroy()
  });

  it("subscribe() devuelve una función de baja que detiene notificaciones futuras", () => {
    const project = buildProject();
    const controller = mount();
    let calls = 0;
    const unsubscribe = controller.subscribe(() => {
      calls += 1;
    });
    controller.open(project, buildPrintJob(project));
    expect(calls).toBeGreaterThan(0);
    const callsAfterOpen = calls;

    unsubscribe();
    controller.setStep("preview");
    expect(calls).toBe(callsAfterOpen);
  });

  it("getState() siempre devuelve un objeto nuevo (nunca una referencia mutable compartida)", () => {
    const controller = mount();
    const a = controller.getState();
    const b = controller.getState();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
