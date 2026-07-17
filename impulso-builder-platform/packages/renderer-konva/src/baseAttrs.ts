import type Konva from "konva";
import type { SceneObject } from "@impulso/document-schema";
import { toKonvaXY } from "./coordinates.js";
import { toCanvasBlendMode } from "./style.js";
import { attachSelectionInteractions } from "./interactions/selectionInteractions.js";
import { attachTransformInteractions } from "./interactions/transformInteractions.js";
import type { NodeContext } from "./types.js";

/**
 * Atributos estáticos comunes a TODO nodo Konva creado a partir de un
 * SceneObject, incluyendo `group` (por eso vive separado de
 * `applyShapeStyle`, que asume un `Konva.Shape` con fill/stroke). La
 * traducción de gestos de puntero a comandos del Engine vive en los
 * módulos de `interactions/` (selección, transform) — este archivo no
 * escucha ningún evento, solo fija atributos.
 */
export function applyBaseAttrs(node: Konva.Node, object: SceneObject, context: NodeContext): void {
  const { x, y } = toKonvaXY(object);
  const draggable = !object.metadata.locked;
  // `listening` ya no depende solo de `draggable`: un object bloqueado
  // sigue siendo seleccionable por click (no se puede arrastrar, pero sí
  // inspeccionar) — sí deja de escuchar si está oculto.
  const listening = object.metadata.visible;

  node.setAttrs({
    id: object.id,
    x,
    y,
    rotation: object.transform.rotation,
    scaleX: object.transform.scaleX,
    scaleY: object.transform.scaleY,
    opacity: object.style.opacity,
    visible: object.metadata.visible,
    listening,
    draggable,
    globalCompositeOperation: toCanvasBlendMode(object.style.blendMode),
  });

  attachSelectionInteractions(node, object, context);
  attachTransformInteractions(node, object, context);
}
