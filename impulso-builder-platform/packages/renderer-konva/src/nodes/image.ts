import Konva from "konva";
import type { ImageObject } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import { applyShapeStyle } from "../style.js";
import type { NodeContext } from "../types.js";

/**
 * `ImageObject` solo guarda una referencia (`assetId`) — el binario real
 * vive donde Persistence/Assets lo resuelva (ninguno existe todavía, ver
 * README "Fuera de alcance"). Sin un `resolveAssetSource` inyectado, no hay
 * píxeles que dibujar: se muestra un placeholder (rectángulo punteado) del
 * tamaño correcto, no una imagen inventada ni un error.
 */
export function createImageNode(object: ImageObject, context: NodeContext): Konva.Image {
  const source = context.resolveAssetSource?.(object.assetId);

  const node = new Konva.Image({
    image: source,
    width: object.size.width,
    height: object.size.height,
  });
  applyBaseAttrs(node, object, context);
  applyShapeStyle(node, object.style);

  if (!source) {
    node.dash([4, 4]);
    node.stroke(object.style.stroke ?? "#999999");
    node.strokeWidth(object.style.strokeWidth || 1);
  }

  return node;
}
