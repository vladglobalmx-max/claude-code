import type { RectangleObject, EllipseObject } from "@impulso/document-schema";
import { buildElementMetadata } from "./metadata.js";
import type { CatalogIdFactory } from "./ids.js";

export interface CreateRectangleOptions {
  ids: CatalogIdFactory;
  now: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
  role?: string;
  name?: string;
}

export function createRectangle(options: CreateRectangleOptions): RectangleObject {
  const { ids, now, x, y, width, height } = options;
  return {
    id: ids.objectId(),
    type: "rectangle",
    size: { width, height },
    cornerRadius: options.cornerRadius ?? 0,
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: {
      fill: options.fill,
      stroke: options.stroke,
      strokeWidth: options.strokeWidth ?? 0,
      opacity: options.opacity ?? 1,
      blendMode: "normal",
    },
    metadata: buildElementMetadata({ now, role: options.role, name: options.name }),
    pluginData: {},
    customProperties: {},
  };
}

export interface CreateEllipseOptions {
  ids: CatalogIdFactory;
  now: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  role?: string;
  name?: string;
}

export function createEllipse(options: CreateEllipseOptions): EllipseObject {
  const { ids, now, x, y, width, height } = options;
  return {
    id: ids.objectId(),
    type: "ellipse",
    size: { width, height },
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: {
      fill: options.fill,
      stroke: options.stroke,
      strokeWidth: options.strokeWidth ?? 0,
      opacity: options.opacity ?? 1,
      blendMode: "normal",
    },
    metadata: buildElementMetadata({ now, role: options.role, name: options.name }),
    pluginData: {},
    customProperties: {},
  };
}

export interface CreateDividerLineOptions {
  ids: CatalogIdFactory;
  now: string;
  /** Centro horizontal (px) sobre el que se centra la línea. */
  centerX: number;
  y: number;
  width: number;
  thickness?: number;
  color: string;
  opacity?: number;
  role?: string;
  name?: string;
}

/**
 * Línea divisoria fina — el único elemento gráfico (aparte de tipografía y
 * troquel) que aparece en templates de familia Lujo Silencioso, y que
 * también reaparece en otras familias del catálogo (ver
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.4). Se centra horizontalmente sobre
 * `centerX` — el mismo cálculo (`centerX - width/2`) que antes se repetía
 * a mano en `serumFacialPremium.ts`.
 */
export function createDividerLine(options: CreateDividerLineOptions): RectangleObject {
  const { ids, now, centerX, y, width } = options;
  return createRectangle({
    ids,
    now,
    x: centerX - width / 2,
    y,
    width,
    height: options.thickness ?? 1,
    fill: options.color,
    opacity: options.opacity ?? 1,
    role: options.role ?? "divider",
    name: options.name ?? "Línea divisoria",
  });
}
