import type Konva from "konva";
import type { SceneObject } from "@impulso/document-schema";
import type { NodeContext } from "../types.js";

/**
 * Traduce "hubo un click sobre este nodo, Shift estaba o no presionado" al
 * comando de Engine correspondiente. La SEMÁNTICA de qué hace cada caso con
 * la selección (reemplazar vs. alternar) vive en el Engine
 * (`setSelection`/`toggleObjectSelection`, Editor 2) — este módulo no
 * decide nada, solo traduce el hecho crudo.
 */
export function attachSelectionInteractions(node: Konva.Node, object: SceneObject, context: NodeContext): void {
  node.on("click", (evt) => {
    if (evt.evt.shiftKey) {
      context.dispatch({ type: "toggleObjectSelection", objectId: object.id });
    } else {
      context.dispatch({ type: "setSelection", objectIds: [object.id] });
    }
    // Sin esto, el click también burbujearía hasta el Stage y dispararía
    // su handler de "click en vacío -> clearSelection" (ver renderer.ts).
    evt.cancelBubble = true;
  });
}
