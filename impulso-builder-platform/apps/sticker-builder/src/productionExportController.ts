/**
 * `ProductionExportController` (Epic 9 / Fase 9.4, secciones 10-11 y 33 del
 * enunciado) — dueño del estado/ciclo de vida del flujo de exportación de
 * producción de 7 pasos (perfil → configuración → preview → preflight →
 * advertencias → progreso → resultados). Mismo patrón que
 * `ProjectSaveCoordinator` (Epic 8, `packages/project-library`): función
 * factory que devuelve un objeto plano con `getState()`/`subscribe()`
 * explícitos — nunca una clase ES, nunca un `EventTarget`.
 *
 * Principio central (sección 34, "política de cambio de Project durante el
 * flujo"): al abrir (`open()`) se toma una FOTO del `Project` recibido
 * (`structuredClone`) — todo el resto del flujo (preview, Preflight,
 * exportación) opera ÚNICAMENTE sobre esa foto, nunca sobre una lectura en
 * vivo de `getProject()`. Si el `Project` real cambia mientras el diálogo
 * sigue abierto (`notifyProjectChanged()`, llamado por el caller desde el
 * mismo evento `projectChanged` del Engine que ya usa
 * `ProjectSaveCoordinator`), el controller se marca `projectStale: true` —
 * nunca mezcla geometría de dos revisiones distintas; el caller debe
 * ofrecer "actualizar" (`refreshSnapshot()`) antes de poder seguir
 * exportando con contenido post-cambio.
 *
 * El `PrintJob` en edición SÍ es mutable dentro del controller
 * (`updatePrintJob`) — cualquier cambio invalida el Preflight ya corrido
 * (sección 26: nunca mostrar un Preflight desactualizado) y resetea la
 * aceptación de advertencias (sección 29: "aceptación de advertencias por
 * EJECUCIÓN, nunca recordada entre corridas").
 */
import type { Project } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import {
  exportImpositionToPdf,
  exportImpositionToPng,
  runPreflight,
  PrintEngineError,
  type PrintJob,
  type PreflightResult,
  type PrintExportProgressEvent,
  type ExportImpositionToPdfResult,
  type ExportImpositionToPngResult,
  type FontChecker,
  type ImageDimensionsProbe,
} from "@impulso/print-engine";

export type ExportStep = "profile" | "config" | "preview" | "preflight" | "warnings" | "progress" | "results";

const STEP_ORDER: readonly ExportStep[] = ["profile", "config", "preview", "preflight", "warnings", "progress", "results"];

export type ExportResult = ExportImpositionToPdfResult | ExportImpositionToPngResult;

export interface ProductionExportState {
  isOpen: boolean;
  step: ExportStep;
  printJob: PrintJob | undefined;
  /** `true` si el `Project` real cambió (`notifyProjectChanged()`) desde
   * que se tomó la foto — el caller debe ofrecer `refreshSnapshot()`
   * antes de permitir seguir. */
  projectStale: boolean;
  preflight: PreflightResult | undefined;
  preflightRunning: boolean;
  /** `true` solo si `preflight` corresponde al `printJob` actual — se
   * invalida en cuanto `updatePrintJob`/`refreshSnapshot` cambian
   * cualquiera de los dos (sección 26). */
  preflightCurrent: boolean;
  /** Aceptación de advertencias — sección 29: por ejecución, nunca
   * recordada; se resetea cada vez que `preflight` se recalcula. */
  warningsAccepted: boolean;
  exporting: boolean;
  progress: PrintExportProgressEvent | undefined;
  result: ExportResult | undefined;
  error: string | undefined;
}

export interface MountProductionExportControllerOptions {
  resolver: ExportAssetResolver;
  fontChecker?: FontChecker;
  imageProbe?: ImageDimensionsProbe;
  memoryBudgetBytes?: number;
}

export interface ProductionExportController {
  getState(): ProductionExportState;
  subscribe(listener: (state: ProductionExportState) => void): () => void;
  /** Abre el flujo — toma la foto del `Project`/`PrintJob` de partida.
   * Reinicia todo el estado anterior (nunca reutiliza resultados de una
   * sesión de exportación previa). */
  open(project: Project, initialPrintJob: PrintJob): void;
  /** Cierra el flujo — cancela cualquier exportación en curso. El
   * controller queda reutilizable (`open()` de nuevo lo reinicia). */
  close(): void;
  setStep(step: ExportStep): void;
  /** Actualización funcional del `PrintJob` en edición — invalida
   * Preflight/aceptación de advertencias. */
  updatePrintJob(update: (draft: PrintJob) => PrintJob): void;
  runPreflightCheck(): Promise<void>;
  acceptWarnings(): void;
  /** Ejecuta la exportación real (`exportImpositionToPdf`/`Png` según
   * `printJob.output`) — bloquea si hay errores de Preflight o
   * advertencias sin aceptar (sección 29: "nunca disponible si hay un
   * error real"). */
  startExport(projectName: string, now: () => string): Promise<void>;
  cancelExport(): void;
  /** El caller lo invoca cuando el `Project` real cambia (mismo punto de
   * enganche que `ProjectSaveCoordinator.notifyChange()`, el evento
   * `projectChanged` del Engine) — nunca re-lee el Project por su cuenta. */
  notifyProjectChanged(): void;
  /** Vuelve a tomar la foto del `Project` — el caller debe pasar el
   * `Project` actual explícitamente (el controller nunca guarda una
   * referencia "viva" a `getProject`, sección 34). Invalida Preflight. */
  refreshSnapshot(project: Project): void;
  destroy(): void;
}

function isImposed(printJob: PrintJob): boolean {
  return printJob.imposition.mode === "grid";
}

export function mountProductionExportController(options: MountProductionExportControllerOptions): ProductionExportController {
  const { resolver, fontChecker, imageProbe, memoryBudgetBytes } = options;

  let projectSnapshot: Project | undefined;
  let printJob: PrintJob | undefined;
  let step: ExportStep = "profile";
  let projectStale = false;
  let preflight: PreflightResult | undefined;
  let preflightRunning = false;
  let preflightCurrent = false;
  let warningsAccepted = false;
  let exporting = false;
  let progress: PrintExportProgressEvent | undefined;
  let result: ExportResult | undefined;
  let error: string | undefined;
  let abortController: AbortController | undefined;
  let destroyed = false;

  const listeners = new Set<(state: ProductionExportState) => void>();

  function snapshotState(): ProductionExportState {
    return { isOpen: projectSnapshot !== undefined, step, printJob, projectStale, preflight, preflightRunning, preflightCurrent, warningsAccepted, exporting, progress, result, error };
  }

  function emit(): void {
    if (destroyed) return;
    const state = snapshotState();
    for (const listener of listeners) listener(state);
  }

  function resetForNewJob(): void {
    preflight = undefined;
    preflightCurrent = false;
    warningsAccepted = false;
    result = undefined;
    error = undefined;
  }

  const api: ProductionExportController = {
    getState(): ProductionExportState {
      return snapshotState();
    },

    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    open(project, initialPrintJob): void {
      projectSnapshot = structuredClone(project);
      printJob = structuredClone(initialPrintJob);
      step = "profile";
      projectStale = false;
      preflight = undefined;
      preflightRunning = false;
      preflightCurrent = false;
      warningsAccepted = false;
      exporting = false;
      progress = undefined;
      result = undefined;
      error = undefined;
      emit();
    },

    close(): void {
      abortController?.abort();
      abortController = undefined;
      projectSnapshot = undefined;
      printJob = undefined;
      exporting = false;
      // Reinicia el paso — sin esto, una reapertura posterior (`open()`)
      // mostraría el paso donde se cerró la sesión anterior hasta que el
      // usuario avance de nuevo desde "profile" (bug real, detectado en
      // Chromium: cerrar desde "config" y reabrir mostraba "config" con
      // un `printJob` ya vacío).
      step = "profile";
      emit();
    },

    setStep(nextStep): void {
      if (!projectSnapshot) return;
      if (!STEP_ORDER.includes(nextStep)) return;
      step = nextStep;
      emit();
    },

    updatePrintJob(update): void {
      if (!printJob) return;
      printJob = update(structuredClone(printJob));
      resetForNewJob();
      emit();
    },

    async runPreflightCheck(): Promise<void> {
      if (!projectSnapshot || !printJob) return;
      const jobAtCallTime = printJob;
      preflightRunning = true;
      emit();
      try {
        const preflightResult = await runPreflight(projectSnapshot, jobAtCallTime, { resolver, fontChecker, imageProbe, memoryBudgetBytes });
        // El `Project`/`PrintJob` pueden haber cambiado mientras el
        // Preflight estaba en vuelo (updatePrintJob/refreshSnapshot) — un
        // resultado desactualizado nunca se aplica (sección 26).
        if (printJob !== jobAtCallTime) return;
        preflight = preflightResult;
        preflightCurrent = true;
        warningsAccepted = false;
      } finally {
        preflightRunning = false;
        emit();
      }
    },

    acceptWarnings(): void {
      if (!preflight || preflight.hasBlockingErrors) return;
      warningsAccepted = true;
      emit();
    },

    async startExport(projectName, now): Promise<void> {
      if (!projectSnapshot || !printJob) return;
      if (!preflightCurrent || !preflight) return;
      if (preflight.hasBlockingErrors) return;
      const hasWarnings = preflight.issues.some((issue) => issue.severity === "warning");
      if (hasWarnings && !warningsAccepted) return;
      if (!isImposed(printJob)) return;

      exporting = true;
      progress = undefined;
      result = undefined;
      error = undefined;
      step = "progress";
      abortController = new AbortController();
      emit();

      try {
        const shared = {
          project: projectSnapshot,
          printJob,
          resolver,
          projectName,
          fontChecker,
          imageProbe,
          signal: abortController.signal,
          onProgress: (event: PrintExportProgressEvent) => {
            progress = event;
            emit();
          },
          memoryBudgetBytes,
          now,
        };
        result = printJob.output === "pdf" ? await exportImpositionToPdf(shared) : await exportImpositionToPng(shared);
        step = "results";
      } catch (thrown) {
        if (thrown instanceof PrintEngineError && thrown.code === "aborted") {
          error = undefined; // cancelación explícita, no un error a mostrar como falla
        } else if (thrown instanceof PrintEngineError) {
          error = thrown.message;
        } else {
          error = thrown instanceof Error ? thrown.message : String(thrown);
        }
      } finally {
        exporting = false;
        abortController = undefined;
        emit();
      }
    },

    cancelExport(): void {
      abortController?.abort();
    },

    notifyProjectChanged(): void {
      if (!projectSnapshot) return;
      projectStale = true;
      emit();
    },

    refreshSnapshot(project): void {
      if (!projectSnapshot) return;
      projectSnapshot = structuredClone(project);
      projectStale = false;
      preflight = undefined;
      preflightCurrent = false;
      warningsAccepted = false;
      emit();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      abortController?.abort();
      listeners.clear();
    },
  };

  return api;
}
