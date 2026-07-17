import type { SceneObject } from "@impulso/document-schema";

/**
 * El Document Schema trata `transform.x/y` como la esquina superior
 * izquierda de la caja del objeto (consistente con Rectangle/Image/Text/
 * Group). Konva.Ellipse, en cambio, posiciona su nodo por el CENTRO — es
 * una particularidad de esa primitiva de Konva, no del Document Schema.
 * Estas dos funciones son el único lugar donde esa conversión ocurre, en
 * ambos sentidos, para que quede simétrica y fácil de testear aislada.
 */
export function toKonvaXY(object: SceneObject): { x: number; y: number } {
  if (object.type === "ellipse") {
    return {
      x: object.transform.x + object.size.width / 2,
      y: object.transform.y + object.size.height / 2,
    };
  }
  return { x: object.transform.x, y: object.transform.y };
}

export function fromKonvaXY(object: SceneObject, konvaX: number, konvaY: number): { x: number; y: number } {
  if (object.type === "ellipse") {
    return { x: konvaX - object.size.width / 2, y: konvaY - object.size.height / 2 };
  }
  return { x: konvaX, y: konvaY };
}
