import type { ResizeHandle } from "@impulso/engine";

/**
 * Cursor CSS por handle, en la orientación NOMINAL (sin rotación) del
 * object. No rota el cursor cuando el object está rotado — hacerlo bien
 * requeriría generar un cursor SVG a medida por cada ángulo, y no hay
 * evidencia de que la ausencia de eso sea un problema real hoy (ver
 * ADR-0008, "Riesgos").
 */
const CURSOR_BY_HANDLE: Record<ResizeHandle, string> = {
  "top-left": "nwse-resize",
  "bottom-right": "nwse-resize",
  "top-right": "nesw-resize",
  "bottom-left": "nesw-resize",
  top: "ns-resize",
  bottom: "ns-resize",
  left: "ew-resize",
  right: "ew-resize",
};

export function cursorForHandle(handle: ResizeHandle): string {
  return CURSOR_BY_HANDLE[handle];
}

export const ROTATE_CURSOR = "grab";
export const DEFAULT_CURSOR = "default";
