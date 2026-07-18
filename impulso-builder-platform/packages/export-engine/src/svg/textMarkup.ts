import type { TextObject } from "@impulso/document-schema";
import { escapeXmlText, escapeXmlAttr } from "./escapeXml.js";

/**
 * Aproximación de ascenso tipográfico (fracción del `fontSize` desde la
 * línea superior hasta la línea base) — no hay una única constante exacta
 * válida para cualquier fuente, así que se documenta como una aproximación
 * (ver README, "Limitaciones de fidelidad"), no una equivalencia exacta con
 * las métricas reales que usa Konva.Text internamente.
 */
const ASCENT_RATIO = 0.8;

/**
 * `content` se preserva como `<text>` real (editable/seleccionable fuera de
 * Impulso), respetando únicamente los saltos de línea EXPLÍCITOS de
 * `content` — el ajuste automático de línea al ancho de `size.width` (si
 * el TextObject tiene una caja de wrap) NO se reproduce: requeriría medir
 * texto con las métricas exactas de la fuente, algo que un visor de SVG
 * ajeno a Impulso no puede garantizar igual. Ver README/ADR-0012.
 */
export function textMarkup(object: TextObject): string {
  const lines = object.content.split("\n");
  const lineHeightPx = object.fontSize * object.lineHeight;
  const boxWidth = object.size?.width;

  let anchorX = 0;
  let textAnchor = "start";
  if (boxWidth !== undefined) {
    if (object.textAlign === "center") {
      anchorX = boxWidth / 2;
      textAnchor = "middle";
    } else if (object.textAlign === "right") {
      anchorX = boxWidth;
      textAnchor = "end";
    }
  }

  const firstBaselineY = object.fontSize * ASCENT_RATIO;
  const tspans = lines
    .map((line, index) => {
      const positionAttr = index === 0 ? `y="${firstBaselineY}"` : `dy="${lineHeightPx}"`;
      return `<tspan x="${anchorX}" ${positionAttr}>${escapeXmlText(line)}</tspan>`;
    })
    .join("");

  return `<text font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${object.fontSize}" font-weight="${object.fontWeight}" text-anchor="${textAnchor}">${tspans}</text>`;
}
