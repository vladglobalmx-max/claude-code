import type { ObjectId, Point, Transform } from "@impulso/document-schema";
import { unionBoundingBox, type BoundingBox } from "./boundingBox.js";
import { MIN_RESIZE_SIZE, type ResizeHandle } from "./resizeMath.js";

const DEG2RAD = Math.PI / 180;

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Snapshot INICIAL de un member de una manipulación grupal (Epic 7 / Fase
 * 7.4 — Professional Multi Selection), capturado una sola vez al comenzar el
 * gesto. Todos los cálculos de este módulo parten SIEMPRE de este snapshot,
 * nunca del resultado del frame anterior — evita drift acumulativo (ver
 * ADR-0017, sección "Coordenadas y precisión").
 */
export interface GroupMember {
  objectId: ObjectId;
  /** Caja envolvente rotada del member, en el mismo espacio que `unionBoundingBox`
   * (ya medida por quien llama vía `computeObjectBoundingBox`, `@impulso/renderer-konva`
   * — este módulo nunca mide geometría, solo la combina). */
  box: BoundingBox;
  /** Mismo `Transform` que usa `updateObjectTransform` — el pivote real
   * (`x`/`y`) puede no coincidir con la esquina de `box` para Ellipse (ver
   * `coordinates.ts`), por eso se recibe explícito en vez de derivarlo de `box`. */
  transform: Transform;
}

/** Patch listo para convertirse 1:1 en un `updateObjectTransform` — mismo
 * contrato que `AlignmentPatch` (`alignment.ts`), generalizado a también
 * incluir `rotation`/`scaleX`/`scaleY` para resize/rotate de grupo. */
export interface GroupTransformPatch {
  objectId: ObjectId;
  transform: Partial<Transform>;
}

/**
 * Traducir todos los members por el mismo delta — exacto, sin aproximación:
 * la traslación conmuta con la rotación (mismo argumento que ya documenta
 * `AlignmentTarget` en `alignment.ts`), así que ningún member necesita
 * tratamiento especial sin importar su propia rotación/escala.
 */
export function translateGroupMembers(members: readonly GroupMember[], delta: Point): GroupTransformPatch[] {
  return members.map((member) => ({
    objectId: member.objectId,
    transform: { x: member.transform.x + delta.x, y: member.transform.y + delta.y },
  }));
}

export interface GroupResizeInput {
  members: readonly GroupMember[];
  /** Caja envolvente de TODA la selección transformable, medida al iniciar
   * el gesto (nunca recalculada frame a frame — ver README del Engine). */
  unionBoxInitial: BoundingBox;
  handle: ResizeHandle;
  /** Delta del puntero desde que empezó el gesto, en espacio canónico (px),
   * ya sin conversión de unidad — mismo espacio que `BoundingBox`. */
  pointerDelta: Point;
  /** Si es true (Shift), el resize del CONJUNTO conserva la proporción
   * ancho/alto de `unionBoxInitial` — ambos factores de escala se igualan al
   * mayor de los dos cambios relativos, mismo criterio que
   * `computeResizedTransform` ya usa para un object individual. */
  maintainAspectRatio?: boolean;
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

/**
 * Resize del CONJUNTO: la caja envolvente del grupo es SIEMPRE un AABB puro
 * (por definición de `BoundingBox`), sin importar la rotación de cada
 * member — a diferencia del resize individual (`computeResizedTransform`),
 * acá nunca hace falta deshacer ninguna rotación para razonar en "espacio
 * local", el ancla y los ejes del grupo YA son los ejes de pantalla.
 *
 * Por member: la posición de su pivote se escala como un punto respecto del
 * ancla (exacto, geometría de un punto, no de una forma — no importa su
 * rotación). Su `scaleX`/`scaleY` propio se multiplica por el mismo factor
 * del eje correspondiente del grupo — exacto cuando el member no está
 * rotado (o el resize es uniforme); una aproximación deliberada y
 * documentada cuando el member SÍ está rotado y el resize NO es uniforme,
 * ya que una escala no-uniforme de una forma rotada requeriría "shear"
 * (inclinación), una capacidad que el Document Schema no tiene
 * (`Transform` solo define `scaleX`/`scaleY`/`rotation`, sin shear) — ver
 * ADR-0017, "Riesgos y casos límite". La rotación de cada member nunca
 * cambia por un resize de grupo, tal como pide el enunciado de producto.
 */
export function computeGroupResize(input: GroupResizeInput): GroupTransformPatch[] {
  const { members, unionBoxInitial, handle, pointerDelta, maintainAspectRatio } = input;
  const box = unionBoxInitial;

  const currentWidth = box.maxX - box.minX;
  const currentHeight = box.maxY - box.minY;

  let widthDelta = 0;
  if (isLeftSideHandle(handle)) widthDelta = -pointerDelta.x;
  else if (isRightSideHandle(handle)) widthDelta = pointerDelta.x;

  let heightDelta = 0;
  if (isTopSideHandle(handle)) heightDelta = -pointerDelta.y;
  else if (isBottomSideHandle(handle)) heightDelta = pointerDelta.y;

  let newWidth = currentWidth + widthDelta;
  let newHeight = currentHeight + heightDelta;

  if (maintainAspectRatio && currentWidth > 0 && currentHeight > 0) {
    const aspectRatio = currentWidth / currentHeight;
    const widthChanged = widthDelta !== 0;
    const heightChanged = heightDelta !== 0;
    if (widthChanged && heightChanged) {
      if (Math.abs(widthDelta) / currentWidth > Math.abs(heightDelta) / currentHeight) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }
    } else if (widthChanged) {
      newHeight = newWidth / aspectRatio;
    } else if (heightChanged) {
      newWidth = newHeight * aspectRatio;
    }
  }

  newWidth = Math.max(newWidth, MIN_RESIZE_SIZE);
  newHeight = Math.max(newHeight, MIN_RESIZE_SIZE);

  // El ancla es el borde/esquina OPUESTO al handle arrastrado — nunca se
  // mueve, mismo criterio universal que el resize individual.
  const anchorX = isLeftSideHandle(handle) ? box.maxX : box.minX;
  const anchorY = isTopSideHandle(handle) ? box.maxY : box.minY;

  // Factor de escala por eje. Si el ancho/alto ORIGINAL del grupo es
  // ~0 (members superpuestos de tamaño casi nulo), escalar ese eje más allá
  // implicaría dividir por casi-cero (factor gigante o infinito) — se fija
  // el factor en 1 (ese eje solo se permite mover, no escalar) en vez de
  // producir NaN/Infinity (sección 4 del enunciado de producto).
  const scaleFactorX = currentWidth < MIN_RESIZE_SIZE ? 1 : newWidth / currentWidth;
  const scaleFactorY = currentHeight < MIN_RESIZE_SIZE ? 1 : newHeight / currentHeight;

  return members.map((member) => {
    const pivotX = member.transform.x;
    const pivotY = member.transform.y;
    const newX = anchorX + (pivotX - anchorX) * scaleFactorX;
    const newY = anchorY + (pivotY - anchorY) * scaleFactorY;
    return {
      objectId: member.objectId,
      transform: {
        x: newX,
        y: newY,
        scaleX: member.transform.scaleX * scaleFactorX,
        scaleY: member.transform.scaleY * scaleFactorY,
      },
    };
  });
}

export interface GroupRotationInput {
  members: readonly GroupMember[];
  /** Centro de la caja envolvente INICIAL de la selección — fijo durante
   * todo el gesto (nunca el centro "actual", ver README del Engine). */
  center: Point;
  /** Ángulo deseado del grupo respecto de como empezó el gesto (no un
   * ángulo absoluto) — el Renderer lo calcula igual que ya hace
   * `angleFromPivot` para el caso individual, restando el ángulo inicial. */
  deltaRotationDegrees: number;
}

/**
 * Rotación del CONJUNTO alrededor del centro de su caja envolvente inicial —
 * exacta, sin aproximación, sin importar la rotación previa de cada member:
 * cada punto se traslada al origen del centro, se rota, se destraslada; cada
 * rotación propia simplemente suma el mismo delta. Ninguna de las dos
 * operaciones puede producir shear ni degenerar — a diferencia del resize,
 * la rotación pura siempre conmuta exactamente.
 */
export function computeGroupRotation(input: GroupRotationInput): GroupTransformPatch[] {
  const { members, center, deltaRotationDegrees } = input;
  const rad = deltaRotationDegrees * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return members.map((member) => {
    const vx = member.transform.x - center.x;
    const vy = member.transform.y - center.y;
    const rotatedX = vx * cos - vy * sin;
    const rotatedY = vx * sin + vy * cos;
    return {
      objectId: member.objectId,
      transform: {
        x: center.x + rotatedX,
        y: center.y + rotatedY,
        rotation: normalizeAngle(member.transform.rotation + deltaRotationDegrees),
      },
    };
  });
}

/** Envolvente conjunta de los members de un gesto grupal — mismo
 * `unionBoundingBox` de `@impulso/engine`, re-exportado con un nombre que
 * deja explícito el caso de uso (evita que cada consumidor tenga que saber
 * que "unionBoundingBox" es también la función correcta para esto). */
export function computeGroupUnionBox(members: readonly GroupMember[]): BoundingBox {
  return unionBoundingBox(members.map((member) => member.box));
}
