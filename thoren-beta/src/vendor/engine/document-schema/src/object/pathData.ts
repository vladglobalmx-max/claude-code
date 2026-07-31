import type { PathSegment } from "./path.js";

/**
 * Serializa segmentos de `PathObject` a sintaxis de `d` de SVG path.
 * Nace en `@impulso/document-schema` (no en `@impulso/renderer-konva`, donde
 * vivía originalmente hasta Epic 3) porque dos consumidores independientes
 * la necesitan por la misma razón — Konva.Path también acepta `d` de SVG
 * como su prop `data` — y ninguno de los dos debería depender del otro
 * para obtenerla (ver ADR-0012). Es pura: opera solo sobre `PathSegment[]`,
 * sin ninguna dependencia de una librería de render.
 */
export function segmentsToSvgPathData(segments: readonly PathSegment[], closed: boolean): string {
  const commands = segments.map((segment) => {
    switch (segment.type) {
      case "moveTo":
        return `M ${segment.point.x} ${segment.point.y}`;
      case "lineTo":
        return `L ${segment.point.x} ${segment.point.y}`;
      case "quadraticCurveTo":
        return `Q ${segment.control.x} ${segment.control.y} ${segment.point.x} ${segment.point.y}`;
      case "cubicCurveTo":
        return `C ${segment.control1.x} ${segment.control1.y} ${segment.control2.x} ${segment.control2.y} ${segment.point.x} ${segment.point.y}`;
      case "close":
        return "Z";
    }
  });

  const alreadyClosed = segments.some((segment) => segment.type === "close");
  if (closed && !alreadyClosed) {
    commands.push("Z");
  }
  return commands.join(" ");
}
