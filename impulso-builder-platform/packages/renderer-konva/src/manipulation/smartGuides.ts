import Konva from "konva";
import type { ObjectId, Page } from "@impulso/document-schema";
import {
  computeSnap,
  buildPageSnapCandidates,
  buildObjectSnapCandidates,
  type BoundingBox,
  type SnapCandidate,
  type SnapResult,
  type AxisSnap,
  type RefPoint,
} from "@impulso/engine";
import { computeObjectBoundingBox } from "./boundingBox.js";
import { toPixels } from "../unit.js";

/**
 * Smart Guides + Snapping (Epic 7 / Fase 7.3 — Assisted Placement): el
 * puente entre la matemática pura de `@impulso/engine` (`computeSnap`) y
 * Konva. Este módulo mide (vía `computeObjectBoundingBox`, que a su vez usa
 * Konva) y dibuja (`guidesLayer`) — nunca decide prioridad ni desempate,
 * eso vive enteramente en `computeSnap`.
 *
 * Tolerancia: 8px de PANTALLA, normalizados a espacio canónico dividiendo
 * por el zoom actual (`getZoom()`, CSS puro — ver `apps/sticker-builder/zoom.ts`)
 * — así la sensación de "qué tan cerca hay que estar para que snapee" es
 * constante sin importar el nivel de zoom (ver Fase 7.3, sección 4).
 */
const SNAP_TOLERANCE_SCREEN_PX = 8;

/** Nombre de la custom property CSS que define el color de las Smart
 * Guides — el token vive en `apps/sticker-builder/index.html` (`:root`);
 * este paquete no asume que exista (ej. en tests con jsdom, o un consumidor
 * externo que no la define) y cae a `GUIDE_COLOR_FALLBACK` si está vacía. */
const GUIDE_COLOR_VAR = "--impulso-snap-guide-color";
const GUIDE_COLOR_FALLBACK = "#ff2d78";
/** Halo blanco semitransparente detrás de cada guía — asegura contraste
 * legible tanto sobre el fondo blanco de la página como sobre objects de
 * color oscuro (ver Fase 7.3, sección 3, "contraste suficiente"). */
const GUIDE_HALO_COLOR = "rgba(255, 255, 255, 0.85)";
/** Cuánto se extiende cada guía más allá de la caja(s) involucrada(s), en
 * espacio canónico (px) — puramente estético, para que la línea no termine
 * exactamente en el borde de la caja. */
const GUIDE_EXTENSION = 16;

export interface SnapEnvironment {
  stage: Konva.Stage;
  mainLayer: Konva.Layer;
  guidesLayer: Konva.Layer;
  /** Zoom actual (1 = 100%) — puramente CSS, nunca toca el Stage de Konva
   * (ver `apps/sticker-builder/zoom.ts`). Se lee en cada frame de gesto
   * porque el usuario puede hacer zoom con Ctrl/Cmd+rueda mientras arrastra. */
  getZoom: () => number;
}

export interface SnapGesture {
  candidates: SnapCandidate[];
  /** Cajas de los objects candidatos, snapshoteadas al iniciar el gesto —
   * se reutilizan para dibujar la extensión visual de la guía (Fase 7.3,
   * sección 3) sin volver a medir vía Konva en cada frame. */
  objectBoxes: Map<ObjectId, BoundingBox>;
  pageBox: BoundingBox;
  grid: { size: number; snapEnabled: boolean };
  previousSnap?: SnapResult;
}

export interface EligibleRefPoints {
  x?: readonly RefPoint[];
  y?: readonly RefPoint[];
}

/**
 * Snapshot de candidatos al iniciar drag/resize (Fase 7.3, sección 12 —
 * Performance): mide una sola vez la caja de cada object top-level visible
 * de la página activa (excluyendo el/los que se están manipulando), y arma
 * los candidatos de Página + Objects. El candidato de Grid no se enumera
 * (se calcula analíticamente dentro de `computeSnap`).
 */
export function beginSnapGesture(env: SnapEnvironment, page: Page, excludeIds: readonly ObjectId[]): SnapGesture {
  const excludeSet = new Set(excludeIds);
  const pageWidthPx = toPixels(page.size.width, page.unit);
  const pageHeightPx = toPixels(page.size.height, page.unit);

  const candidates: SnapCandidate[] = [...buildPageSnapCandidates(pageWidthPx, pageHeightPx)];
  const objectBoxes = new Map<ObjectId, BoundingBox>();

  for (const layer of page.layers) {
    if (!layer.metadata.visible) continue;
    for (const object of layer.objects) {
      if (excludeSet.has(object.id)) continue;
      const node = env.mainLayer.findOne(`#${object.id}`);
      if (!node) continue;
      const box = computeObjectBoundingBox(node, object);
      candidates.push(...buildObjectSnapCandidates(object.id, box));
      objectBoxes.set(object.id, box);
    }
  }

  return {
    candidates,
    objectBoxes,
    pageBox: { minX: 0, minY: 0, maxX: pageWidthPx, maxY: pageHeightPx },
    grid: { size: page.grid.size, snapEnabled: page.grid.snapEnabled },
    previousSnap: undefined,
  };
}

/**
 * Un frame de drag/resize: calcula el snap para la caja actual (YA con el
 * delta crudo del puntero aplicado) y redibuja las Smart Guides. `disabled`
 * es el modificador temporal (Ctrl/Cmd, ver Fase 7.3 sección 5) — cuando es
 * `true`, ni se calcula snap ni se dibuja ninguna guía, y se olvida
 * cualquier hysteresis previa del gesto (soltar Ctrl/Cmd a mitad de gesto
 * vuelve a evaluar desde cero, no reengancha el snap de antes de tenerlo
 * presionado).
 */
export function updateSnapGesture(
  env: SnapEnvironment,
  gesture: SnapGesture,
  targetBox: BoundingBox,
  options: { disabled: boolean; eligibleRefPoints?: EligibleRefPoints },
): SnapResult {
  if (options.disabled) {
    gesture.previousSnap = undefined;
    clearGuides(env.guidesLayer);
    return {};
  }

  const tolerance = SNAP_TOLERANCE_SCREEN_PX / env.getZoom();
  const result = computeSnap({
    targetBox,
    candidates: gesture.candidates,
    toleranceDocumentUnits: tolerance,
    grid: gesture.grid,
    previousSnap: gesture.previousSnap,
    eligibleRefPoints: options.eligibleRefPoints,
  });
  gesture.previousSnap = result;
  drawGuides(env, gesture, targetBox, result);
  return result;
}

/** Fin (o cancelación) del gesto: las guías nunca forman parte del
 * documento ni sobreviven la manipulación (Fase 7.3, sección 3). */
export function endSnapGesture(env: SnapEnvironment): void {
  clearGuides(env.guidesLayer);
}

function clearGuides(guidesLayer: Konva.Layer): void {
  guidesLayer.destroyChildren();
  guidesLayer.batchDraw();
}

function resolveGuideColor(stage: Konva.Stage): string {
  if (typeof window === "undefined") return GUIDE_COLOR_FALLBACK;
  const container = stage.container();
  const value = window.getComputedStyle(container).getPropertyValue(GUIDE_COLOR_VAR).trim();
  return value || GUIDE_COLOR_FALLBACK;
}

function verticalExtent(gesture: SnapGesture, axisSnap: AxisSnap, targetBox: BoundingBox): [number, number] {
  let min = targetBox.minY;
  let max = targetBox.maxY;
  if (axisSnap.source === "object" && axisSnap.objectId) {
    const box = gesture.objectBoxes.get(axisSnap.objectId);
    if (box) {
      min = Math.min(min, box.minY);
      max = Math.max(max, box.maxY);
    }
  } else if (axisSnap.source === "page") {
    min = Math.min(min, gesture.pageBox.minY);
    max = Math.max(max, gesture.pageBox.maxY);
  }
  return [min, max];
}

function horizontalExtent(gesture: SnapGesture, axisSnap: AxisSnap, targetBox: BoundingBox): [number, number] {
  let min = targetBox.minX;
  let max = targetBox.maxX;
  if (axisSnap.source === "object" && axisSnap.objectId) {
    const box = gesture.objectBoxes.get(axisSnap.objectId);
    if (box) {
      min = Math.min(min, box.minX);
      max = Math.max(max, box.maxX);
    }
  } else if (axisSnap.source === "page") {
    min = Math.min(min, gesture.pageBox.minX);
    max = Math.max(max, gesture.pageBox.maxX);
  }
  return [min, max];
}

function drawGuides(env: SnapEnvironment, gesture: SnapGesture, targetBox: BoundingBox, result: SnapResult): void {
  clearGuides(env.guidesLayer);
  if (!result.x && !result.y) return;

  const color = resolveGuideColor(env.stage);

  function addLine(points: number[]): void {
    // Halo blanco primero (más ancho, detrás), línea de color encima —
    // asegura contraste sin depender de un único color fijo.
    env.guidesLayer.add(new Konva.Line({ points, stroke: GUIDE_HALO_COLOR, strokeWidth: 3, listening: false }));
    env.guidesLayer.add(new Konva.Line({ points, stroke: color, strokeWidth: 1, listening: false }));
  }

  if (result.x) {
    const [yMin, yMax] = verticalExtent(gesture, result.x, targetBox);
    addLine([result.x.value, yMin - GUIDE_EXTENSION, result.x.value, yMax + GUIDE_EXTENSION]);
  }
  if (result.y) {
    const [xMin, xMax] = horizontalExtent(gesture, result.y, targetBox);
    addLine([xMin - GUIDE_EXTENSION, result.y.value, xMax + GUIDE_EXTENSION, result.y.value]);
  }

  env.guidesLayer.batchDraw();
}
