import Konva from "konva";
import type { ObjectId, SceneObject, Transform } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";
import {
  computeResizedTransform,
  computeRotatedTransform,
  findObjectInDocument,
  RESIZE_HANDLES,
  MIN_RESIZE_SIZE,
  type ResizeHandle,
  type BoundingBox,
  type RefPoint,
  type SnapResult,
} from "@impulso/engine";
import {
  computeManipulationBox,
  localHandlePoint,
  localRotateHandlePoint,
  localToParent,
  type ManipulationBox,
} from "./boundingBox.js";
import { cursorForHandle, ROTATE_CURSOR, DEFAULT_CURSOR } from "./cursors.js";
import { clampPointToStageBounds } from "./interactiveBounds.js";
import {
  beginSnapGesture,
  updateSnapGesture,
  endSnapGesture,
  type SnapEnvironment,
  type SnapGesture,
} from "./smartGuides.js";

// Exportadas (Epic 7 / Fase 7.4 — Professional Multi Selection): la caja
// compartida de `groupHandles.ts` necesita el MISMO estilo visual y el
// MISMO offset de rotación que la caja de un solo object — para que ambas
// se sientan como el mismo sistema, no dos paralelos (ver ADR-0017).
export const HANDLE_SIZE = 8;
export const HANDLE_FILL = "#ffffff";
export const HANDLE_STROKE = "#3b82f6";
export const ROTATE_HANDLE_OFFSET = 24;
const DEG2RAD = Math.PI / 180;

/** Modificador temporal Ctrl/Cmd (Fase 7.3, sección 5) — mismo criterio que
 * `interactions/transformInteractions.ts`. Exportada: `groupHandles.ts` la
 * reutiliza sin duplicarla. */
export function isSnapDisabledByModifier(evt: Konva.KonvaEventObject<DragEvent | MouseEvent>): boolean {
  const native = evt.evt as MouseEvent | undefined;
  return Boolean(native?.ctrlKey || native?.metaKey);
}

/** Snapping en resize (Fase 7.3, sección 4: "cuando la arquitectura actual
 * permita integrarlo limpiamente") se restringe deliberadamente a objects
 * SIN rotación y que NO sean Ellipse: son los únicos casos donde el AABB
 * de la caja de manipulación coincide 1:1 con `transform.x/y` +
 * `intrinsicSize * scale` (sin `originOffset` no-trivial ni conversión de
 * pivote — ver `coordinates.ts`, Ellipse posiciona su node Konva por el
 * CENTRO). Con rotación, cada handle de borde ya no corresponde a un único
 * eje AABB (los 4 extremos del AABB rotado se mueven todos a la vez), y
 * decidir qué "borde" snapear dejaría de ser una restricción limpia de
 * puntos de referencia — encaja en la cláusula de alcance del enunciado en
 * vez de forzar una geometría más compleja en este sprint.
 */
function canSnapDuringResize(object: SceneObject, box: ManipulationBox): boolean {
  if (object.type === "ellipse") return false;
  const normalized = ((box.rotationDegrees % 360) + 360) % 360;
  return normalized < 0.01 || normalized > 359.99;
}

/** Qué puntos de referencia del AABB mueve cada handle — un handle de
 * borde (no-esquina) solo mueve UN eje; el opuesto se pasa vacío (`[]`,
 * nunca `undefined`) para que `computeSnap` no evalúe ese eje en absoluto
 * (ver `ComputeSnapInput.eligibleRefPoints`, "resize solo pasa el borde que
 * ese handle específico mueve"). Exportada: el resize de grupo
 * (`groupHandles.ts`) usa exactamente la misma regla — a diferencia del
 * caso individual, el AABB del GRUPO nunca está rotado, así que esta regla
 * aplica sin ninguna restricción adicional (ver ADR-0017, sección 6). */
export function eligibleRefPointsForHandle(handle: ResizeHandle): { x: RefPoint[]; y: RefPoint[] } {
  const x: RefPoint[] = [];
  const y: RefPoint[] = [];
  if (handle.includes("left")) x.push("start");
  if (handle.includes("right")) x.push("end");
  if (handle.startsWith("top")) y.push("start");
  if (handle.startsWith("bottom")) y.push("end");
  return { x, y };
}

/**
 * Ajusta el preview de resize (ya calculado por `computeResizedTransform`)
 * para que el borde snapeado quede EXACTAMENTE en el valor del candidato,
 * manteniendo fijo el ancla opuesta (mismo invariante que
 * `computeResizedTransform` ya respeta para Shift/tamaño mínimo). Solo se
 * invoca cuando `canSnapDuringResize` es `true` — ahí `originOffset` es
 * siempre `{0,0}` (ver `computeManipulationBox`) y por lo tanto
 * `minX === x`, `maxX === x + width` sin ninguna conversión adicional.
 */
function applySnapToResizePreview(
  preview: Partial<Transform>,
  result: SnapResult,
  targetBox: BoundingBox,
  intrinsicSize: { width: number; height: number },
): Partial<Transform> {
  if (!result.x && !result.y) return preview;
  const next = { ...preview };

  if (result.x) {
    if (result.x.refPoint === "start") {
      const newWidth = Math.max(targetBox.maxX - result.x.value, MIN_RESIZE_SIZE);
      next.x = targetBox.maxX - newWidth;
      next.scaleX = newWidth / intrinsicSize.width;
    } else if (result.x.refPoint === "end") {
      const newWidth = Math.max(result.x.value - targetBox.minX, MIN_RESIZE_SIZE);
      next.scaleX = newWidth / intrinsicSize.width;
    }
  }

  if (result.y) {
    if (result.y.refPoint === "start") {
      const newHeight = Math.max(targetBox.maxY - result.y.value, MIN_RESIZE_SIZE);
      next.y = targetBox.maxY - newHeight;
      next.scaleY = newHeight / intrinsicSize.height;
    } else if (result.y.refPoint === "end") {
      const newHeight = Math.max(result.y.value - targetBox.minY, MIN_RESIZE_SIZE);
      next.scaleY = newHeight / intrinsicSize.height;
    }
  }

  return next;
}

function setStageCursor(stage: Konva.Stage, cursor: string): void {
  const el = stage.container();
  if (el) el.style.cursor = cursor;
}

function attachCursorFeedback(node: Konva.Shape, stage: Konva.Stage, cursor: string): void {
  node.on("mouseenter", () => setStageCursor(stage, cursor));
  node.on("mouseleave", () => setStageCursor(stage, DEFAULT_CURSOR));
}

/** Vector unitario del eje local (rotado) a lo largo del cual un handle de
 * BORDE (no de esquina) debe deslizarse. `null` para handles de esquina —
 * esos se arrastran libremente en 2D, sin restricción de eje (misma
 * convención que cualquier editor de diseño). */
function edgeAxisUnitVector(handle: ResizeHandle, rotationDegrees: number): { x: number; y: number } | null {
  const rad = rotationDegrees * DEG2RAD;
  if (handle === "top" || handle === "bottom") {
    return { x: -Math.sin(rad), y: Math.cos(rad) };
  }
  if (handle === "left" || handle === "right") {
    return { x: Math.cos(rad), y: Math.sin(rad) };
  }
  return null;
}

interface ResizeHandleParams {
  objectId: ObjectId;
  handle: ResizeHandle;
  node: Konva.Node;
  object: SceneObject;
  box: ManipulationBox;
  engine: Engine;
  onRejected: () => void;
  startPos: { x: number; y: number };
  /** Ausente cuando el `NodeContext` de origen no proveyó snapping (ver
   * `types.ts`) — el resize funciona igual, simplemente sin Smart Guides. */
  snapping?: SnapEnvironment;
}

/**
 * Arrastrar un handle de resize: en cada `dragmove` se llama
 * `computeResizedTransform` (la misma función pura que el comando
 * `resizeObject` usará al soltar) y se aplica directamente al node Konva
 * para previsualización instantánea, SIN pasar por `dispatch` — evita el
 * costo del rebuild completo de `mainLayer` en cada frame de arrastre (ver
 * ADR-0008, "Rendimiento", y el mismo patrón ya usado por
 * `transformInteractions.ts` desde Editor 3). Solo `dragend` llama a
 * `engine.dispatch`, que internamente recalcula con la MISMA función —
 * previsualización y estado final nunca pueden divergir.
 */
/** Invierte `computeResizedTransform` para el caso `canSnapDuringResize`
 * (rotación 0): dado el preview YA ajustado por snap, recupera el
 * `pointerDelta` equivalente que — pasado de nuevo por
 * `computeResizedTransform` en `dragend`/el comando `resizeObject` —
 * reproduce EXACTAMENTE el mismo resultado que el preview snapeado. Sin
 * esto, el preview visual (snapeado) y el transform final que dispatcha
 * `resizeObject` (que solo conoce `pointerDelta` crudo) podrían divergir —
 * violaría el invariante "previsualización y estado final nunca pueden
 * divergir" que este archivo ya documenta para el caso sin snap. */
function pointerDeltaForSnappedPreview(
  object: SceneObject,
  box: ManipulationBox,
  handle: ResizeHandle,
  preview: Partial<Transform>,
): { x: number; y: number } {
  const currentWidth = box.intrinsicSize.width * object.transform.scaleX;
  const currentHeight = box.intrinsicSize.height * object.transform.scaleY;
  const newWidth = box.intrinsicSize.width * (preview.scaleX ?? object.transform.scaleX);
  const newHeight = box.intrinsicSize.height * (preview.scaleY ?? object.transform.scaleY);
  const widthDelta = newWidth - currentWidth;
  const heightDelta = newHeight - currentHeight;

  let x = 0;
  if (handle.includes("left")) x = -widthDelta;
  else if (handle.includes("right")) x = widthDelta;

  let y = 0;
  if (handle.startsWith("top")) y = -heightDelta;
  else if (handle.startsWith("bottom")) y = heightDelta;

  return { x, y };
}

function attachResizeHandleInteractions(rect: Konva.Rect, params: ResizeHandleParams): void {
  const { objectId, handle, node, object, box, engine, onRejected, startPos, snapping } = params;
  const axis = edgeAxisUnitVector(handle, box.rotationDegrees);
  const canSnap = Boolean(snapping) && canSnapDuringResize(object, box);
  const eligibleRefPoints = eligibleRefPointsForHandle(handle);
  let gesture: SnapGesture | undefined;
  // Último `pointerDelta` EQUIVALENTE al preview realmente mostrado este
  // gesto (crudo si no hubo snap este frame, ajustado si lo hubo) — lo que
  // `dragend` dispatcha, para que nunca diverja del preview.
  let committedPointerDelta: { x: number; y: number } | undefined;

  rect.dragBoundFunc((pos) => {
    if (!axis) return pos;
    const dx = pos.x - startPos.x;
    const dy = pos.y - startPos.y;
    const t = dx * axis.x + dy * axis.y;
    return { x: startPos.x + t * axis.x, y: startPos.y + t * axis.y };
  });

  rect.on("dragstart", () => {
    if (!canSnap || !snapping) return;
    const page = engine.getProject().document.pages[0];
    if (page) gesture = beginSnapGesture(snapping, page, [objectId]);
  });

  function currentPointerDelta(): { x: number; y: number } {
    return { x: rect.x() - startPos.x, y: rect.y() - startPos.y };
  }

  rect.on("dragmove", (evt) => {
    const maintainAspectRatio = Boolean((evt.evt as MouseEvent | undefined)?.shiftKey);
    const rawPointerDelta = currentPointerDelta();
    const preview = computeResizedTransform({
      transform: object.transform,
      intrinsicSize: box.intrinsicSize,
      handle,
      pointerDelta: rawPointerDelta,
      maintainAspectRatio,
    });

    let finalPreview = preview;
    committedPointerDelta = rawPointerDelta;
    // Shift (mantener proporción) ya tiene un significado establecido y
    // ajusta AMBOS ejes a la vez — combinarlo con un snap de UN solo borde
    // (que este módulo resuelve eje por eje, ver `applySnapToResizePreview`)
    // rompería esa proporción. Se prioriza la convención existente: con
    // Shift presionado, el snapping se trata como desactivado este frame.
    if (canSnap && gesture && snapping && !maintainAspectRatio) {
      const x = preview.x ?? object.transform.x;
      const y = preview.y ?? object.transform.y;
      const width = box.intrinsicSize.width * (preview.scaleX ?? object.transform.scaleX);
      const height = box.intrinsicSize.height * (preview.scaleY ?? object.transform.scaleY);
      const targetBox: BoundingBox = { minX: x, minY: y, maxX: x + width, maxY: y + height };
      const disabled = isSnapDisabledByModifier(evt as Konva.KonvaEventObject<DragEvent>);
      const result = updateSnapGesture(snapping, gesture, targetBox, { disabled, eligibleRefPoints });
      if (result.x || result.y) {
        finalPreview = applySnapToResizePreview(preview, result, targetBox, box.intrinsicSize);
        committedPointerDelta = pointerDeltaForSnappedPreview(object, box, handle, finalPreview);
      }
    } else if (canSnap && snapping) {
      // Shift presionado — asegurar que no quede una guía "colgada" del
      // frame anterior (justo antes de empezar a mantener Shift a mitad
      // de gesto).
      endSnapGesture(snapping);
    }

    node.setAttrs(finalPreview);
    node.getLayer()?.batchDraw();
  });

  rect.on("dragend", (evt) => {
    if (snapping) endSnapGesture(snapping);
    gesture = undefined;

    const result = engine.dispatch({
      type: "resizeObject",
      objectId,
      handle,
      pointerDelta: committedPointerDelta ?? currentPointerDelta(),
      intrinsicSize: box.intrinsicSize,
      maintainAspectRatio: Boolean((evt.evt as MouseEvent | undefined)?.shiftKey),
    });
    if (!result.ok) onRejected();
  });
}

interface RotateHandleParams {
  objectId: ObjectId;
  node: Konva.Node;
  pivot: { x: number; y: number };
  engine: Engine;
  onRejected: () => void;
}

function angleFromPivot(pivot: { x: number; y: number }, point: { x: number; y: number }): number {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  // atan2(dx, -dy): 0° cuando el punto está directamente ARRIBA del pivote,
  // creciendo en sentido horario — misma convención de giro que
  // `computeResizedTransform` (Engine) usa internamente (rotación positiva
  // = sentido horario en espacio de pantalla, Y crece hacia abajo).
  return Math.atan2(dx, -dy) * (180 / Math.PI);
}

/** Arrastrar el handle de rotación: mismo patrón preview/commit que el
 * resize, usando `computeRotatedTransform`. */
function attachRotateHandleInteractions(circle: Konva.Circle, params: RotateHandleParams): void {
  const { objectId, node, pivot, engine, onRejected } = params;

  function currentAngle(): number {
    return angleFromPivot(pivot, { x: circle.x(), y: circle.y() });
  }

  circle.on("dragmove", (evt) => {
    const preview = computeRotatedTransform({
      pointerAngleDegrees: currentAngle(),
      snapToIncrement: Boolean((evt.evt as MouseEvent | undefined)?.shiftKey),
    });
    node.setAttrs(preview);
    node.getLayer()?.batchDraw();
  });

  circle.on("dragend", (evt) => {
    const result = engine.dispatch({
      type: "rotateObject",
      objectId,
      pointerAngleDegrees: currentAngle(),
      snapToIncrement: Boolean((evt.evt as MouseEvent | undefined)?.shiftKey),
    });
    if (!result.ok) onRejected();
  });
}

export interface RenderManipulationHandlesParams {
  objectId: ObjectId;
  node: Konva.Node;
  selectionLayer: Konva.Layer;
  stage: Konva.Stage;
  engine: Engine;
  onRejected: () => void;
  /** Smart Guides/Snapping durante resize (Epic 7 / Fase 7.3). Ausente en
   * llamadas de test que no lo necesitan — el resize funciona igual, sin
   * guías. La rotación NO recibe esto: el snap-to-15° de rotación ya
   * existía antes de esta fase y no se toca (ver Fase 7.3, sección 4). */
  snapping?: SnapEnvironment;
}

/**
 * Dibuja la caja de manipulación completa (bounding box real —
 * potencialmente rotado, no la caja delimitadora alineada a ejes— + 8
 * handles de resize + handle de rotación) para el ÚNICO object
 * seleccionado. `renderer.ts` solo llama a esto cuando `getSelection()`
 * tiene exactamente un id — multi-selección conserva el resaltado simple
 * ya existente desde Editor 2 (ver ADR-0008, alcance).
 */
export function renderManipulationHandles(params: RenderManipulationHandlesParams): boolean {
  const { objectId, node, selectionLayer, stage, engine, onRejected, snapping } = params;
  const object = findObjectInDocument(engine.getProject().document, objectId);
  if (!object) return false;

  const box = computeManipulationBox(node, object);

  const corners = (["top-left", "top-right", "bottom-right", "bottom-left"] as const).map((handle) =>
    localToParent(box, localHandlePoint(box, handle)),
  );
  selectionLayer.add(
    new Konva.Line({
      points: corners.flatMap((p) => [p.x, p.y]),
      closed: true,
      stroke: HANDLE_STROKE,
      strokeWidth: 1,
      listening: false,
    }),
  );

  // Epic 7 / Fase 7.4 (Professional Multi Selection) — política de objects
  // bloqueados: un object bloqueado puede seguir seleccionado/inspeccionado
  // (por eso el contorno de arriba SIEMPRE se dibuja), pero nunca es
  // transformable — no se ofrecen handles de resize/rotación. Antes de esta
  // fase, los Rects de resize/rotación eran `draggable: true`
  // incondicionalmente, sin importar `object.metadata.locked` — un gap
  // preexistente que esta fase cierra al formalizar la política, no un
  // rediseño amplio del sistema de manipulación.
  if (object.metadata.locked) return true;

  for (const handle of RESIZE_HANDLES) {
    const startPos = localToParent(box, localHandlePoint(box, handle));
    const rect = new Konva.Rect({
      x: startPos.x,
      y: startPos.y,
      offsetX: HANDLE_SIZE / 2,
      offsetY: HANDLE_SIZE / 2,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      fill: HANDLE_FILL,
      stroke: HANDLE_STROKE,
      strokeWidth: 1,
      draggable: true,
    });
    attachResizeHandleInteractions(rect, { objectId, handle, node, object, box, engine, onRejected, startPos, snapping });
    attachCursorFeedback(rect, stage, cursorForHandle(handle));
    selectionLayer.add(rect);
  }

  const topCenter = localToParent(box, localHandlePoint(box, "top"));
  const rotatePointDesired = localToParent(box, localRotateHandlePoint(box, ROTATE_HANDLE_OFFSET));
  // ADR-0018: recorta el offset del handle de rotación contra los límites
  // interactivos del Stage (nunca lo oculta) — mismo recorte que usa la
  // caja compartida de multi-selección (ver `groupHandles.ts`), para que
  // ambos casos se comporten idénticamente cerca de un borde.
  const rotatePoint = clampPointToStageBounds(
    topCenter,
    rotatePointDesired,
    { width: stage.width(), height: stage.height() },
    HANDLE_SIZE / 2,
  );
  selectionLayer.add(
    new Konva.Line({
      points: [topCenter.x, topCenter.y, rotatePoint.x, rotatePoint.y],
      stroke: HANDLE_STROKE,
      strokeWidth: 1,
      listening: false,
    }),
  );

  const rotateHandle = new Konva.Circle({
    x: rotatePoint.x,
    y: rotatePoint.y,
    radius: HANDLE_SIZE / 2,
    fill: HANDLE_FILL,
    stroke: HANDLE_STROKE,
    strokeWidth: 1,
    draggable: true,
  });
  attachRotateHandleInteractions(rotateHandle, { objectId, node, pivot: box.pivot, engine, onRejected });
  attachCursorFeedback(rotateHandle, stage, ROTATE_CURSOR);
  selectionLayer.add(rotateHandle);

  return true;
}
