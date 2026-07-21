/**
 * "Exportar para impresión" (Epic 9 / Fase 9.4, secciones 23-35 del
 * enunciado) — flujo de 7 pasos (perfil → configuración → preview →
 * preflight → advertencias → progreso → resultados) para exportar una
 * imposición real, ENTRADA DE EDITOR DISTINTA del "Exportar" rápido
 * existente (`exportDialog.ts`, PNG/SVG vía `@impulso/export-engine`) —
 * nunca el mismo diálogo, sección 23.
 *
 * Todo el estado/ciclo de vida vive en `ProductionExportController`
 * (`productionExportController.ts`) — este módulo es SOLO la UI: nunca
 * calcula geometría, nunca decide si Preflight bloquea, nunca decide si
 * un cambio de Project invalida el snapshot. El preview (paso 3) reutiliza
 * `ProductionPreview` (`productionPreview.ts`) tal cual.
 *
 * Foco atrapado + restaurado al cerrar (mismo criterio que
 * `unsavedChangesDialog.ts` — el único otro diálogo de la app que lo
 * implementa), operable enteramente por teclado, título por paso
 * (`aria-labelledby` apunta al `<h2>` visible de cada paso), región
 * `aria-live="polite"` para el progreso (nunca "assertive" — sección 36:
 * "aria-live moderado").
 */
import type { Project } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { triggerBrowserDownload } from "@impulso/export-engine";
import { PRINT_PROFILES, createPrintJob, type FontChecker, type ImageDimensionsProbe, type PreflightIssue, type PrintJob } from "@impulso/print-engine";
import { mountProductionExportController, type ExportStep, type ProductionExportState } from "./productionExportController.js";
import { mountProductionPreview, type ProductionPreview } from "./productionPreview.js";

export interface MountProductionExportDialogOptions {
  resolver: ExportAssetResolver;
  fontChecker?: FontChecker;
  imageProbe?: ImageDimensionsProbe;
  now?: () => string;
}

export interface ProductionExportDialog {
  open(project: Project, defaultProjectName: string): void;
  destroy(): void;
}

const STEP_TITLES: Record<ExportStep, string> = {
  profile: "Perfil de impresión",
  config: "Configuración de la imposición",
  preview: "Vista previa de producción",
  preflight: "Revisión (Preflight)",
  warnings: "Advertencias",
  progress: "Exportando",
  results: "Resultado",
};

const STEP_ORDER: readonly ExportStep[] = ["profile", "config", "preview", "preflight", "warnings", "progress", "results"];

/**
 * Perfiles reales expuestos en este wizard (Fase 9.5 — corrige la
 * discrepancia detectada: los 4 perfiles de `PRINT_PROFILES` existían y
 * funcionaban en el motor, pero solo `"sticker-sheet"` estaba conectado
 * aquí, hardcodeado). `"web-preview"` se deja deliberadamente FUERA de
 * este wizard — ver ADR-0025 (enmienda de Fase 9.5): su propósito
 * (resolución baja para pantalla, sin bleed/marcas/cut path/imposición)
 * ya está cubierto por el diálogo de "Exportar" rápido existente
 * (`exportDialog.ts`), que además ofrece más control útil para ese caso
 * (fondo transparente/sólido, escala 1x-4x) sin pasarlo por Preflight ni
 * por los pasos de imposición, que no le aplican. Duplicarlo aquí no
 * aportaría nada que el usuario no tenga ya, y confundiría el propósito
 * de este flujo (producción real, no vista rápida). */
const WIZARD_PROFILE_IDS = ["digital-png", "print-pdf", "sticker-sheet"] as const;

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function mountProductionExportDialog(container: HTMLElement, options: MountProductionExportDialogOptions): ProductionExportDialog {
  const { resolver, fontChecker, imageProbe, now = () => new Date().toISOString() } = options;
  const controller = mountProductionExportController({ resolver, fontChecker, imageProbe });

  const titleId = "production-export-dialog-title";
  const overlay = document.createElement("div");
  overlay.className = "production-export-dialog-overlay";
  overlay.style.display = "none";

  const dialog = document.createElement("div");
  dialog.className = "production-export-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  overlay.appendChild(dialog);

  const stepIndicator = document.createElement("p");
  stepIndicator.className = "production-export-step-indicator";
  dialog.appendChild(stepIndicator);

  const title = document.createElement("h2");
  title.id = titleId;
  // Programáticamente enfocable (sin entrar al orden de tabulación normal,
  // sección 36: "título por paso") — al cambiar de paso, el foco se mueve
  // aquí para que un lector de pantalla anuncie el nuevo paso de
  // inmediato, en vez de quedarse silenciosamente en el botón "Siguiente".
  title.tabIndex = -1;
  dialog.appendChild(title);

  const body = document.createElement("div");
  body.className = "production-export-body";
  dialog.appendChild(body);

  const liveRegion = document.createElement("div");
  liveRegion.className = "production-export-live-region";
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("role", "status");
  dialog.appendChild(liveRegion);

  const actions = document.createElement("div");
  actions.className = "production-export-actions";
  dialog.appendChild(actions);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "production-export-cancel";
  cancelButton.textContent = "Cancelar";
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "production-export-back";
  backButton.textContent = "◀ Atrás";
  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "production-export-next";
  nextButton.textContent = "Siguiente ▶";
  actions.append(cancelButton, backButton, nextButton);

  container.appendChild(overlay);

  let currentProject: Project | undefined;
  let defaultProjectName = "";
  let preview: ProductionPreview | undefined;
  let previouslyFocused: HTMLElement | null = null;
  let pendingProfileId: keyof typeof PRINT_PROFILES = "sticker-sheet";

  function close(): void {
    overlay.style.display = "none";
    dialog.removeEventListener("keydown", handleKeydown);
    controller.close();
    preview?.destroy();
    preview = undefined;
    previouslyFocused?.focus();
    previouslyFocused = null;
  }

  function handleKeydown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      evt.preventDefault();
      close();
      return;
    }
    if (evt.key !== "Tab") return;
    const elements = focusableElements(dialog);
    if (elements.length === 0) return;
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    if (evt.shiftKey && document.activeElement === first) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault();
      first.focus();
    }
  }

  function renderIssues(list: HTMLElement, issues: PreflightIssue[], severity: PreflightIssue["severity"]): void {
    const filtered = issues.filter((issue) => issue.severity === severity);
    if (filtered.length === 0) return;
    const heading = document.createElement("h3");
    heading.textContent = severity === "error" ? "Errores (bloquean la exportación)" : severity === "warning" ? "Advertencias" : "Información";
    list.appendChild(heading);
    const ul = document.createElement("ul");
    ul.className = `production-export-issues production-export-issues-${severity}`;
    for (const issue of filtered) {
      const li = document.createElement("li");
      li.textContent = issue.recommendation ? `${issue.message} ${issue.recommendation}` : issue.message;
      ul.appendChild(li);
    }
    list.appendChild(ul);
  }

  let lastRenderedStep: ExportStep | undefined;

  function renderStep(state: ProductionExportState): void {
    const stepChanged = state.step !== lastRenderedStep;
    lastRenderedStep = state.step;
    title.textContent = STEP_TITLES[state.step];
    if (stepChanged) title.focus();
    stepIndicator.textContent = `Paso ${STEP_ORDER.indexOf(state.step) + 1} de ${STEP_ORDER.length}`;
    body.replaceChildren();
    backButton.disabled = state.step === "profile" || state.step === "progress";
    cancelButton.style.display = state.step === "results" ? "none" : "";
    nextButton.textContent = "Siguiente ▶";
    nextButton.disabled = false;
    nextButton.style.display = "";

    if (state.projectStale) {
      const banner = document.createElement("p");
      banner.className = "production-export-stale-banner";
      banner.textContent = "El proyecto cambió desde que se abrió este flujo. ";
      const refreshButton = document.createElement("button");
      refreshButton.type = "button";
      refreshButton.textContent = "Actualizar con los cambios";
      refreshButton.addEventListener("click", () => {
        if (currentProject) controller.refreshSnapshot(currentProject);
      });
      banner.appendChild(refreshButton);
      body.appendChild(banner);
    }

    switch (state.step) {
      case "profile": {
        const list = document.createElement("div");
        list.className = "production-export-profile-list";
        list.setAttribute("role", "radiogroup");
        list.setAttribute("aria-label", "Perfil de impresión");
        for (const profileId of WIZARD_PROFILE_IDS) {
          const profile = PRINT_PROFILES[profileId];
          const card = document.createElement("label");
          card.className = "production-export-profile-card";
          card.classList.toggle("production-export-profile-card-selected", profileId === pendingProfileId);
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = "production-export-profile";
          radio.value = profileId;
          radio.checked = profileId === pendingProfileId;
          radio.addEventListener("change", () => {
            pendingProfileId = profileId;
            renderStep(controller.getState());
          });
          const cardTitle = document.createElement("h3");
          cardTitle.textContent = profile.name;
          const cardDescription = document.createElement("p");
          cardDescription.textContent = profile.description;
          card.append(radio, cardTitle, cardDescription);
          list.appendChild(card);
        }
        body.appendChild(list);
        nextButton.textContent = "Comenzar ▶";
        break;
      }
      case "config": {
        if (!state.printJob) break;
        if (state.printJob.imposition.mode === "grid") {
          body.appendChild(buildConfigForm(state.printJob, state.printJob.imposition));
        } else {
          body.appendChild(buildSimpleConfigForm(state.printJob));
        }
        break;
      }
      case "preview": {
        const previewContainer = document.createElement("div");
        body.appendChild(previewContainer);
        preview?.destroy();
        preview = mountProductionPreview(previewContainer, { resolver });
        if (currentProject && state.printJob) void preview.render(currentProject, state.printJob);
        break;
      }
      case "preflight": {
        if (state.preflightRunning) {
          const loading = document.createElement("p");
          loading.textContent = "Corriendo Preflight…";
          body.appendChild(loading);
          nextButton.disabled = true;
        } else if (!state.preflight) {
          const runButton = document.createElement("button");
          runButton.type = "button";
          runButton.textContent = "Correr Preflight";
          runButton.addEventListener("click", () => void controller.runPreflightCheck());
          body.appendChild(runButton);
          nextButton.disabled = true;
        } else {
          renderIssues(body, state.preflight.issues, "error");
          renderIssues(body, state.preflight.issues, "warning");
          renderIssues(body, state.preflight.issues, "info");
          if (state.preflight.issues.length === 0) {
            const ok = document.createElement("p");
            ok.textContent = "Sin observaciones.";
            body.appendChild(ok);
          }
          nextButton.disabled = state.preflight.hasBlockingErrors;
          if (state.preflight.hasBlockingErrors) {
            nextButton.textContent = "Corrige los errores para continuar";
          }
        }
        break;
      }
      case "warnings": {
        const hasWarnings = state.preflight?.issues.some((i) => i.severity === "warning") ?? false;
        if (!hasWarnings) {
          // Nada que aceptar — se avanza automáticamente (sección 29: solo
          // se pregunta cuando realmente hay algo que aceptar).
          controller.setStep("progress");
          return;
        }
        const label = document.createElement("label");
        label.className = "production-export-accept-warnings";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.warningsAccepted;
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) controller.acceptWarnings();
          else checkbox.checked = state.warningsAccepted; // no hay "des-aceptar" parcial — se recalcula en el próximo render
        });
        label.append(checkbox, document.createTextNode("Entiendo las advertencias y quiero exportar de todos modos"));
        body.appendChild(label);
        nextButton.textContent = "Exportar ▶";
        nextButton.disabled = !state.warningsAccepted;
        break;
      }
      case "progress": {
        backButton.style.display = "none";
        nextButton.style.display = "none";
        const stageLabel = document.createElement("p");
        stageLabel.textContent = state.progress ? `Etapa: ${state.progress.stage}` : "Preparando…";
        body.appendChild(stageLabel);
        liveRegion.textContent = stageLabel.textContent;
        if (state.error) {
          const errorMessage = document.createElement("p");
          errorMessage.className = "production-export-error";
          errorMessage.textContent = state.error;
          body.appendChild(errorMessage);
          const retryButton = document.createElement("button");
          retryButton.type = "button";
          retryButton.textContent = "Reintentar";
          retryButton.addEventListener("click", () => {
            if (currentProject) void controller.startExport(defaultProjectName, now);
          });
          body.appendChild(retryButton);
          backButton.style.display = "";
        }
        break;
      }
      case "results": {
        backButton.style.display = "none";
        nextButton.textContent = "Cerrar";
        const result = state.result;
        if (result) {
          if (result.format === "pdf") {
            const downloadButton = document.createElement("button");
            downloadButton.type = "button";
            downloadButton.textContent = `Descargar ${result.filename} (${formatBytes(result.blob.size)})`;
            downloadButton.addEventListener("click", () => triggerBrowserDownload(result.blob, result.filename));
            body.appendChild(downloadButton);
            const summary = document.createElement("p");
            summary.textContent = `${result.sheetCount} hoja(s), ${result.pieceCount} pieza(s) en total.`;
            body.appendChild(summary);
          } else {
            const list = document.createElement("ul");
            list.className = "production-export-results-list";
            for (const sheet of result.sheets) {
              const li = document.createElement("li");
              const downloadButton = document.createElement("button");
              downloadButton.type = "button";
              downloadButton.textContent = `Descargar ${sheet.filename} (${formatBytes(sheet.blob.size)})`;
              downloadButton.addEventListener("click", () => triggerBrowserDownload(sheet.blob, sheet.filename));
              li.appendChild(downloadButton);
              list.appendChild(li);
            }
            body.appendChild(list);
          }
        }
        break;
      }
    }
  }

  /**
   * Paso de configuración para un perfil SIN imposición (`digital-png`/
   * `print-pdf`, sección 16 del enunciado de Fase 9.5) — sin grid/hoja
   * que configurar, pero igual debe mostrar formato/resolución/bleed
   * reales del `PrintJob`, no una pantalla en blanco (el gap detectado en
   * Fase 9.5: antes de este fix, un perfil sin imposición renderizaba un
   * paso de configuración completamente vacío).
   */
  function buildSimpleConfigForm(printJob: PrintJob): HTMLElement {
    const form = document.createElement("div");

    const summary = document.createElement("dl");
    summary.className = "production-export-simple-summary";
    function summaryRow(term: string, value: string): void {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = value;
      summary.append(dt, dd);
    }
    summaryRow("Formato", printJob.output.toUpperCase());
    summaryRow("Resolución", `${printJob.resolution.targetPpi} PPI`);
    summaryRow(
      "Sangrado",
      printJob.bleed.top === 0 && printJob.bleed.right === 0 && printJob.bleed.bottom === 0 && printJob.bleed.left === 0
        ? "Sin sangrado"
        : `${printJob.bleed.top}${printJob.bleed.unit} por lado`,
    );
    form.appendChild(summary);

    const outputLabel = document.createElement("label");
    outputLabel.textContent = "Formato de salida";
    const outputSelect = document.createElement("select");
    for (const value of ["pdf", "png"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.toUpperCase();
      option.selected = printJob.output === value;
      outputSelect.appendChild(option);
    }
    outputSelect.addEventListener("change", () => {
      const value = outputSelect.value as "pdf" | "png";
      controller.updatePrintJob((draft) => ({ ...draft, output: value }));
    });
    outputLabel.appendChild(outputSelect);
    form.appendChild(outputLabel);

    return form;
  }

  function buildConfigForm(printJob: PrintJob, imposition: Extract<PrintJob["imposition"], { mode: "grid" }>): HTMLElement {
    const form = document.createElement("div");

    const essential = document.createElement("fieldset");
    const essentialLegend = document.createElement("legend");
    essentialLegend.textContent = "Esencial";
    essential.appendChild(essentialLegend);

    function numberField(labelText: string, value: number, onChange: (value: number) => void): HTMLLabelElement {
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "number";
      input.value = String(value);
      input.addEventListener("change", () => {
        const parsed = Number(input.value);
        if (Number.isFinite(parsed)) onChange(parsed);
      });
      label.appendChild(input);
      return label;
    }

    essential.appendChild(
      numberField("Cantidad de copias", imposition.quantity, (value) =>
        controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, quantity: value } } : draft)),
      ),
    );
    essential.appendChild(
      numberField("Ancho de hoja", imposition.sheet.width, (value) =>
        controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, sheet: { ...draft.imposition.sheet, width: value } } } : draft)),
      ),
    );
    essential.appendChild(
      numberField("Alto de hoja", imposition.sheet.height, (value) =>
        controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, sheet: { ...draft.imposition.sheet, height: value } } } : draft)),
      ),
    );

    const orientationLabel = document.createElement("label");
    orientationLabel.textContent = "Orientación";
    const orientationSelect = document.createElement("select");
    for (const value of ["portrait", "landscape"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "portrait" ? "Vertical" : "Horizontal";
      option.selected = imposition.orientation === value;
      orientationSelect.appendChild(option);
    }
    orientationSelect.addEventListener("change", () => {
      const value = orientationSelect.value as "portrait" | "landscape";
      controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, orientation: value } } : draft));
    });
    orientationLabel.appendChild(orientationSelect);
    essential.appendChild(orientationLabel);

    form.appendChild(essential);

    const advanced = document.createElement("fieldset");
    const advancedLegend = document.createElement("legend");
    advancedLegend.textContent = "Avanzado";
    advanced.appendChild(advancedLegend);

    advanced.appendChild(numberField("Separación horizontal (gap X)", imposition.gapX, (value) => controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, gapX: value } } : draft))));
    advanced.appendChild(numberField("Separación vertical (gap Y)", imposition.gapY, (value) => controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, gapY: value } } : draft))));

    const alignmentLabel = document.createElement("label");
    alignmentLabel.textContent = "Alineación del grid";
    const alignmentSelect = document.createElement("select");
    const alignments = ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"] as const;
    for (const value of alignments) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = imposition.alignment === value;
      alignmentSelect.appendChild(option);
    }
    alignmentSelect.addEventListener("change", () => {
      const value = alignmentSelect.value as (typeof alignments)[number];
      controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, alignment: value } } : draft));
    });
    alignmentLabel.appendChild(alignmentSelect);
    advanced.appendChild(alignmentLabel);

    const marksLabel = document.createElement("label");
    marksLabel.textContent = "Marcas de corte";
    const marksSelect = document.createElement("select");
    const marksModes = ["none", "per-piece", "per-sheet"] as const;
    for (const value of marksModes) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "none" ? "Ninguna" : value === "per-piece" ? "Por pieza" : "Por hoja";
      option.selected = imposition.marksMode === value;
      marksSelect.appendChild(option);
    }
    marksSelect.addEventListener("change", () => {
      const value = marksSelect.value as (typeof marksModes)[number];
      controller.updatePrintJob((draft) => (draft.imposition.mode === "grid" ? { ...draft, imposition: { ...draft.imposition, marksMode: value } } : draft));
    });
    marksLabel.appendChild(marksSelect);
    advanced.appendChild(marksLabel);

    const outputLabel = document.createElement("label");
    outputLabel.textContent = "Formato de salida";
    const outputSelect = document.createElement("select");
    for (const value of ["pdf", "png"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.toUpperCase();
      option.selected = printJob.output === value;
      outputSelect.appendChild(option);
    }
    outputSelect.addEventListener("change", () => {
      const value = outputSelect.value as "pdf" | "png";
      controller.updatePrintJob((draft) => ({ ...draft, output: value }));
    });
    outputLabel.appendChild(outputSelect);
    advanced.appendChild(outputLabel);

    form.appendChild(advanced);
    return form;
  }

  cancelButton.addEventListener("click", () => close());
  backButton.addEventListener("click", () => {
    const state = controller.getState();
    const index = STEP_ORDER.indexOf(state.step);
    if (index > 0) controller.setStep(STEP_ORDER[index - 1]!);
  });
  nextButton.addEventListener("click", () => {
    const state = controller.getState();
    if (state.step === "results") {
      close();
      return;
    }
    if (state.step === "profile") {
      if (!currentProject) return;
      const page = currentProject.document.pages[0];
      if (!page) return;
      const printJob = createPrintJob({
        documentId: currentProject.document.id,
        pageIds: currentProject.document.pages.map((p) => p.id),
        dimensions: { width: page.size.width, height: page.size.height, unit: page.unit },
        profile: pendingProfileId,
        now,
      });
      controller.open(currentProject, printJob);
      controller.setStep("config");
      return;
    }
    if (state.step === "warnings") {
      void controller.startExport(defaultProjectName, now).then(() => {
        // El controller ya avanza a "progress" internamente al iniciar y a
        // "results" al terminar con éxito — nada más que hacer aquí.
      });
      return;
    }
    const index = STEP_ORDER.indexOf(state.step);
    if (index < STEP_ORDER.length - 1) controller.setStep(STEP_ORDER[index + 1]!);
  });

  controller.subscribe(renderStep);

  return {
    open(project, projectName): void {
      currentProject = project;
      defaultProjectName = projectName;
      pendingProfileId = "sticker-sheet";
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      overlay.style.display = "flex";
      dialog.addEventListener("keydown", handleKeydown);
      renderStep(controller.getState());
      nextButton.focus();
    },
    destroy(): void {
      close();
      preview?.destroy();
      controller.destroy();
      overlay.remove();
    },
  };
}
