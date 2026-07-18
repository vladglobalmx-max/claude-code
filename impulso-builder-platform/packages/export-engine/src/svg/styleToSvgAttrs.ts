import type { Style } from "@impulso/document-schema";
import { escapeXmlAttr } from "./escapeXml.js";

export interface StyleSvgOutput {
  /** Para insertar directamente dentro de la etiqueta `<g ...>` que envuelve el object. */
  presentationAttrs: string;
  /** Elemento `<filter>` a insertar en `<defs>`, solo si `style.shadow` está presente. */
  filterDef?: string;
}

/**
 * `includePaint=false` para `type: "group"` — Konva.Group nunca recibe
 * `applyShapeStyle` (fill/stroke/shadow no significan nada para un
 * contenedor puro en el Renderer actual), solo opacidad y blend mode. Un
 * Group con `style.fill`/`style.shadow` en sus datos los ignora aquí
 * exactamente igual que el Renderer los ignora hoy — no es una omisión,
 * es paridad deliberada (ver ADR-0012).
 */
export function styleToSvgAttrs(style: Style, filterId: string, options: { includePaint: boolean }): StyleSvgOutput {
  const attrs: string[] = [];

  if (options.includePaint) {
    attrs.push(`fill="${escapeXmlAttr(style.fill ?? "none")}"`);
    if (style.stroke !== undefined) attrs.push(`stroke="${escapeXmlAttr(style.stroke)}"`);
    if (style.strokeWidth > 0) attrs.push(`stroke-width="${style.strokeWidth}"`);
  }
  if (style.opacity !== 1) attrs.push(`opacity="${style.opacity}"`);

  const styleDecls: string[] = [];
  if (style.blendMode !== "normal") styleDecls.push(`mix-blend-mode:${style.blendMode}`);

  let filterDef: string | undefined;
  if (options.includePaint && style.shadow) {
    const { color, blur, offsetX, offsetY } = style.shadow;
    const filterElementId = `shadow-${filterId}`;
    // stdDeviation ~= shadowBlur/2 es una aproximación documentada (no una
    // equivalencia exacta) entre el `shadowBlur` de Canvas 2D (que usa el
    // Renderer/Konva) y el desvío estándar Gaussiano de `feDropShadow` —
    // ver README, "Limitaciones de fidelidad".
    filterDef = `<filter id="${filterElementId}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${offsetX}" dy="${offsetY}" stdDeviation="${Math.max(blur / 2, 0)}" flood-color="${escapeXmlAttr(color)}"/></filter>`;
    styleDecls.push(`filter:url(#${filterElementId})`);
  }
  if (styleDecls.length > 0) attrs.push(`style="${styleDecls.join(";")}"`);

  return { presentationAttrs: attrs.join(" "), filterDef };
}
