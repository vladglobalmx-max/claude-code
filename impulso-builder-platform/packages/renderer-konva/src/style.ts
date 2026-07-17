import type Konva from "konva";
import type { BlendMode, Style } from "@impulso/document-schema";

/**
 * El Document Schema llama "normal" al modo de mezcla por defecto (legible,
 * agnóstico de tecnología); el Canvas 2D API (que Konva usa por debajo)
 * espera el string "source-over" para ese mismo valor. El resto de los
 * nombres coinciden 1:1 con `globalCompositeOperation`, así que no
 * necesitan traducción.
 */
export function toCanvasBlendMode(blendMode: BlendMode): GlobalCompositeOperation {
  return blendMode === "normal" ? "source-over" : (blendMode as GlobalCompositeOperation);
}

/**
 * Aplica fill/stroke/strokeWidth/shadow a un nodo que SÍ dibuja relleno o
 * trazo (Rect/Ellipse/Path/Image/Text) — deliberadamente separado de
 * `applyBaseAttrs` porque `Konva.Group` no tiene estas propiedades.
 */
export function applyShapeStyle(node: Konva.Shape, style: Style): void {
  if (style.fill !== undefined) node.fill(style.fill);
  if (style.stroke !== undefined) node.stroke(style.stroke);
  node.strokeWidth(style.strokeWidth);
  if (style.shadow) {
    node.shadowColor(style.shadow.color);
    node.shadowBlur(style.shadow.blur);
    node.shadowOffsetX(style.shadow.offsetX);
    node.shadowOffsetY(style.shadow.offsetY);
  }
}
