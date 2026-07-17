import type Konva from "konva";
import type { SceneObject } from "@impulso/document-schema";
import { fromKonvaXY } from "../coordinates.js";
import type { NodeContext } from "../types.js";

/**
 * El Transform System (Editor 3): traduce gestos de arrastre a
 * `engine.dispatch({ type: "updateObjectTransform", ... })`. Toda la
 * lógica de transformación en sí (validar el transform resultante,
 * fusionarlo con el existente, versionar el cambio) ya vivía en el Engine
 * desde Foundation 2 — `updateObjectTransform` acepta un `Partial<Transform>`
 * precisamente para estar listo para mover, y más adelante rotar/escalar,
 * sin cambiar su forma. Este módulo es, deliberadamente, la única pieza
 * nueva: la traducción del gesto de puntero.
 *
 * Aislado de `selectionInteractions.ts` a propósito — son dos sistemas de
 * interacción distintos que hoy se tocan en un solo punto (`dragstart`
 * asegura que el object arrastrado quede seleccionado), pero que un futuro
 * `resizeInteractions.ts`/`rotateInteractions.ts` puede sumarse como
 * hermano sin tocar ninguno de los dos existentes.
 */
export function attachTransformInteractions(node: Konva.Node, object: SceneObject, context: NodeContext): void {
  node.on("dragstart", () => {
    const currentSelection = context.getSelection?.() ?? [];
    if (!currentSelection.includes(object.id)) {
      // Arrastrar un object que no estaba seleccionado lo selecciona — así
      // el resaltado de selección acompaña visualmente el arrastre desde
      // el primer frame, no solo después de soltar. Si el object YA
      // formaba parte de una selección múltiple, esa selección no se
      // colapsa (mover-en-grupo queda fuera de alcance de este sprint,
      // pero no se rompe una selección existente por accidente).
      context.dispatch({ type: "setSelection", objectIds: [object.id] });
    }
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
      context.onRejectedTransform?.();
    }
  });
}
