import type Konva from "konva";
import type { SceneObject } from "@impulso/document-schema";
import { fromKonvaXY } from "../coordinates.js";
import type { NodeContext } from "../types.js";
import { computeObjectBoundingBox } from "../manipulation/boundingBox.js";
import {
  beginSnapGesture,
  updateSnapGesture,
  endSnapGesture,
  type SnapGesture,
} from "../manipulation/smartGuides.js";

/** Modificador temporal para desactivar snapping durante un gesto (Fase
 * 7.3, sección 5): Ctrl en Windows/Linux, Cmd en macOS — la misma
 * convención cross-platform ya usada implícitamente en `keyboardShortcuts.ts`
 * (ambas teclas se tratan como "meta" ahí). Sin conflicto real: hoy
 * mantener Ctrl/Cmd solo durante un drag no dispara ningún atajo (esos
 * escuchan `keydown` de combos completos, no el estado retenido del
 * puntero) — ver auditoría de Fase 7.3. */
function isSnapDisabledByModifier(evt: Konva.KonvaEventObject<DragEvent | MouseEvent>): boolean {
  const native = evt.evt as MouseEvent | undefined;
  return Boolean(native?.ctrlKey || native?.metaKey);
}

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
  // Estado del gesto actual (snapshot de candidatos + hysteresis) — vive
  // solo mientras dura un drag, nunca se persiste (Fase 7.3, sección 3/14).
  let gesture: SnapGesture | undefined;

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

    const snapping = context.snapping;
    const page = snapping?.engine.getProject().document.pages[0];
    gesture = page ? beginSnapGesture(snapping!.env, page, [object.id]) : undefined;
  });

  // Smart Guides + Snapping durante move (Epic 7 / Fase 7.3 — Assisted
  // Placement): a diferencia de resize/rotate, mover un object no tenía
  // hasta ahora ningún `dragmove` — Konva ya deja el nodo en la posición
  // cruda del puntero, y este handler ajusta esa posición (preview, nunca
  // dispatch) cuando hay un snap vigente. `computeObjectBoundingBox` lee la
  // posición ACTUAL del node (no la stale de `object.transform`), así que
  // el snap siempre razona sobre dónde Konva ya dejó el nodo este frame.
  node.on("dragmove", (evt) => {
    if (!gesture || !context.snapping) return;
    const disabled = isSnapDisabledByModifier(evt as Konva.KonvaEventObject<DragEvent>);
    const targetBox = computeObjectBoundingBox(node, object);
    const result = updateSnapGesture(context.snapping.env, gesture, targetBox, { disabled });
    if (result.x) node.x(node.x() + result.x.delta);
    if (result.y) node.y(node.y() + result.y.delta);
    node.getLayer()?.batchDraw();
  });

  node.on("dragend", () => {
    if (context.snapping) endSnapGesture(context.snapping.env);
    gesture = undefined;

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
