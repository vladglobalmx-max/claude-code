import { DocumentSchema, type Document } from "@impulso/document-schema";
import { nextDocumentId, nextLayerId, nextObjectId, nextPageId } from "./ids.js";

/**
 * Fase 1 del Motor Creativo (docs/product/THOREN_CREATIVE_ENGINE.md,
 * docs/product/THOREN_IMPLEMENTATION_PLAN.md — "Núcleo del Documento").
 *
 * Deliberadamente NO sabe nada de recetas, ocasiones ni interpretación de
 * intención (eso llega en la Fase 2) — es solo el contrato mínimo
 * "contenido + arquetipo geométrico + tipografía + color -> Document
 * válido", construido sobre las primitivas ya existentes de
 * @impulso/document-schema, nunca modificándolas.
 */

export type Archetype = "circle" | "rectangle";

export interface ComponerParams {
  /** El texto real del usuario — nunca un placeholder. */
  content: string;
  fontFamily: string;
  fontSize: number;
  /** Color del texto (fill del TextObject). */
  textColor: string;
  /** Color de la forma de fondo (fill del RectangleObject/EllipseObject). */
  shapeColor: string;
  archetype: Archetype;
  fontWeight?: number;
  lineHeight?: number;
  /** Página cuadrada por defecto — suficiente para la Fase 1. */
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 240;
const DEFAULT_FONT_WEIGHT = 600;
const DEFAULT_LINE_HEIGHT = 1.2;
/** La forma ocupa el 90% de la página, dejando un margen visible parejo. */
const SHAPE_TO_PAGE_RATIO = 0.9;
/** La caja del texto ocupa el 80% de la forma, para no tocar su borde. */
const TEXT_TO_SHAPE_RATIO = 0.8;

/**
 * `Transform.x/y` es la esquina superior izquierda a nivel de schema para
 * TODO tipo de object, Ellipse incluido — confirmado leyendo
 * @impulso/export-engine/src/svg/transformToSvgAttr.ts (`anchor = x +
 * width/2` solo tiene sentido si `x` ya es la esquina, no el centro; ese
 * cálculo existe para que el pivote de rotación del SVG coincida con el
 * de Konva, que sí posiciona su nodo por el centro — un detalle interno
 * del renderer, no del Document Schema). Por eso el círculo y el
 * rectángulo comparten exactamente la misma fórmula aquí.
 */
function shapeTransform(pageSize: number, shapeSize: number): { x: number; y: number } {
  const topLeft = (pageSize - shapeSize) / 2;
  return { x: topLeft, y: topLeft };
}

export function componer(params: ComponerParams): Document {
  if (params.content.trim().length === 0) {
    throw new Error("componer(): content no puede estar vacío — el Motor Creativo nunca compone sobre contenido ausente.");
  }

  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const fontWeight = params.fontWeight ?? DEFAULT_FONT_WEIGHT;
  const lineHeight = params.lineHeight ?? DEFAULT_LINE_HEIGHT;

  const shapeSize = pageSize * SHAPE_TO_PAGE_RATIO;
  const { x: shapeX, y: shapeY } = shapeTransform(pageSize, shapeSize);

  const textBoxWidth = shapeSize * TEXT_TO_SHAPE_RATIO;
  const textBoxHeight = params.fontSize * lineHeight;
  // El TextObject siempre se posiciona por su esquina superior izquierda,
  // sin importar el arquetipo de la forma de fondo — solo la forma varía.
  const textX = pageSize / 2 - textBoxWidth / 2;
  const textY = pageSize / 2 - textBoxHeight / 2;

  const now = new Date().toISOString();
  const baseMetadata = { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now };

  const shapeObject =
    params.archetype === "circle"
      ? {
          id: nextObjectId(),
          type: "ellipse" as const,
          size: { width: shapeSize, height: shapeSize },
          transform: { x: shapeX, y: shapeY, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { fill: params.shapeColor, strokeWidth: 0, opacity: 1, blendMode: "normal" as const },
          metadata: { ...baseMetadata, role: "background-shape" },
          pluginData: {},
          customProperties: {},
        }
      : {
          id: nextObjectId(),
          type: "rectangle" as const,
          size: { width: shapeSize, height: shapeSize },
          cornerRadius: 0,
          transform: { x: shapeX, y: shapeY, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { fill: params.shapeColor, strokeWidth: 0, opacity: 1, blendMode: "normal" as const },
          metadata: { ...baseMetadata, role: "background-shape" },
          pluginData: {},
          customProperties: {},
        };

  const textObject = {
    id: nextObjectId(),
    type: "text" as const,
    content: params.content,
    fontFamily: params.fontFamily,
    fontSize: params.fontSize,
    fontWeight,
    textAlign: "center" as const,
    lineHeight,
    size: { width: textBoxWidth, height: textBoxHeight },
    transform: { x: textX, y: textY, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: params.textColor, strokeWidth: 0, opacity: 1, blendMode: "normal" as const },
    metadata: { ...baseMetadata, role: "content" },
    pluginData: {},
    customProperties: {},
  };

  const raw = {
    id: nextDocumentId(),
    schemaVersion: 1,
    documentVersion: 1,
    pages: [
      {
        id: nextPageId(),
        size: { width: pageSize, height: pageSize },
        unit: "px" as const,
        layers: [
          {
            id: nextLayerId(),
            objects: [shapeObject, textObject],
            metadata: baseMetadata,
            pluginData: {},
            customProperties: {},
          },
        ],
        grid: { visible: false, snapEnabled: false, size: 10, type: "lines" as const },
        metadata: baseMetadata,
        pluginData: {},
        customProperties: {},
      },
    ],
    assets: [],
    metadata: baseMetadata,
    history: { entries: [] },
    pluginData: {},
    customProperties: {},
  };

  // Validar con el propio schema (en vez de solo castear) — cualquier
  // error de forma se detecta aquí, no en el Filtro de calidad ni en el
  // Motor de Exportación.
  return DocumentSchema.parse(raw);
}
