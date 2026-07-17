import type Konva from "konva";
import type { SceneObject } from "@impulso/document-schema";
import type { NodeContext } from "../types.js";
import { createRectangleNode } from "./rectangle.js";
import { createEllipseNode } from "./ellipse.js";
import { createPathNode } from "./path.js";
import { createImageNode } from "./image.js";
import { createTextNode } from "./text.js";
import { createGroupNode } from "./group.js";

/** Único punto que sabe mapear cualquier tipo de SceneObject a su nodo Konva. */
export function createSceneNode(object: SceneObject, context: NodeContext): Konva.Shape | Konva.Group {
  switch (object.type) {
    case "rectangle":
      return createRectangleNode(object, context);
    case "ellipse":
      return createEllipseNode(object, context);
    case "path":
      return createPathNode(object, context);
    case "image":
      return createImageNode(object, context);
    case "text":
      return createTextNode(object, context);
    case "group":
      return createGroupNode(object, context, createSceneNode);
  }
}
