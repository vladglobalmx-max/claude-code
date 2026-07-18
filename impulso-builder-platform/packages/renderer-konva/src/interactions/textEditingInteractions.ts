import type Konva from "konva";
import type { TextObject } from "@impulso/document-schema";
import type { NodeContext } from "../types.js";

/**
 * `Konva.Text` no es editable in-canvas (ver ADR-0004, Riesgos) — la única
 * forma de editar contenido es superponer un `<textarea>` HTML real sobre
 * el node mientras se edita, y volver a mostrar el node de Konva al
 * terminar. Doble-click activa la edición; blur/Enter confirma
 * (`updateObjectContent`), Escape cancela sin despachar nada. Ver
 * ADR-0010.
 *
 * No se ata a `interactive: false` (hijos anidados en un group) desde
 * aquí — quien crea el node (`nodes/text.ts`) decide si llamar a esta
 * función en absoluto, con el mismo criterio que ya usa `baseAttrs.ts`
 * para selección/transform: un texto anidado no es editable
 * individualmente hasta desagrupar.
 */
export function attachTextEditingInteraction(node: Konva.Text, object: TextObject, context: NodeContext): void {
  node.on("dblclick dbltap", () => {
    startEditing(node, object, context);
  });
}

interface TextareaRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
}

/** Función pura (dado el node ya montado en un Stage) — separada para poder testear el cálculo sin DOM real. */
export function computeTextareaRect(node: Konva.Text): TextareaRect {
  const absPos = node.getAbsolutePosition();
  const absScale = node.getAbsoluteScale();
  return {
    x: absPos.x,
    y: absPos.y,
    width: node.width() * absScale.x,
    height: node.height() * absScale.y,
    rotationDegrees: node.getAbsoluteRotation(),
  };
}

function applyTextareaRect(textarea: HTMLTextAreaElement, rect: TextareaRect): void {
  textarea.style.position = "absolute";
  textarea.style.top = `${rect.y}px`;
  textarea.style.left = `${rect.x}px`;
  textarea.style.width = `${rect.width}px`;
  textarea.style.height = `${rect.height}px`;
  textarea.style.transformOrigin = "top left";
  textarea.style.transform = `rotate(${rect.rotationDegrees}deg)`;
}

function applyTextareaFontStyle(textarea: HTMLTextAreaElement, object: TextObject, node: Konva.Text): void {
  const absScale = node.getAbsoluteScale();
  textarea.style.fontFamily = object.fontFamily;
  textarea.style.fontSize = `${object.fontSize * absScale.y}px`;
  textarea.style.fontWeight = String(object.fontWeight);
  textarea.style.lineHeight = String(object.lineHeight);
  textarea.style.textAlign = object.textAlign;
  textarea.style.color = object.style.fill ?? "#000000";
  textarea.style.background = "transparent";
  textarea.style.border = "1px solid #3b82f6";
  textarea.style.padding = "0";
  textarea.style.margin = "0";
  textarea.style.overflow = "hidden";
  textarea.style.resize = "none";
  textarea.style.outline = "none";
}

function startEditing(node: Konva.Text, object: TextObject, context: NodeContext): void {
  const stage = node.getStage();
  if (!stage) return;
  const container = stage.container();

  node.hide();
  node.getLayer()?.batchDraw();

  // `position: relative` es requisito para que el `position: absolute` del
  // textarea se ubique respecto al container (y no a un ancestro externo
  // fuera del control de este paquete). Idempotente: fijarlo de nuevo en
  // cada edición no tiene costo ni efecto colateral.
  container.style.position = container.style.position || "relative";

  const textarea = document.createElement("textarea");
  textarea.value = object.content;
  applyTextareaRect(textarea, computeTextareaRect(node));
  applyTextareaFontStyle(textarea, object, node);
  container.appendChild(textarea);
  textarea.focus();
  textarea.select();

  // Guarda defensiva: una vez que `commit()`/`cancel()` desmontan el
  // textarea y quitan sus listeners, no hay un camino conocido para que se
  // vuelvan a invocar — se mantiene por seguridad ante una futura
  // reentrancia (ej. un evento sintético disparado dos veces), no por un
  // caso real observado (mismo criterio que otras guardas defensivas del
  // proyecto, ver README de renderer.ts).
  let settled = false;

  function restoreNodeVisibility(): void {
    node.show();
    node.getLayer()?.batchDraw();
  }

  function detachTextarea(): void {
    textarea.removeEventListener("blur", onBlur);
    textarea.removeEventListener("keydown", onKeyDown);
    textarea.remove();
  }

  function commit(): void {
    if (settled) return;
    settled = true;
    const newContent = textarea.value;
    detachTextarea();
    if (newContent === object.content) {
      restoreNodeVisibility();
      return;
    }
    const result = context.dispatch({ type: "updateObjectContent", objectId: object.id, content: newContent });
    if (!result.ok) {
      // El Engine rechazó el cambio (ej. el object ya no existe) — revertir
      // la vista, mismo patrón que `onRejectedTransform` en otras
      // interacciones.
      restoreNodeVisibility();
      context.onRejectedTransform?.();
    }
    // Si el dispatch tuvo éxito, el siguiente `projectChanged` reconstruye
    // el contenido (rebuild completo) y ya trae el node visible de nuevo —
    // no hace falta llamar `restoreNodeVisibility()` aquí.
  }

  function cancel(): void {
    if (settled) return;
    settled = true;
    detachTextarea();
    restoreNodeVisibility();
  }

  function onBlur(): void {
    commit();
  }

  function onKeyDown(evt: KeyboardEvent): void {
    if (evt.key === "Escape") {
      evt.preventDefault();
      cancel();
    } else if (evt.key === "Enter" && !evt.shiftKey) {
      evt.preventDefault();
      commit();
    }
  }

  textarea.addEventListener("blur", onBlur);
  textarea.addEventListener("keydown", onKeyDown);
}
