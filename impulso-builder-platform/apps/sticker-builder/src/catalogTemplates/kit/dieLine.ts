import type { SceneObject } from "@impulso/document-schema";
import { toPixels } from "@impulso/document-schema";
import { createEllipse } from "./graphicElements.js";
import type { CatalogIdFactory } from "./ids.js";

export type DieLineShape = "circle" | "square" | "rectangle" | "custom";

export interface CreateDieLineObjectsOptions {
  ids: CatalogIdFactory;
  now: string;
  shape: DieLineShape;
  widthMm: number;
  heightMm: number;
}

/**
 * Devuelve los `SceneObject`s de línea de corte para `shape` — un
 * `EllipseObject` con `metadata.role: "die-line"` para `"circle"`, o un
 * arreglo vacío para `"square"`/`"rectangle"`/`"custom"` (el troquel de
 * esas formas coincide con el borde de la página; no requiere un objeto
 * propio). Este es exactamente el criterio que ya usaba
 * `createProjectFromSize` (`projectPresets.ts`) — extraído aquí para que
 * los templates del catálogo con troquel circular (la mayoría, según
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.4) lo reutilicen en vez de
 * reconstruirlo cada vez.
 *
 * Formas personalizadas (rombo, faja con muescas, corazón...) NO están
 * cubiertas por este helper — requieren su propia geometría de troquel,
 * ver `THOREN_PRODUCTION_INFRASTRUCTURE.md` §8 (qué sigue requiriendo
 * intervención manual).
 */
export function createDieLineObjects(options: CreateDieLineObjectsOptions): SceneObject[] {
  if (options.shape !== "circle") return [];

  return [
    createEllipse({
      ids: options.ids,
      now: options.now,
      x: 0,
      y: 0,
      width: toPixels(options.widthMm, "mm"),
      height: toPixels(options.heightMm, "mm"),
      fill: "#ffffff",
      stroke: "#cccccc",
      strokeWidth: 0.5,
      role: "die-line",
      name: "Línea de corte",
    }),
  ];
}
