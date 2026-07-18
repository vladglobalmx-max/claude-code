import type Konva from "konva";
import type { SceneObject, Size } from "@impulso/document-schema";
import type { ResizeHandle } from "@impulso/engine";

const DEG2RAD = Math.PI / 180;

/**
 * Geometría de la caja de manipulación de UN object, derivada directamente
 * del nodo Konva ya renderizado (no del Document Schema): `intrinsicSize` se
 * mide del node Konva porque es el único lugar que sabe medir la geometría
 * real de cualquier tipo (incluyendo Path con curvas bezier o un Group
 * anidado) — ver ADR-0008, "por qué el Engine no puede calcular esto por sí
 * mismo".
 */
export interface ManipulationBox {
  /** El mismo punto que Konva usa como posición/pivote de rotación de este
   * node — esquina superior izquierda para la mayoría de los tipos, centro
   * para Ellipse (ver `../coordinates.ts`). Es una propiedad heredada de
   * cómo el Document Schema define `transform.x/y` desde Foundation 1, no
   * algo que este módulo decida. */
  pivot: { x: number; y: number };
  rotationDegrees: number;
  intrinsicSize: Size;
  currentWidth: number;
  currentHeight: number;
  /** Esquina superior izquierda de la caja, en espacio LOCAL (sin rotar), relativa al pivote. */
  originOffset: { x: number; y: number };
}

/**
 * Tamaño "natural" del node a escala 1. `Konva.Shape` (Rectangle/Ellipse/
 * Image/Text/Path) implementa `getSelfRect()` directamente; `Konva.Group`
 * no lo implementa en absoluto (no es un Shape) — para ese caso se usa
 * `getClientRect({ skipTransform: true })`, que ignora la transform PROPIA
 * del node pero sigue midiendo la geometría real de sus hijos (útil para
 * un Group anidado, que no tiene ningún campo `size` propio).
 */
function measureIntrinsicSize(node: Konva.Node): Size {
  const shape = node as Partial<Konva.Shape>;
  if (typeof shape.getSelfRect === "function") {
    const rect = shape.getSelfRect();
    return { width: rect.width, height: rect.height };
  }
  const rect = node.getClientRect({ skipTransform: true });
  return { width: rect.width, height: rect.height };
}

export function computeManipulationBox(node: Konva.Node, object: SceneObject): ManipulationBox {
  const intrinsicSize = measureIntrinsicSize(node);
  const currentWidth = intrinsicSize.width * node.scaleX();
  const currentHeight = intrinsicSize.height * node.scaleY();
  const originOffset =
    object.type === "ellipse" ? { x: -currentWidth / 2, y: -currentHeight / 2 } : { x: 0, y: 0 };

  return {
    pivot: { x: node.x(), y: node.y() },
    rotationDegrees: node.rotation(),
    intrinsicSize,
    currentWidth,
    currentHeight,
    originOffset,
  };
}

/** Punto LOCAL (sin rotar, relativo al pivote) de cada uno de los 8 handles
 * de resize — mismas posiciones que `RESIZE_HANDLES` (`@impulso/engine`). */
export function localHandlePoint(box: ManipulationBox, handle: ResizeHandle): { x: number; y: number } {
  const { originOffset: o, currentWidth: w, currentHeight: h } = box;
  switch (handle) {
    case "top-left":
      return { x: o.x, y: o.y };
    case "top":
      return { x: o.x + w / 2, y: o.y };
    case "top-right":
      return { x: o.x + w, y: o.y };
    case "left":
      return { x: o.x, y: o.y + h / 2 };
    case "right":
      return { x: o.x + w, y: o.y + h / 2 };
    case "bottom-left":
      return { x: o.x, y: o.y + h };
    case "bottom":
      return { x: o.x + w / 2, y: o.y + h };
    case "bottom-right":
      return { x: o.x + w, y: o.y + h };
  }
}

/** Punto LOCAL del handle de rotación: centrado arriba de la caja, a
 * `offset` píxeles de distancia del borde superior. */
export function localRotateHandlePoint(box: ManipulationBox, offset: number): { x: number; y: number } {
  return { x: box.originOffset.x + box.currentWidth / 2, y: box.originOffset.y - offset };
}

/**
 * Rota un punto LOCAL (relativo al pivote) al espacio del padre (el mismo
 * espacio en el que viven `mainLayer`/`selectionLayer`), aplicando la
 * rotación actual del object — misma convención de giro que
 * `computeResizedTransform` (Engine) usa para reubicar el anclaje tras un
 * resize, para que ambos cálculos permanezcan consistentes entre sí.
 */
export function localToParent(box: ManipulationBox, local: { x: number; y: number }): { x: number; y: number } {
  const rad = box.rotationDegrees * DEG2RAD;
  const dx = local.x * Math.cos(rad) - local.y * Math.sin(rad);
  const dy = local.x * Math.sin(rad) + local.y * Math.cos(rad);
  return { x: box.pivot.x + dx, y: box.pivot.y + dy };
}
