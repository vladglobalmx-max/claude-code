import Konva from "konva";
import type { EllipseObject } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import { applyShapeStyle } from "../style.js";
import type { NodeContext } from "../types.js";

export function createEllipseNode(object: EllipseObject, context: NodeContext): Konva.Ellipse {
  const node = new Konva.Ellipse({
    radiusX: object.size.width / 2,
    radiusY: object.size.height / 2,
  });
  applyBaseAttrs(node, object, context);
  applyShapeStyle(node, object.style);
  return node;
}
