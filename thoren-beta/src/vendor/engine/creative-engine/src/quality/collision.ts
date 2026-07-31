import type { SceneObject } from "@impulso/document-schema";

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Aabb {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function rotatePoint(p: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/**
 * Caja englobante (AABB) de un `SceneObject` en coordenadas de página,
 * respetando su rotación.
 *
 * Pivote de rotación: el centro de la forma para Ellipse, la esquina
 * superior izquierda para todo lo demás — la misma semántica confirmada en
 * Fase 1 leyendo `@impulso/export-engine/src/svg/transformToSvgAttr.ts`
 * (el propio `transform.x/y` del schema siempre es top-left; lo que cambia
 * por tipo es solo el punto sobre el que gira el SVG exportado).
 *
 * Para Ellipse se usa el rectángulo que la circunscribe, no su contorno
 * exacto — una aproximación deliberadamente conservadora: puede marcar
 * como "colisión" un caso límite que en realidad no lo es, pero nunca deja
 * pasar una colisión real. Suficiente para el filtro básico de esta fase;
 * una prueba de intersección elipse-exacta pertenece al Filtro de calidad
 * ampliado (Fase 5).
 */
export function worldAabb(object: SceneObject): Aabb {
  const { x, y, rotation } = object.transform;
  // Path/Group no tienen `size` propio — no aparecen nunca en las
  // composiciones de esta fase (solo Rectangle/Ellipse/Text), pero el tipo
  // union de SceneObject exige la comprobación para ser válido igual.
  const { width, height } = "size" in object && object.size ? object.size : { width: 0, height: 0 };
  const isEllipse = object.type === "ellipse";
  const pivot = isEllipse ? { x: x + width / 2, y: y + height / 2 } : { x, y };
  const localCorners: Point[] = isEllipse
    ? [
        { x: -width / 2, y: -height / 2 },
        { x: width / 2, y: -height / 2 },
        { x: width / 2, y: height / 2 },
        { x: -width / 2, y: height / 2 },
      ]
    : [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];

  const worldCorners = localCorners.map((corner) => {
    const rotated = rotatePoint(corner, rotation);
    return { x: pivot.x + rotated.x, y: pivot.y + rotated.y };
  });
  const xs = worldCorners.map((c) => c.x);
  const ys = worldCorners.map((c) => c.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Objetos que realmente "pintan" un área de contenido — con `fill`
 * definido y fuera del rol `"background"`. Un contorno decorativo (marco,
 * anillo guía, sin `fill`) delimita visualmente sin ocupar su interior, y
 * el fondo de página siempre está debajo de todo por diseño — ninguno de
 * los dos participa en la detección de colisiones de contenido.
 */
export function contentObjects(objects: readonly SceneObject[]): SceneObject[] {
  return objects.filter((object) => object.style.fill !== undefined && object.metadata.role !== "background");
}

/** Todos los pares de objetos de contenido cuyas AABB rotadas se intersectan. */
export function findCollisions(objects: readonly SceneObject[]): Array<[SceneObject, SceneObject]> {
  const candidates = contentObjects(objects);
  const collisions: Array<[SceneObject, SceneObject]> = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (aabbOverlap(worldAabb(candidates[i]!), worldAabb(candidates[j]!))) {
        collisions.push([candidates[i]!, candidates[j]!]);
      }
    }
  }
  return collisions;
}
