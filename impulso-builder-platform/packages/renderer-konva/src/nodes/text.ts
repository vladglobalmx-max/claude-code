import Konva from "konva";
import type { TextObject } from "@impulso/document-schema";
import { applyBaseAttrs } from "../baseAttrs.js";
import { applyShapeStyle } from "../style.js";
import type { NodeContext } from "../types.js";

/**
 * Konva.Text no tiene un concepto de peso numérico de fuente (100-900,
 * como el Document Schema) — solo `fontStyle: "normal" | "bold" | ...`.
 * Se aproxima con un umbral (>=700 = "bold"); es una simplificación
 * documentada, no una limitación del Document Schema.
 */
function toKonvaFontStyle(fontWeight: number): string {
  return fontWeight >= 700 ? "bold" : "normal";
}

export function createTextNode(object: TextObject, context: NodeContext): Konva.Text {
  const node = new Konva.Text({
    text: object.content,
    fontFamily: object.fontFamily,
    fontSize: object.fontSize,
    fontStyle: toKonvaFontStyle(object.fontWeight),
    align: object.textAlign,
    lineHeight: object.lineHeight,
    width: object.size?.width,
    height: object.size?.height,
  });
  applyBaseAttrs(node, object, context);
  applyShapeStyle(node, object.style); // `fill` es el color del texto en Konva.Text
  return node;
}
