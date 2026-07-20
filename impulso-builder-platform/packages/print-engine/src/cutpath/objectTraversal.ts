import type { LayerId, Page, SceneObject } from "@impulso/document-schema";
import { affineFromTransform, pivotOf, type Affine2D } from "./affine.js";

/** Un object encontrado durante un recorrido recursivo de una página,
 * junto con la cadena de afines de sus Group ancestros (Fase 9.3, sección
 * 13) — necesaria para llevar su geometría local a espacio global sin
 * asumir que vive top-level. */
export interface TraversedObject {
  object: SceneObject;
  layerId: LayerId;
  /** Afines de los Group ancestros, de MÁS EXTERNO a MÁS INTERNO — nunca
   * incluye el afín del propio `object` (el caller lo agrega como último
   * eslabón vía `affineFromTransform(object.transform, pivotOf(object))`
   * cuando necesita el afín global completo, ver `cutGeometry.ts`). */
  ancestorChain: Affine2D[];
}

/**
 * Recorre TODOS los objects de una página, incluyendo recursivamente
 * dentro de cualquier `group` a cualquier profundidad (Fase 9.3, sección
 * 11 — a diferencia del recorrido top-level-only de `runPreflight` en
 * Fase 9.1/9.2). Preserva el orden natural de `layers`/`objects` (nunca
 * `Set`/`Map`) para resultados deterministas.
 */
export function traverseObjects(page: Page, predicate: (object: SceneObject) => boolean): TraversedObject[] {
  const results: TraversedObject[] = [];

  function walk(objects: SceneObject[], layerId: LayerId, ancestorChain: Affine2D[]): void {
    for (const object of objects) {
      if (predicate(object)) {
        results.push({ object, layerId, ancestorChain });
      }
      if (object.type === "group") {
        const ownAffine = affineFromTransform(object.transform, pivotOf(object));
        walk(object.children, layerId, [...ancestorChain, ownAffine]);
      }
    }
  }

  for (const layer of page.layers) {
    walk(layer.objects, layer.id, []);
  }

  return results;
}

/** Busca UN object por id, a cualquier profundidad — usado por
 * `CutPathSource: { type: "object"; objectId }` (selección manual). */
export function findObjectById(page: Page, objectId: string): TraversedObject | undefined {
  return traverseObjects(page, (object) => object.id === objectId)[0];
}
