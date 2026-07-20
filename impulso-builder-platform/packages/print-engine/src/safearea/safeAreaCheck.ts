import { unionBoundingBox, type BoundingBox } from "@impulso/engine";
import type { GroupObject, ObjectId, Page, PathSegment, Point, SceneObject } from "@impulso/document-schema";
import { affineFromTransform, applyAffine, composeAncestorChain, pivotOf, type Affine2D } from "../cutpath/affine.js";
import type { SafeAreaCanonicalRect } from "./safeAreaRect.js";

export interface SafeAreaInvasion {
  objectId: ObjectId;
  boundingBox: BoundingBox;
}

/** Puntos que definen el segmento (incluyendo controles bézier, para un
 * bounding box conservador — nunca subestima el área real de un Path). */
function pointsOfSegment(segment: PathSegment): Point[] {
  switch (segment.type) {
    case "moveTo":
    case "lineTo":
      return [segment.point];
    case "quadraticCurveTo":
      return [segment.control, segment.point];
    case "cubicCurveTo":
      return [segment.control1, segment.control2, segment.point];
    case "close":
      return [];
  }
}

/** Esquinas/puntos LOCALES (relativos al propio pivote del object, sin
 * rotar/escalar — el mismo espacio que ya usa `cutGeometry.ts`) de
 * cualquier `SceneObject` con geometría medible. `[]` para un `Text` sin
 * `size` explícito (limitación conocida — ver Technical Debt: no hay
 * forma de medir su tamaño real sin Konva) y para `group` (se agrega por
 * separado, como unión de sus hijos). */
function localPointsOf(object: SceneObject): Point[] {
  switch (object.type) {
    case "rectangle":
    case "image":
      return [
        { x: 0, y: 0 },
        { x: object.size.width, y: 0 },
        { x: object.size.width, y: object.size.height },
        { x: 0, y: object.size.height },
      ];
    case "ellipse":
      return [
        { x: -object.size.width / 2, y: -object.size.height / 2 },
        { x: object.size.width / 2, y: -object.size.height / 2 },
        { x: object.size.width / 2, y: object.size.height / 2 },
        { x: -object.size.width / 2, y: object.size.height / 2 },
      ];
    case "text":
      return object.size ? [{ x: 0, y: 0 }, { x: object.size.width, y: 0 }, { x: object.size.width, y: object.size.height }, { x: 0, y: object.size.height }] : [];
    case "path":
      return object.segments.flatMap(pointsOfSegment);
    case "group":
      return [];
  }
}

function boundingBoxFromPoints(points: readonly Point[]): BoundingBox | undefined {
  if (points.length === 0) return undefined;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Un descendiente participa en el bounding box de un `group` (o del
 * recorrido top-level) salvo que esté oculto o sea un die-line (sección
 * 9: política conservadora — `locked` NO excluye, es una propiedad de
 * edición, no de contenido/visibilidad). */
function participates(object: SceneObject): boolean {
  return object.metadata.visible && object.metadata.role !== "die-line";
}

/** Bounding box global de UN object hoja (no-group) ya ubicado en la
 * cadena de ancestros dada. */
function globalBoxOfLeaf(object: SceneObject, ancestorChain: readonly Affine2D[]): BoundingBox | undefined {
  const localPoints = localPointsOf(object);
  if (localPoints.length === 0) return undefined;
  const ownAffine = affineFromTransform(object.transform, pivotOf(object));
  const globalAffine = composeAncestorChain([...ancestorChain, ownAffine]);
  return boundingBoxFromPoints(localPoints.map((point) => applyAffine(globalAffine, point)));
}

/** Bounding box global de un `group` — la UNIÓN de los bounding boxes
 * globales de todos sus descendientes visibles/no-die-line, a cualquier
 * profundidad (sección 9: "groups deben evaluarse por su bounding box
 * visual" — el group cuenta como UNA sola unidad, igual que en selección/
 * manipulación en el resto de la plataforma; nunca se reportan sus hijos
 * como issues aparte). `undefined` si el group no tiene ningún
 * descendiente que participe (ej. contiene solo un die-line). */
function globalBoxOfGroup(group: GroupObject, ancestorChain: readonly Affine2D[]): BoundingBox | undefined {
  const ownAffine = affineFromTransform(group.transform, pivotOf(group));
  const childChain = [...ancestorChain, ownAffine];
  const childBoxes: BoundingBox[] = [];
  for (const child of group.children) {
    if (!participates(child)) continue;
    const box = child.type === "group" ? globalBoxOfGroup(child, childChain) : globalBoxOfLeaf(child, childChain);
    if (box) childBoxes.push(box);
  }
  return childBoxes.length > 0 ? unionBoundingBox(childBoxes) : undefined;
}

function overlaps(box: BoundingBox, rect: { x: number; y: number; width: number; height: number }): boolean {
  return box.maxX > rect.x && box.minX < rect.x + rect.width && box.maxY > rect.y && box.minY < rect.y + rect.height;
}

function within(box: BoundingBox, rect: { x: number; y: number; width: number; height: number }, epsilon: number): boolean {
  return box.minX >= rect.x - epsilon && box.minY >= rect.y - epsilon && box.maxX <= rect.x + rect.width + epsilon && box.maxY <= rect.y + rect.height + epsilon;
}

const EPSILON_PX = 1e-6;

/**
 * Detecta qué objects TOP-LEVEL de una página (cada `group` cuenta como
 * UNA sola unidad, sección 9) invaden el Safe Area — nunca bloquea
 * (siempre warnings, responsabilidad de Preflight asignar la severidad).
 * Un object completamente fuera del TrimBox nunca genera un issue de
 * Safe Area (puede tener otro issue de Preflight, no este) — sección 9,
 * último punto.
 */
export function checkSafeAreaInvasions(page: Page, trimWidthPx: number, trimHeightPx: number, safeAreaRect: SafeAreaCanonicalRect): SafeAreaInvasion[] {
  const trimRect = { x: 0, y: 0, width: trimWidthPx, height: trimHeightPx };
  const invasions: SafeAreaInvasion[] = [];

  for (const layer of page.layers) {
    if (!layer.metadata.visible) continue;
    for (const object of layer.objects) {
      if (!participates(object)) continue;
      const box = object.type === "group" ? globalBoxOfGroup(object, []) : globalBoxOfLeaf(object, []);
      if (!box) continue;
      if (!overlaps(box, trimRect)) continue;
      if (!within(box, safeAreaRect, EPSILON_PX)) {
        invasions.push({ objectId: object.id, boundingBox: box });
      }
    }
  }

  return invasions;
}
