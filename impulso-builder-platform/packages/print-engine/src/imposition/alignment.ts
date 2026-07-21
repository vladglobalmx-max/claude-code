import type { ImpositionAlignment } from "../types.js";

const ALIGNMENT_PARTS: Record<ImpositionAlignment, { h: "left" | "center" | "right"; v: "top" | "center" | "bottom" }> = {
  "top-left": { h: "left", v: "top" },
  "top-center": { h: "center", v: "top" },
  "top-right": { h: "right", v: "top" },
  "center-left": { h: "left", v: "center" },
  center: { h: "center", v: "center" },
  "center-right": { h: "right", v: "center" },
  "bottom-left": { h: "left", v: "bottom" },
  "bottom-center": { h: "center", v: "bottom" },
  "bottom-right": { h: "right", v: "bottom" },
};

/**
 * Offset (Fase 9.4, sección 11) para desplazar el grid COMPLETO dentro
 * del área útil cuando no la ocupa por completo — nunca altera gaps ni
 * escala, solo la posición inicial del grid. `Math.max(0, ...)` es una
 * red de seguridad defensiva: `computeImpositionLayout` ya garantiza
 * `gridWidth/Height <= usefulWidth/Height` antes de llegar aquí (vía
 * `computeGridCapacity`), así que un valor negativo nunca debería
 * producirse en la práctica.
 */
export function computeAlignmentOffset(alignment: ImpositionAlignment, usefulWidth: number, usefulHeight: number, gridWidth: number, gridHeight: number): { x: number; y: number } {
  const { h, v } = ALIGNMENT_PARTS[alignment];
  const x = h === "left" ? 0 : h === "center" ? Math.max(0, (usefulWidth - gridWidth) / 2) : Math.max(0, usefulWidth - gridWidth);
  const y = v === "top" ? 0 : v === "center" ? Math.max(0, (usefulHeight - gridHeight) / 2) : Math.max(0, usefulHeight - gridHeight);
  return { x, y };
}
