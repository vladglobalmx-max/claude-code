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
 * Este es el único lugar donde se traducen eventos de Konva (`dragend`,
 * `click`) en llamadas al Engine (`dispatch`) — la responsabilidad central
 * de este paquete. La SEMÁNTICA de qué hace cada click con la selección
 * (reemplazar vs. agregar/quitar con Shift) vive en el Engine
 * (`toggleObjectSelection`, Editor 2) — aquí solo se traduce el hecho crudo
 * "hubo un click, Shift estaba o no presionado" al comando correspondiente.
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

  node.on("click", (evt) => {
    if (evt.evt.shiftKey) {
      context.dispatch({ type: "toggleObjectSelection", objectId: object.id });
    } else {
      context.dispatch({ type: "setSelection", objectIds: [object.id] });
    }
    // Sin esto, el click también burbujearía hasta el Stage y dispararía
    // su propio handler de "click en vacío -> clearSelection" (ver
    // renderer.ts) — un click sobre un object nunca debe deseleccionarlo.
    evt.cancelBubble = true;
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
