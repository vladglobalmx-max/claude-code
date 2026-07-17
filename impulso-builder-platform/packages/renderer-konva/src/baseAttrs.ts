import type Konva from "konva";
import type { SceneObject } from "@impulso/document-schema";
import { toKonvaXY, fromKonvaXY } from "./coordinates.js";
import { toCanvasBlendMode } from "./style.js";
import type { NodeContext } from "./types.js";

/**
 * Atributos y comportamiento comunes a TODO nodo Konva creado a partir de un
 * SceneObject, incluyendo `group` (por eso vive separado de
 * `applyShapeStyle`, que asume un `Konva.Shape` con fill/stroke).
 *
 * Este es el único lugar donde se traduce un evento de Konva
 * (`dragend`) en una llamada al Engine (`dispatch`) — la responsabilidad
 * central de este paquete.
 */
export function applyBaseAttrs(node: Konva.Node, object: SceneObject, context: NodeContext): void {
  const { x, y } = toKonvaXY(object);
  const draggable = !object.metadata.locked;

  node.setAttrs({
    id: object.id,
    x,
    y,
    rotation: object.transform.rotation,
    scaleX: object.transform.scaleX,
    scaleY: object.transform.scaleY,
    opacity: object.style.opacity,
    visible: object.metadata.visible,
    listening: draggable,
    draggable,
    globalCompositeOperation: toCanvasBlendMode(object.style.blendMode),
  });

  node.on("dragend", () => {
    const { x: newX, y: newY } = fromKonvaXY(object, node.x(), node.y());
    const result = context.dispatch({
      type: "updateObjectTransform",
      objectId: object.id,
      transform: { x: newX, y: newY },
    });
    if (!result.ok) {
      // El Engine rechazó el cambio (ej. el object ya no existe). Konva ya
      // movió el nodo visualmente durante el drag; sin este revert, la
      // pantalla quedaría desincronizada del estado canónico del Engine.
      // El caller (renderer.ts) es quien realmente re-renderiza — ver ahí.
      context.onRejectedTransform?.();
    }
  });
}
