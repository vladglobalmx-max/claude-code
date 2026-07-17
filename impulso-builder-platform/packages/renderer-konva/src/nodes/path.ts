import Konva from "konva";
import type { PathObject, PathSegment } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import { applyShapeStyle } from "../style.js";
import type { NodeContext } from "../types.js";

/**
 * El Document Schema guarda el trazo como un array de segmentos tipados
 * (`PathSegment`), no como un string SVG "d" — a propósito, para que
 * `document-schema` no dependa ni siquiera nominalmente de SVG (ver
 * ADR-0002). Konva.Path sí necesita esa sintaxis de string, así que ESTA es
 * la traducción "Document Schema -> Konva" que le corresponde al Renderer.
 */
export function segmentsToSvgPathData(segments: readonly PathSegment[], closed: boolean): string {
  const commands = segments.map((segment) => {
    switch (segment.type) {
      case "moveTo":
        return `M ${segment.point.x} ${segment.point.y}`;
      case "lineTo":
        return `L ${segment.point.x} ${segment.point.y}`;
      case "quadraticCurveTo":
        return `Q ${segment.control.x} ${segment.control.y} ${segment.point.x} ${segment.point.y}`;
      case "cubicCurveTo":
        return `C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.point.x} ${segment.point.y}`;
      case "close":
        return "Z";
    }
  });

  const alreadyClosed = segments.some((segment) => segment.type === "close");
  if (closed && !alreadyClosed) {
    commands.push("Z");
  }
  return commands.join(" ");
}

export function createPathNode(object: PathObject, context: NodeContext): Konva.Path {
  const node = new Konva.Path({ data: segmentsToSvgPathData(object.segments, object.closed) });
  applyBaseAttrs(node, object, context);
  applyShapeStyle(node, object.style);
  return node;
}
