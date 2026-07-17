import Konva from "konva";
import type { RectangleObject } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import { applyShapeStyle } from "../style.js";
import type { NodeContext } from "../types.js";

export function createRectangleNode(object: RectangleObject, context: NodeContext): Konva.Rect {
  const node = new Konva.Rect({
    width: object.size.width,
    height: object.size.height,
    cornerRadius: object.cornerRadius,
  });
  applyBaseAttrs(node, object, context);
  applyShapeStyle(node, object.style);
  return node;
}
