import Konva from "konva";
import type { ObjectId, SceneObject } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";
import {
  computeResizedTransform,
  computeRotatedTransform,
  findObjectInDocument,
  RESIZE_HANDLES,
  type ResizeHandle,
} from "@impulso/engine";
import {
  computeManipulationBox,
  localHandlePoint,
  localRotateHandlePoint,
  localToParent,
  type ManipulationBox,
} from "./boundingBox.js";
import { cursorForHandle, ROTATE_CURSOR, DEFAULT_CURSOR } from "./cursors.js";

const HANDLE_SIZE = 8;
const HANDLE_FILL = "#ffffff";
const HANDLE_STROKE = "#3b82f6";
const ROTATE_HANDLE_OFFSET = 24;
const DEG2RAD = Math.PI / 180;

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
function attachResizeHandleInteractions(rect: Konva.Rect, params: ResizeHandleParams): void {
  const { objectId, handle, node, object, box, engine, onRejected, startPos } = params;
  const axis = edgeAxisUnitVector(handle, box.rotationDegrees);

  rect.dragBoundFunc((pos) => {
    if (!axis) return pos;
    const dx = pos.x - startPos.x;
    const dy = pos.y - startPos.y;
    const t = dx * axis.x + dy * axis.y;
    return { x: startPos.x + t * axis.x, y: startPos.y + t * axis.y };
  });

  function currentPointerDelta(): { x: number; y: number } {
    return { x: rect.x() - startPos.x, y: rect.y() - startPos.y };
  }

  rect.on("dragmove", (evt) => {
    const preview = computeResizedTransform({
      transform: object.transform,
      intrinsicSize: box.intrinsicSize,
      handle,
      pointerDelta: currentPointerDelta(),
      maintainAspectRatio: Boolean((evt.evt as MouseEvent | undefined)?.shiftKey),
    });
    node.setAttrs(preview);
    node.getLayer()?.batchDraw();
  });

  rect.on("dragend", (evt) => {
    const result = engine.dispatch({
      type: "resizeObject",
      objectId,
      handle,
      pointerDelta: currentPointerDelta(),
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
  const { objectId, node, selectionLayer, stage, engine, onRejected } = params;
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
    attachResizeHandleInteractions(rect, { objectId, handle, node, object, box, engine, onRejected, startPos });
    attachCursorFeedback(rect, stage, cursorForHandle(handle));
    selectionLayer.add(rect);
  }

  const topCenter = localToParent(box, localHandlePoint(box, "top"));
  const rotatePoint = localToParent(box, localRotateHandlePoint(box, ROTATE_HANDLE_OFFSET));
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
