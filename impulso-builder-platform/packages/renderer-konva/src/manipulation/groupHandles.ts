import Konva from "konva";
import type { ObjectId, Point, SceneObject, Transform } from "@impulso/document-schema";
import {
  translateGroupMembers,
  computeGroupResize,
  computeGroupRotation,
  computeGroupUnionBox,
  findObjectInDocument,
  RESIZE_HANDLES,
  MIN_RESIZE_SIZE,
  ROTATION_SNAP_INCREMENT_DEGREES,
  type Engine,
  type ResizeHandle,
  type BoundingBox,
  type GroupMember,
  type GroupTransformPatch,
} from "@impulso/engine";
import { computeObjectBoundingBox } from "./boundingBox.js";
import { toKonvaXY } from "../coordinates.js";
import { cursorForHandle, ROTATE_CURSOR, DEFAULT_CURSOR } from "./cursors.js";
import {
  HANDLE_SIZE,
  HANDLE_FILL,
  HANDLE_STROKE,
  ROTATE_HANDLE_OFFSET,
  isSnapDisabledByModifier,
  eligibleRefPointsForHandle,
} from "./handles.js";
import { clampPointToStageBounds } from "./interactiveBounds.js";
import {
  beginSnapGesture,
  updateSnapGesture,
  endSnapGesture,
  type SnapEnvironment,
  type SnapGesture,
} from "./smartGuides.js";

/**
 * Caja envolvente compartida + handles compartidos para 2+ objects
 * seleccionados (Epic 7 / Fase 7.4 — Professional Multi Selection, ver
 * ADR-0017). Hermano de `handles.ts` (selección de UN object): mismo
 * estilo visual (`HANDLE_SIZE`/`HANDLE_FILL`/`HANDLE_STROKE`/
 * `ROTATE_HANDLE_OFFSET`, reexportados desde ahí), mismo invariante
 * preview/commit (la matemática vive en `@impulso/engine`, nunca en Konva),
 * mismo recorte de rotación cerca del borde (`clampPointToStageBounds`,
 * ADR-0018).
 *
 * Diferencia clave de arquitectura respecto de `handles.ts`: acá el
 * "object" manipulado es la caja envolvente del CONJUNTO, que por
 * definición nunca está rotada — ningún handle necesita deshacer rotación
 * para razonar en espacio local, a diferencia del resize individual.
 */

interface MemberRuntime {
  objectId: ObjectId;
  node: Konva.Node;
  /** Snapshot INICIAL del object — nunca se reescribe durante el gesto; todo
   * patch de preview se calcula siempre a partir de este mismo valor (ver
   * README del Engine, "Coordenadas y precisión": nunca recalcular desde el
   * resultado del frame anterior). */
  object: SceneObject;
}

function toGroupMembers(runtime: readonly MemberRuntime[]): GroupMember[] {
  return runtime.map((member) => ({
    objectId: member.objectId,
    box: computeObjectBoundingBox(member.node, member.object),
    transform: member.object.transform,
  }));
}

/** Aplica un patch de preview al node Konva de un member, sin dispatch —
 * mismo patrón que ya usa `handles.ts` para el object individual. */
function applyPatchToNode(member: MemberRuntime, patch: Partial<Transform>): void {
  const mergedTransform: Transform = { ...member.object.transform, ...patch };
  const patchedObject = { ...member.object, transform: mergedTransform } as SceneObject;
  const { x, y } = toKonvaXY(patchedObject);
  member.node.setAttrs({
    x,
    y,
    rotation: mergedTransform.rotation,
    scaleX: mergedTransform.scaleX,
    scaleY: mergedTransform.scaleY,
  });
}

const GROUP_EPSILON = 1e-6;

function transformFieldChanged(before: Transform, patch: Partial<Transform>): boolean {
  return (Object.keys(patch) as (keyof Transform)[]).some(
    (key) => patch[key] !== undefined && Math.abs((patch[key] as number) - before[key]) > GROUP_EPSILON,
  );
}

/**
 * Fin de un gesto grupal exitoso: compara cada patch contra su snapshot
 * inicial (tolerancia `GROUP_EPSILON`, mismo criterio que `alignment.ts`) y
 * dispatcha un único `dispatchBatch` SOLO si algo cambió de verdad — un
 * gesto que termina exactamente donde empezó no genera ninguna entrada de
 * historial. Si nada cambió, o si `dispatchBatch` es rechazado, se llama a
 * `onNeedsRefresh` (en la app real, un re-render completo desde el Project
 * real) para descartar el preview visual — un `dispatchBatch` EXITOSO ya
 * dispara su propio `projectChanged`, que el Renderer ya escucha, así que
 * NO hace falta llamar a `onNeedsRefresh` en ese caso (evita un doble
 * render redundante).
 */
function commitGroupGesture(
  engine: Engine,
  runtime: readonly MemberRuntime[],
  patches: readonly GroupTransformPatch[],
  label: string,
  onNeedsRefresh: () => void,
): void {
  const runtimeById = new Map(runtime.map((member) => [member.objectId, member]));
  const commands = patches
    .filter((patch) => {
      const member = runtimeById.get(patch.objectId);
      return member && transformFieldChanged(member.object.transform, patch.transform);
    })
    .map((patch) => ({ type: "updateObjectTransform" as const, objectId: patch.objectId, transform: patch.transform }));

  if (commands.length === 0) {
    onNeedsRefresh();
    return;
  }
  const result = engine.dispatchBatch(commands, { label });
  if (!result.ok) onNeedsRefresh();
}

/** Registro/desregistro de cancelación externa (Escape vía `RendererAdapter`,
 * blur, pointercancel) — común a las 3 interacciones grupales (mover/
 * redimensionar/rotar). Retorna una función de limpieza a llamar SIEMPRE en
 * `dragend`, haya terminado en commit o en cancelación. */
function attachCancellableGesture(
  node: Konva.Node,
  onCancel: () => void,
  notifyGestureStart: (cancel: () => void) => void,
  notifyGestureEnd: () => void,
): { isCancelled: () => boolean; cleanup: () => void } {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    node.stopDrag();
  };
  const onBlur = () => cancel();
  const onPointerCancel = () => cancel();
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointercancel", onPointerCancel);
  notifyGestureStart(cancel);

  return {
    isCancelled: () => cancelled,
    cleanup: () => {
      if (cancelled) onCancel();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointercancel", onPointerCancel);
      notifyGestureEnd();
    },
  };
}

export interface GroupGestureHooks {
  /** Se invoca al iniciar CUALQUIER gesto grupal (mover/redimensionar/
   * rotar) con una función que lo cancela — `RendererAdapter.cancelActiveManipulation()`
   * la retiene para poder cancelar el gesto activo desde Escape (ver
   * `app.ts`). */
  notifyGestureStart: (cancel: () => void) => void;
  /** Se invoca al terminar CUALQUIER gesto grupal, haya terminado en commit
   * o en cancelación — limpia la referencia que `notifyGestureStart` dejó. */
  notifyGestureEnd: () => void;
}

interface GroupMoveParams {
  runtime: readonly MemberRuntime[];
  initialMembers: readonly GroupMember[];
  engine: Engine;
  onNeedsRefresh: () => void;
  snapping?: SnapEnvironment;
  hooks: GroupGestureHooks;
}

function attachGroupMoveInteractions(box: Konva.Rect, params: GroupMoveParams): void {
  const { runtime, initialMembers, engine, onNeedsRefresh, snapping, hooks } = params;
  const startPos = { x: box.x(), y: box.y() };
  const unionBoxInitial = computeGroupUnionBox(initialMembers);
  let gesture: SnapGesture | undefined;
  let cancellable: ReturnType<typeof attachCancellableGesture> | undefined;

  box.on("dragstart", () => {
    cancellable = attachCancellableGesture(box, () => onNeedsRefresh(), hooks.notifyGestureStart, hooks.notifyGestureEnd);
    if (!snapping) return;
    const page = engine.getProject().document.pages[0];
    gesture = page ? beginSnapGesture(snapping, page, runtime.map((m) => m.objectId)) : undefined;
  });

  box.on("dragmove", (evt) => {
    const rawDx = box.x() - startPos.x;
    const rawDy = box.y() - startPos.y;
    let dx = rawDx;
    let dy = rawDy;

    if (gesture && snapping) {
      const disabled = isSnapDisabledByModifier(evt as Konva.KonvaEventObject<DragEvent>);
      const targetBox: BoundingBox = {
        minX: unionBoxInitial.minX + rawDx,
        maxX: unionBoxInitial.maxX + rawDx,
        minY: unionBoxInitial.minY + rawDy,
        maxY: unionBoxInitial.maxY + rawDy,
      };
      const result = updateSnapGesture(snapping, gesture, targetBox, { disabled });
      if (result.x) dx += result.x.delta;
      if (result.y) dy += result.y.delta;
      if (dx !== rawDx || dy !== rawDy) box.position({ x: startPos.x + dx, y: startPos.y + dy });
    }

    for (const patch of translateGroupMembers(initialMembers, { x: dx, y: dy })) {
      const member = runtime.find((m) => m.objectId === patch.objectId);
      if (member) applyPatchToNode(member, patch.transform);
    }
    box.getLayer()?.batchDraw();
  });

  box.on("dragend", () => {
    if (snapping) endSnapGesture(snapping);
    gesture = undefined;
    const wasCancelled = cancellable?.isCancelled() ?? false;
    cancellable?.cleanup();
    if (wasCancelled) return;

    const dx = box.x() - startPos.x;
    const dy = box.y() - startPos.y;
    const patches = translateGroupMembers(initialMembers, { x: dx, y: dy });
    commitGroupGesture(engine, runtime, patches, "Mover selección", onNeedsRefresh);
  });
}

function isLeftSideHandle(handle: ResizeHandle): boolean {
  return handle === "top-left" || handle === "left" || handle === "bottom-left";
}
function isRightSideHandle(handle: ResizeHandle): boolean {
  return handle === "top-right" || handle === "right" || handle === "bottom-right";
}
function isTopSideHandle(handle: ResizeHandle): boolean {
  return handle === "top-left" || handle === "top" || handle === "top-right";
}
function isBottomSideHandle(handle: ResizeHandle): boolean {
  return handle === "bottom-left" || handle === "bottom" || handle === "bottom-right";
}

/** Vector unitario del eje a lo largo del cual un handle de BORDE (no de
 * esquina) del GRUPO debe deslizarse — a diferencia de `edgeAxisUnitVector`
 * en `handles.ts`, nunca depende de una rotación (la caja del grupo nunca
 * está rotada). `null` para handles de esquina (libres en 2D). */
function groupEdgeAxisUnitVector(handle: ResizeHandle): Point | null {
  if (handle === "top" || handle === "bottom") return { x: 0, y: 1 };
  if (handle === "left" || handle === "right") return { x: 1, y: 0 };
  return null;
}

/** Caja resultante de aplicar el delta crudo del puntero (SIN snap) — mismo
 * cálculo de ancho/alto/ancla que `computeGroupResize`, usado acá solo para
 * tener el `targetBox` que necesita `updateSnapGesture`. */
function computeRawTargetBox(unionBoxInitial: BoundingBox, handle: ResizeHandle, pointerDelta: Point): BoundingBox {
  const currentWidth = unionBoxInitial.maxX - unionBoxInitial.minX;
  const currentHeight = unionBoxInitial.maxY - unionBoxInitial.minY;
  let widthDelta = 0;
  if (isLeftSideHandle(handle)) widthDelta = -pointerDelta.x;
  else if (isRightSideHandle(handle)) widthDelta = pointerDelta.x;
  let heightDelta = 0;
  if (isTopSideHandle(handle)) heightDelta = -pointerDelta.y;
  else if (isBottomSideHandle(handle)) heightDelta = pointerDelta.y;

  const newWidth = Math.max(currentWidth + widthDelta, MIN_RESIZE_SIZE);
  const newHeight = Math.max(currentHeight + heightDelta, MIN_RESIZE_SIZE);
  const minX = isLeftSideHandle(handle) ? unionBoxInitial.maxX - newWidth : unionBoxInitial.minX;
  const minY = isTopSideHandle(handle) ? unionBoxInitial.maxY - newHeight : unionBoxInitial.minY;
  return { minX, minY, maxX: minX + newWidth, maxY: minY + newHeight };
}

/**
 * Ajusta el `pointerDelta` crudo para que, al volver a pasarlo por
 * `computeGroupResize`, el borde snapeado quede EXACTAMENTE en el valor del
 * candidato — mismo invariante que `pointerDeltaForSnappedPreview` en
 * `handles.ts` (preview y commit nunca pueden divergir), pero derivado
 * directamente del borde inicial del GRUPO (siempre axis-aligned, sin
 * necesidad de deshacer ninguna rotación).
 */
function pointerDeltaForSnappedGroupResize(
  unionBoxInitial: BoundingBox,
  handle: ResizeHandle,
  pointerDelta: Point,
  result: { x?: { value: number }; y?: { value: number } },
): Point {
  let x = pointerDelta.x;
  let y = pointerDelta.y;
  if (result.x) {
    const edgeInitial = isLeftSideHandle(handle) ? unionBoxInitial.minX : unionBoxInitial.maxX;
    x = result.x.value - edgeInitial;
  }
  if (result.y) {
    const edgeInitial = isTopSideHandle(handle) ? unionBoxInitial.minY : unionBoxInitial.maxY;
    y = result.y.value - edgeInitial;
  }
  return { x, y };
}

interface GroupResizeParams {
  handle: ResizeHandle;
  runtime: readonly MemberRuntime[];
  initialMembers: readonly GroupMember[];
  startPos: Point;
  engine: Engine;
  onNeedsRefresh: () => void;
  snapping?: SnapEnvironment;
  hooks: GroupGestureHooks;
}

/**
 * Snapping durante resize de GRUPO: a diferencia del resize individual
 * (`canSnapDuringResize` en `handles.ts`, restringido a rotación 0), la
 * caja envolvente del CONJUNTO siempre es un AABB puro — el snap de sus
 * bordes es válido sin ninguna restricción de rotación (ver ADR-0017,
 * sección "Integración con Smart Guides y Snapping").
 */
function attachGroupResizeInteractions(rect: Konva.Rect, params: GroupResizeParams): void {
  const { handle, runtime, initialMembers, startPos, engine, onNeedsRefresh, snapping, hooks } = params;
  const unionBoxInitial = computeGroupUnionBox(initialMembers);
  const axis = groupEdgeAxisUnitVector(handle);
  const eligibleRefPoints = eligibleRefPointsForHandle(handle);
  let gesture: SnapGesture | undefined;
  let cancellable: ReturnType<typeof attachCancellableGesture> | undefined;
  // `undefined` hasta el primer `dragmove` — si `dragend` llega sin que
  // `dragmove` haya corrido nunca (ej. un drag brevísimo), se recalcula
  // fresco desde la posición actual del handle, igual que ya hace
  // `attachResizeHandleInteractions` en `handles.ts` (`?? currentPointerDelta()`).
  let committedPointerDelta: Point | undefined;

  function currentPointerDelta(): Point {
    return { x: rect.x() - startPos.x, y: rect.y() - startPos.y };
  }

  rect.dragBoundFunc((pos) => {
    if (!axis) return pos;
    const dx = pos.x - startPos.x;
    const dy = pos.y - startPos.y;
    const t = dx * axis.x + dy * axis.y;
    return { x: startPos.x + t * axis.x, y: startPos.y + t * axis.y };
  });

  rect.on("dragstart", () => {
    cancellable = attachCancellableGesture(rect, () => onNeedsRefresh(), hooks.notifyGestureStart, hooks.notifyGestureEnd);
    if (!snapping) return;
    const page = engine.getProject().document.pages[0];
    gesture = page ? beginSnapGesture(snapping, page, runtime.map((m) => m.objectId)) : undefined;
  });

  rect.on("dragmove", (evt) => {
    const maintainAspectRatio = Boolean((evt.evt as MouseEvent | undefined)?.shiftKey);
    const rawPointerDelta = { x: rect.x() - startPos.x, y: rect.y() - startPos.y };
    let pointerDelta = rawPointerDelta;
    committedPointerDelta = rawPointerDelta;

    if (gesture && snapping && !maintainAspectRatio) {
      const targetBox = computeRawTargetBox(unionBoxInitial, handle, rawPointerDelta);
      const disabled = isSnapDisabledByModifier(evt as Konva.KonvaEventObject<DragEvent>);
      const result = updateSnapGesture(snapping, gesture, targetBox, { disabled, eligibleRefPoints });
      if (result.x || result.y) {
        pointerDelta = pointerDeltaForSnappedGroupResize(unionBoxInitial, handle, rawPointerDelta, result);
        committedPointerDelta = pointerDelta;
      }
    } else if (gesture && snapping) {
      endSnapGesture(snapping);
    }

    const patches = computeGroupResize({
      members: initialMembers,
      unionBoxInitial,
      handle,
      pointerDelta,
      maintainAspectRatio,
    });
    for (const patch of patches) {
      const member = runtime.find((m) => m.objectId === patch.objectId);
      if (member) applyPatchToNode(member, patch.transform);
    }
    rect.getLayer()?.batchDraw();
  });

  rect.on("dragend", (evt) => {
    if (snapping) endSnapGesture(snapping);
    gesture = undefined;
    const wasCancelled = cancellable?.isCancelled() ?? false;
    cancellable?.cleanup();
    if (wasCancelled) return;

    const maintainAspectRatio = Boolean((evt.evt as MouseEvent | undefined)?.shiftKey);
    const patches = computeGroupResize({
      members: initialMembers,
      unionBoxInitial,
      handle,
      pointerDelta: committedPointerDelta ?? currentPointerDelta(),
      maintainAspectRatio,
    });
    commitGroupGesture(engine, runtime, patches, "Redimensionar selección", onNeedsRefresh);
  });
}

interface GroupRotateParams {
  runtime: readonly MemberRuntime[];
  initialMembers: readonly GroupMember[];
  center: Point;
  startAngle: number;
  engine: Engine;
  onNeedsRefresh: () => void;
  hooks: GroupGestureHooks;
}

function angleFromCenter(center: Point, point: Point): number {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  // Misma convención que `angleFromPivot` en `handles.ts`: 0° directamente
  // arriba del centro, creciendo en sentido horario.
  return Math.atan2(dx, -dy) * (180 / Math.PI);
}

/** Rotación de grupo: SOLO conserva el snap angular existente (15° vía
 * Shift) — deliberadamente sin Smart Guides angulares (fuera de alcance,
 * ver ADR-0017, sección 8 del enunciado de producto). */
function attachGroupRotateInteractions(circle: Konva.Circle, params: GroupRotateParams): void {
  const { runtime, initialMembers, center, startAngle, engine, onNeedsRefresh, hooks } = params;
  let cancellable: ReturnType<typeof attachCancellableGesture> | undefined;

  function currentDelta(snapToIncrement: boolean): number {
    const currentAngle = angleFromCenter(center, { x: circle.x(), y: circle.y() });
    const delta = currentAngle - startAngle;
    return snapToIncrement ? Math.round(delta / ROTATION_SNAP_INCREMENT_DEGREES) * ROTATION_SNAP_INCREMENT_DEGREES : delta;
  }

  circle.on("dragstart", () => {
    cancellable = attachCancellableGesture(circle, () => onNeedsRefresh(), hooks.notifyGestureStart, hooks.notifyGestureEnd);
  });

  circle.on("dragmove", (evt) => {
    const delta = currentDelta(Boolean((evt.evt as MouseEvent | undefined)?.shiftKey));
    for (const patch of computeGroupRotation({ members: initialMembers, center, deltaRotationDegrees: delta })) {
      const member = runtime.find((m) => m.objectId === patch.objectId);
      if (member) applyPatchToNode(member, patch.transform);
    }
    circle.getLayer()?.batchDraw();
  });

  circle.on("dragend", (evt) => {
    const wasCancelled = cancellable?.isCancelled() ?? false;
    cancellable?.cleanup();
    if (wasCancelled) return;

    const delta = currentDelta(Boolean((evt.evt as MouseEvent | undefined)?.shiftKey));
    const patches = computeGroupRotation({ members: initialMembers, center, deltaRotationDegrees: delta });
    commitGroupGesture(engine, runtime, patches, "Rotar selección", onNeedsRefresh);
  });
}

function cornerOrEdgePoint(box: BoundingBox, handle: ResizeHandle): Point {
  const midX = (box.minX + box.maxX) / 2;
  const midY = (box.minY + box.maxY) / 2;
  switch (handle) {
    case "top-left":
      return { x: box.minX, y: box.minY };
    case "top":
      return { x: midX, y: box.minY };
    case "top-right":
      return { x: box.maxX, y: box.minY };
    case "left":
      return { x: box.minX, y: midY };
    case "right":
      return { x: box.maxX, y: midY };
    case "bottom-left":
      return { x: box.minX, y: box.maxY };
    case "bottom":
      return { x: midX, y: box.maxY };
    case "bottom-right":
      return { x: box.maxX, y: box.maxY };
  }
}

function setStageCursor(stage: Konva.Stage, cursor: string): void {
  const el = stage.container();
  if (el) el.style.cursor = cursor;
}

function attachCursorFeedback(node: Konva.Shape, stage: Konva.Stage, cursor: string): void {
  node.on("mouseenter", () => setStageCursor(stage, cursor));
  node.on("mouseleave", () => setStageCursor(stage, DEFAULT_CURSOR));
}

export interface RenderSharedManipulationHandlesParams {
  /** Objects seleccionados y TRANSFORMABLES (ya excluye bloqueados — la
   * política de qué puede transformarse vive en `renderer.ts`, no acá). */
  transformableIds: readonly ObjectId[];
  mainLayer: Konva.Layer;
  selectionLayer: Konva.Layer;
  stage: Konva.Stage;
  engine: Engine;
  /** Re-render completo desde el Project real — se llama SOLO cuando el
   * gesto NO produjo un cambio persistido (no-op, cancelación, o rechazo),
   * para descartar el preview visual. Un commit exitoso ya dispara su
   * propio `projectChanged`, que el Renderer escucha por separado. */
  onNeedsRefresh: () => void;
  hooks: GroupGestureHooks;
  snapping?: SnapEnvironment;
}

/**
 * Dibuja la caja envolvente compartida + 8 handles de resize + 1 handle de
 * rotación para 2+ objects transformables — el reemplazo profesional del
 * resaltado simple de Editor 2 que solo dibujaba un rectángulo punteado por
 * object (Fase 7.4, ver ADR-0017). Requiere 2+ ids: con 0 o 1, quien llama
 * (`renderer.ts`) debe usar el camino existente (vacío o
 * `renderManipulationHandles`).
 */
export function renderSharedManipulationHandles(params: RenderSharedManipulationHandlesParams): boolean {
  const { transformableIds, mainLayer, selectionLayer, stage, engine, onNeedsRefresh, hooks, snapping } = params;
  if (transformableIds.length < 2) return false;

  const project = engine.getProject();
  const runtime: MemberRuntime[] = [];
  for (const objectId of transformableIds) {
    const object = findObjectInDocument(project.document, objectId);
    const node = mainLayer.findOne(`#${objectId}`);
    if (!object || !node) return false;
    runtime.push({ objectId, node, object });
  }

  const initialMembers = toGroupMembers(runtime);
  const unionBox = computeGroupUnionBox(initialMembers);

  // Caja compartida: borde visible + área COMPLETA arrastrable (mover el
  // grupo debe funcionar clickeando en cualquier parte de la selección, no
  // solo sobre 1px de borde) — `fill` no-nulo hace que Konva trate toda el
  // área como blanco de hit-test, aunque sea visualmente transparente.
  const sharedBox = new Konva.Rect({
    x: unionBox.minX,
    y: unionBox.minY,
    width: unionBox.maxX - unionBox.minX,
    height: unionBox.maxY - unionBox.minY,
    stroke: HANDLE_STROKE,
    strokeWidth: 1,
    fill: "rgba(0,0,0,0.001)",
    draggable: true,
  });
  attachGroupMoveInteractions(sharedBox, { runtime, initialMembers, engine, onNeedsRefresh, snapping, hooks });
  selectionLayer.add(sharedBox);

  // Arrastrar el CUERPO de cualquier member ya seleccionado también mueve
  // el grupo completo (sección 9 del enunciado de producto) — cada member
  // deja de ser individualmente arrastrable mientras la selección sea 2+
  // (ver `renderer.ts`, que restaura `draggable` al volver a 0/1) y en su
  // lugar reenvía el gesto a la caja compartida vía la API pública de
  // Konva pensada exactamente para esto (`Node.startDrag()`).
  for (const member of runtime) {
    member.node.draggable(false);
    member.node.off("mousedown.groupDragForward");
    member.node.on("mousedown.groupDragForward", (evt) => {
      evt.cancelBubble = true;
      sharedBox.startDrag();
    });
  }

  for (const handle of RESIZE_HANDLES) {
    const point = cornerOrEdgePoint(unionBox, handle);
    const rect = new Konva.Rect({
      x: point.x,
      y: point.y,
      offsetX: HANDLE_SIZE / 2,
      offsetY: HANDLE_SIZE / 2,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      fill: HANDLE_FILL,
      stroke: HANDLE_STROKE,
      strokeWidth: 1,
      draggable: true,
    });
    attachGroupResizeInteractions(rect, {
      handle,
      runtime,
      initialMembers,
      startPos: point,
      engine,
      onNeedsRefresh,
      snapping,
      hooks,
    });
    attachCursorFeedback(rect, stage, cursorForHandle(handle));
    selectionLayer.add(rect);
  }

  const topCenter = { x: (unionBox.minX + unionBox.maxX) / 2, y: unionBox.minY };
  const rotatePointDesired = { x: topCenter.x, y: topCenter.y - ROTATE_HANDLE_OFFSET };
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
  const center = { x: (unionBox.minX + unionBox.maxX) / 2, y: (unionBox.minY + unionBox.maxY) / 2 };
  const startAngle = angleFromCenter(center, rotatePoint);
  attachGroupRotateInteractions(rotateHandle, { runtime, initialMembers, center, startAngle, engine, onNeedsRefresh, hooks });
  attachCursorFeedback(rotateHandle, stage, ROTATE_CURSOR);
  selectionLayer.add(rotateHandle);

  return true;
}
