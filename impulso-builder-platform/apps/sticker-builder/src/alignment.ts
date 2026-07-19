import { toPixels, type ObjectId } from "@impulso/document-schema";
import {
  findObjectInDocument,
  alignLeft,
  alignRight,
  alignCenterHorizontal,
  alignTop,
  alignBottom,
  alignCenterVertical,
  distributeHorizontal,
  distributeVertical,
  centerOnPageHorizontal,
  centerOnPageVertical,
  type Engine,
  type AlignmentTarget,
  type AlignmentPatch,
} from "@impulso/engine";
import { computeObjectBoundingBox, type RendererAdapter } from "@impulso/renderer-konva";

export type AlignmentOperation =
  | "align-left"
  | "align-center-h"
  | "align-right"
  | "align-top"
  | "align-center-v"
  | "align-bottom"
  | "distribute-h"
  | "distribute-v"
  | "center-page-h"
  | "center-page-v";

export interface AlignmentResult {
  ok: boolean;
  /** Explicación accesible del rechazo — nunca `undefined` cuando `ok` es
   * `false` (regla de esta fase: ningún estado de error nuevo depende
   * únicamente del color). */
  message?: string;
}

export interface AlignmentController {
  run(operation: AlignmentOperation): AlignmentResult;
  /** Cuántos objects top-level están seleccionados ahora mismo — la UI lo
   * usa para decidir qué sección/botones mostrar (ver `mountAlignmentPanel`). */
  selectedTopLevelCount(): number;
}

const OPERATION_LABELS: Record<AlignmentOperation, string> = {
  "align-left": "Alinear a la izquierda",
  "align-center-h": "Centrar horizontalmente",
  "align-right": "Alinear a la derecha",
  "align-top": "Alinear arriba",
  "align-center-v": "Centrar verticalmente",
  "align-bottom": "Alinear abajo",
  "distribute-h": "Distribuir horizontalmente",
  "distribute-v": "Distribuir verticalmente",
  "center-page-h": "Centrar en la página (horizontal)",
  "center-page-v": "Centrar en la página (vertical)",
};

/**
 * Orquesta Alignment/Distribution (Epic 7 / Fase 7.2): traduce la selección
 * actual en `AlignmentTarget[]` (midiendo la caja real de cada object vía
 * `computeObjectBoundingBox`, que a su vez usa Konva — ver README de
 * `@impulso/renderer-konva`), invoca la función pura correspondiente de
 * `@impulso/engine`, y aplica el resultado con `dispatchBatch` — una sola
 * entrada de historial por operación, sin importar cuántos objects mueva.
 *
 * Deliberadamente NO depende de Konva directamente: solo de
 * `computeObjectBoundingBox`, que ya encapsula esa dependencia.
 */
export function createAlignmentController(engine: Engine, renderer: RendererAdapter): AlignmentController {
  function selectedTopLevelIds(): ObjectId[] {
    const project = engine.getProject();
    const topLevel = new Set((project.document.pages[0]?.layers[0]?.objects ?? []).map((o) => o.id));
    return engine.getSelection().filter((id) => topLevel.has(id));
  }

  function buildTargets(ids: readonly ObjectId[]): AlignmentTarget[] | undefined {
    const stage = renderer.getStage();
    if (!stage) return undefined;
    const project = engine.getProject();
    const targets: AlignmentTarget[] = [];
    for (const id of ids) {
      const object = findObjectInDocument(project.document, id);
      const node = stage.findOne(`#${id}`);
      if (!object || !node) return undefined;
      targets.push({
        objectId: id,
        box: computeObjectBoundingBox(node, object),
        transform: { x: object.transform.x, y: object.transform.y },
      });
    }
    return targets;
  }

  function dispatch(patches: AlignmentPatch[], operation: AlignmentOperation): AlignmentResult {
    if (patches.length === 0) return { ok: true };
    const commands = patches.map((patch) => ({
      type: "updateObjectTransform" as const,
      objectId: patch.objectId,
      transform: patch.transform,
    }));
    const result = engine.dispatchBatch(commands, { label: OPERATION_LABELS[operation] });
    if (!result.ok) {
      return {
        ok: false,
        message: `No se pudo aplicar "${OPERATION_LABELS[operation]}": ${result.error.message}`,
      };
    }
    return { ok: true };
  }

  function run(operation: AlignmentOperation): AlignmentResult {
    const ids = selectedTopLevelIds();
    if (ids.length === 0) {
      return { ok: false, message: "No hay ningún object seleccionado." };
    }

    if (operation === "center-page-h" || operation === "center-page-v") {
      if (ids.length !== 1) {
        return { ok: false, message: "Centrar en la página aplica a un solo object seleccionado." };
      }
      const targets = buildTargets(ids);
      if (!targets) {
        return { ok: false, message: "No se pudo calcular la posición del object seleccionado." };
      }
      const page = engine.getProject().document.pages[0];
      if (!page) {
        return { ok: false, message: "El documento no tiene ninguna página." };
      }
      const patches =
        operation === "center-page-h"
          ? centerOnPageHorizontal(targets[0]!, toPixels(page.size.width, page.unit))
          : centerOnPageVertical(targets[0]!, toPixels(page.size.height, page.unit));
      return dispatch(patches, operation);
    }

    const targets = buildTargets(ids);
    if (!targets) {
      return { ok: false, message: "No se pudo calcular la posición de uno o más objects seleccionados." };
    }

    switch (operation) {
      case "align-left":
        return dispatch(alignLeft(targets), operation);
      case "align-center-h":
        return dispatch(alignCenterHorizontal(targets), operation);
      case "align-right":
        return dispatch(alignRight(targets), operation);
      case "align-top":
        return dispatch(alignTop(targets), operation);
      case "align-center-v":
        return dispatch(alignCenterVertical(targets), operation);
      case "align-bottom":
        return dispatch(alignBottom(targets), operation);
      case "distribute-h":
        return dispatch(distributeHorizontal(targets), operation);
      case "distribute-v":
        return dispatch(distributeVertical(targets), operation);
    }
  }

  return { run, selectedTopLevelCount: () => selectedTopLevelIds().length };
}

interface ButtonSpec {
  operation: AlignmentOperation;
  label: string;
  title: string;
  icon: string;
}

const ALIGN_BUTTONS: ButtonSpec[] = [
  {
    operation: "align-left",
    label: "Alinear a la izquierda",
    title: "Alinear a la izquierda",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="1.5" y1="1" x2="1.5" y2="15" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="2" width="10" height="4" fill="currentColor"/><rect x="4" y="10" width="6" height="4" fill="currentColor"/></svg>',
  },
  {
    operation: "align-center-h",
    label: "Centrar horizontalmente",
    title: "Centrar horizontalmente",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="2" width="10" height="4" fill="currentColor"/><rect x="5" y="10" width="6" height="4" fill="currentColor"/></svg>',
  },
  {
    operation: "align-right",
    label: "Alinear a la derecha",
    title: "Alinear a la derecha",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="14.5" y1="1" x2="14.5" y2="15" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="2" width="10" height="4" fill="currentColor"/><rect x="6" y="10" width="6" height="4" fill="currentColor"/></svg>',
  },
  {
    operation: "align-top",
    label: "Alinear arriba",
    title: "Alinear arriba",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="1" y1="1.5" x2="15" y2="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="4" width="4" height="10" fill="currentColor"/><rect x="10" y="4" width="4" height="6" fill="currentColor"/></svg>',
  },
  {
    operation: "align-center-v",
    label: "Centrar verticalmente",
    title: "Centrar verticalmente",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="3" width="4" height="10" fill="currentColor"/><rect x="10" y="5" width="4" height="6" fill="currentColor"/></svg>',
  },
  {
    operation: "align-bottom",
    label: "Alinear abajo",
    title: "Alinear abajo",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><line x1="1" y1="14.5" x2="15" y2="14.5" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="2" width="4" height="10" fill="currentColor"/><rect x="10" y="6" width="4" height="6" fill="currentColor"/></svg>',
  },
];

const DISTRIBUTE_BUTTONS: ButtonSpec[] = [
  {
    operation: "distribute-h",
    label: "Distribuir horizontalmente",
    title: "Distribuir horizontalmente (espaciado uniforme entre bordes)",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="3" height="6" fill="currentColor"/><rect x="6.5" y="5" width="3" height="6" fill="currentColor"/><rect x="12" y="5" width="3" height="6" fill="currentColor"/></svg>',
  },
  {
    operation: "distribute-v",
    label: "Distribuir verticalmente",
    title: "Distribuir verticalmente (espaciado uniforme entre bordes)",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="1" width="6" height="3" fill="currentColor"/><rect x="5" y="6.5" width="6" height="3" fill="currentColor"/><rect x="5" y="12" width="6" height="3" fill="currentColor"/></svg>',
  },
];

const CENTER_PAGE_BUTTONS: ButtonSpec[] = [
  {
    operation: "center-page-h",
    label: "Centrar horizontal en página",
    title: "Centrar horizontalmente en la página",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1"/><line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1"/><rect x="5" y="6" width="6" height="4" fill="currentColor"/></svg>',
  },
  {
    operation: "center-page-v",
    label: "Centrar vertical en página",
    title: "Centrar verticalmente en la página",
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1"/><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1"/><rect x="6" y="5" width="4" height="6" fill="currentColor"/></svg>',
  },
];

export interface AlignmentPanel {
  destroy(): void;
}

function buildButton(spec: ButtonSpec, controller: AlignmentController, errorId: string, onError: (message: string) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "alignment-button";
  button.innerHTML = spec.icon;
  button.title = spec.title;
  button.setAttribute("aria-label", spec.label);
  button.setAttribute("aria-describedby", errorId);
  button.addEventListener("click", () => {
    const result = controller.run(spec.operation);
    onError(result.ok ? "" : (result.message ?? "No se pudo completar la operación."));
  });
  return button;
}

/**
 * Sección contextual de Alineación, montada junto al Inspector (Epic 7 /
 * Fase 7.2): 0 seleccionados -> vacía (igual que el Inspector, ver
 * `inspector.ts`); 1 -> centrar en página; 2+ -> las 6 alineaciones; 3+ ->
 * suma distribuir horizontal/vertical. El conteo usa SIEMPRE objects
 * top-level (`selectedTopLevelCount`), no la selección cruda — mismo
 * criterio que ya usa `app.ts` para Agrupar/Duplicar.
 */
export function mountAlignmentPanel(container: HTMLElement, engine: Engine, controller: AlignmentController): AlignmentPanel {
  const errorId = "alignment-error-message";

  function setError(message: string): void {
    const errorEl = container.querySelector(`#${errorId}`);
    if (errorEl) errorEl.textContent = message;
  }

  function render(): void {
    container.innerHTML = "";
    const count = controller.selectedTopLevelCount();
    if (count === 0) return;

    const section = document.createElement("fieldset");
    section.className = "inspector-section alignment-section";
    const legend = document.createElement("legend");
    legend.textContent = "Alineación";
    section.appendChild(legend);

    const errorEl = document.createElement("p");
    errorEl.id = errorId;
    errorEl.className = "alignment-error";
    errorEl.setAttribute("role", "alert");
    section.appendChild(errorEl);

    const onError = (message: string) => setError(message);

    if (count === 1) {
      const row = document.createElement("div");
      row.className = "alignment-row";
      for (const spec of CENTER_PAGE_BUTTONS) row.appendChild(buildButton(spec, controller, errorId, onError));
      section.appendChild(row);
    } else {
      const alignRow = document.createElement("div");
      alignRow.className = "alignment-row";
      for (const spec of ALIGN_BUTTONS) alignRow.appendChild(buildButton(spec, controller, errorId, onError));
      section.appendChild(alignRow);

      if (count >= 3) {
        const distributeRow = document.createElement("div");
        distributeRow.className = "alignment-row";
        for (const spec of DISTRIBUTE_BUTTONS) distributeRow.appendChild(buildButton(spec, controller, errorId, onError));
        section.appendChild(distributeRow);
      }
    }

    container.appendChild(section);
  }

  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged" || event.type === "selectionChanged") render();
  });
  render();

  return { destroy: () => unsubscribe() };
}
