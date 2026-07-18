import Konva from "konva";
import { segmentsToSvgPathData, type PathObject } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import { applyShapeStyle } from "../style.js";
import type { NodeContext } from "../types.js";

/**
 * `segmentsToSvgPathData` vive en `@impulso/document-schema` desde Epic 3
 * (antes vivía aquí) — el Export Engine la necesita exactamente igual para
 * su serializador SVG, y ninguno de los dos paquetes debe depender del
 * otro para obtenerla (ver ADR-0012). Se reexporta desde aquí para no
 * romper a quien ya la importaba de `@impulso/renderer-konva`.
 */
export { segmentsToSvgPathData };

export function createPathNode(object: PathObject, context: NodeContext): Konva.Path {
  const node = new Konva.Path({ data: segmentsToSvgPathData(object.segments, object.closed) });
  applyBaseAttrs(node, object, context);
  applyShapeStyle(node, object.style);
  return node;
}
