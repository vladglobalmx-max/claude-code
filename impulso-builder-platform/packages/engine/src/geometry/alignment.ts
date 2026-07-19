import type { ObjectId, Transform } from "@impulso/document-schema";
import { unionBoundingBox, type BoundingBox } from "./boundingBox.js";

/**
 * Tolerancia para decidir "este object ya está alineado, no lo muevas".
 * Los deltas se calculan por resta directa de las mismas cajas ya
 * calculadas (no hay conversión de unidades intermedia en este módulo), así
 * que en la práctica el resultado es exacto o difiere solo por el error de
 * redondeo de punto flotante de la resta/suma en sí — este épsilon absorbe
 * exactamente eso, no un margen de "visualmente parecido".
 */
const ALIGNMENT_EPSILON = 1e-6;

/**
 * Un object candidato a alinear/distribuir: su caja envolvente actual (ya
 * calculada por quien llama — ver README, "de dónde sale `box`") y su
 * `Transform.x/y` actual, necesario para traducir un delta de posición en
 * un patch de `Transform` concreto. Mover un object rotado por `(dx, dy)`
 * traslada su caja rotada por exactamente lo mismo (la traslación conmuta
 * con la rotación) — por eso ninguna función de este módulo necesita volver
 * a considerar `rotationDegrees` al calcular el patch, solo al haber
 * calculado `box` en primer lugar.
 */
export interface AlignmentTarget {
  objectId: ObjectId;
  box: BoundingBox;
  transform: Pick<Transform, "x" | "y">;
}

/** Patch listo para convertirse 1:1 en un `updateObjectTransform`. Solo
 * incluye el eje que la operación realmente cambia. */
export interface AlignmentPatch {
  objectId: ObjectId;
  transform: Partial<Pick<Transform, "x" | "y">>;
}

function buildHorizontalPatches(
  targets: readonly AlignmentTarget[],
  targetMinX: (target: AlignmentTarget, union: BoundingBox) => number,
): AlignmentPatch[] {
  if (targets.length === 0) return [];
  const union = unionBoundingBox(targets.map((t) => t.box));
  const patches: AlignmentPatch[] = [];
  for (const target of targets) {
    const dx = targetMinX(target, union) - target.box.minX;
    if (Math.abs(dx) < ALIGNMENT_EPSILON) continue;
    patches.push({ objectId: target.objectId, transform: { x: target.transform.x + dx } });
  }
  return patches;
}

function buildVerticalPatches(
  targets: readonly AlignmentTarget[],
  targetMinY: (target: AlignmentTarget, union: BoundingBox) => number,
): AlignmentPatch[] {
  if (targets.length === 0) return [];
  const union = unionBoundingBox(targets.map((t) => t.box));
  const patches: AlignmentPatch[] = [];
  for (const target of targets) {
    const dy = targetMinY(target, union) - target.box.minY;
    if (Math.abs(dy) < ALIGNMENT_EPSILON) continue;
    patches.push({ objectId: target.objectId, transform: { y: target.transform.y + dy } });
  }
  return patches;
}

/**
 * Las 6 alineaciones básicas. La referencia es siempre la caja envolvente
 * CONJUNTA de la selección (`union`), no la de cada object individual — así
 * "Alinear a la izquierda" mueve cada object a compartir el borde
 * izquierdo de la selección completa, sin que la selección entera "salte"
 * de posición (ver instrucción de producto de esta fase).
 */
export function alignLeft(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  return buildHorizontalPatches(targets, (_target, union) => union.minX);
}

export function alignRight(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  return buildHorizontalPatches(targets, (target, union) => union.maxX - (target.box.maxX - target.box.minX));
}

export function alignCenterHorizontal(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  return buildHorizontalPatches(targets, (target, union) => {
    const unionCenter = (union.minX + union.maxX) / 2;
    const width = target.box.maxX - target.box.minX;
    return unionCenter - width / 2;
  });
}

export function alignTop(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  return buildVerticalPatches(targets, (_target, union) => union.minY);
}

export function alignBottom(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  return buildVerticalPatches(targets, (target, union) => union.maxY - (target.box.maxY - target.box.minY));
}

export function alignCenterVertical(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  return buildVerticalPatches(targets, (target, union) => {
    const unionCenter = (union.minY + union.maxY) / 2;
    const height = target.box.maxY - target.box.minY;
    return unionCenter - height / 2;
  });
}

/**
 * Orden determinista por posición visual actual (borde izquierdo/superior),
 * con el id como desempate estable cuando dos objects comparten la misma
 * coordenada primaria — nunca depende del orden de `targets` recibido.
 */
function sortByPrimaryEdge(
  targets: readonly AlignmentTarget[],
  edge: (box: BoundingBox) => number,
): AlignmentTarget[] {
  return [...targets].sort((a, b) => {
    const diff = edge(a.box) - edge(b.box);
    if (diff !== 0) return diff;
    return a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0;
  });
}

/**
 * Distribuye el espacio disponible EN PARTES IGUALES entre las cajas
 * adyacentes (no entre sus centros) — el primer y el último object (por
 * posición visual actual) conservan su posición; solo los del medio se
 * reubican. Requiere 3 o más objects: con 0-2 no hay "espacio entre" bien
 * definido, se devuelve `[]` (no-op) en vez de fallar.
 *
 * Caso límite documentado: si el espacio entre el primer y el último object
 * es menor que la suma de los anchos/altos de los objects del medio, el gap
 * calculado da negativo y los objects del medio terminan superpuestos —
 * comportamiento determinista y predecible (la misma fórmula sin ramas
 * especiales), nunca un fallo silencioso ni una excepción.
 */
export function distributeHorizontal(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  if (targets.length < 3) return [];
  const sorted = sortByPrimaryEdge(targets, (box) => box.minX);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const middle = sorted.slice(1, -1);

  const availableSpace = last.box.minX - first.box.maxX;
  const sumMiddleWidths = middle.reduce((sum, t) => sum + (t.box.maxX - t.box.minX), 0);
  const gap = (availableSpace - sumMiddleWidths) / (sorted.length - 1);

  const patches: AlignmentPatch[] = [];
  let cursor = first.box.maxX;
  for (const target of middle) {
    const width = target.box.maxX - target.box.minX;
    const newMinX = cursor + gap;
    const dx = newMinX - target.box.minX;
    if (Math.abs(dx) >= ALIGNMENT_EPSILON) {
      patches.push({ objectId: target.objectId, transform: { x: target.transform.x + dx } });
    }
    cursor = newMinX + width;
  }
  return patches;
}

export function distributeVertical(targets: readonly AlignmentTarget[]): AlignmentPatch[] {
  if (targets.length < 3) return [];
  const sorted = sortByPrimaryEdge(targets, (box) => box.minY);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const middle = sorted.slice(1, -1);

  const availableSpace = last.box.minY - first.box.maxY;
  const sumMiddleHeights = middle.reduce((sum, t) => sum + (t.box.maxY - t.box.minY), 0);
  const gap = (availableSpace - sumMiddleHeights) / (sorted.length - 1);

  const patches: AlignmentPatch[] = [];
  let cursor = first.box.maxY;
  for (const target of middle) {
    const height = target.box.maxY - target.box.minY;
    const newMinY = cursor + gap;
    const dy = newMinY - target.box.minY;
    if (Math.abs(dy) >= ALIGNMENT_EPSILON) {
      patches.push({ objectId: target.objectId, transform: { y: target.transform.y + dy } });
    }
    cursor = newMinY + height;
  }
  return patches;
}

/**
 * Centra UN object respecto de la página (no la selección completa — fuera
 * de alcance de esta fase, ver instrucción de producto). `pageWidth`/
 * `pageHeight` deben estar en la misma unidad canónica que
 * `Transform.x/y` (px) — si `page.unit !== "px"`, quien llama debe
 * convertir con `toPixels` de `@impulso/document-schema` antes de invocar
 * esto; esta función no sabe nada de unidades físicas.
 */
export function centerOnPageHorizontal(target: AlignmentTarget, pageWidth: number): AlignmentPatch[] {
  const width = target.box.maxX - target.box.minX;
  const dx = (pageWidth - width) / 2 - target.box.minX;
  if (Math.abs(dx) < ALIGNMENT_EPSILON) return [];
  return [{ objectId: target.objectId, transform: { x: target.transform.x + dx } }];
}

export function centerOnPageVertical(target: AlignmentTarget, pageHeight: number): AlignmentPatch[] {
  const height = target.box.maxY - target.box.minY;
  const dy = (pageHeight - height) / 2 - target.box.minY;
  if (Math.abs(dy) < ALIGNMENT_EPSILON) return [];
  return [{ objectId: target.objectId, transform: { y: target.transform.y + dy } }];
}
