import { nextDocumentId, nextLayerId, nextObjectId, nextPageId } from "../ids.js";
import { estimateTextWidth } from "../textMetrics.js";
import type { DocumentDraft } from "../recipe.js";

/**
 * Piezas de construcción compartidas por los tres arquetipos de la receta
 * Elegante-Boda (Fase 2). Cada arquetipo llama a estas funciones y las
 * combina de forma distinta — la variedad estructural vive en qué objetos
 * elige cada arquetipo y cómo los distribuye, nunca aquí.
 */

function metadata(now: string, role: string) {
  return { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now, role };
}

export function buildBackgroundFill(pageSize: number, color: string, now: string): DocumentDraft {
  return {
    id: nextObjectId(),
    type: "rectangle",
    size: { width: pageSize, height: pageSize },
    cornerRadius: 0,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: color, strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: metadata(now, "background"),
    pluginData: {},
    customProperties: {},
  };
}

export interface TextSpec {
  content: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  fill: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  role: string;
  now: string;
}

export function buildTextObject(spec: TextSpec): DocumentDraft {
  return {
    id: nextObjectId(),
    type: "text",
    content: spec.content,
    fontFamily: spec.fontFamily,
    fontSize: spec.fontSize,
    fontWeight: spec.fontWeight,
    textAlign: spec.textAlign ?? "center",
    lineHeight: spec.lineHeight ?? 1.2,
    size: { width: spec.width, height: spec.height },
    transform: { x: spec.x, y: spec.y, rotation: spec.rotation ?? 0, scaleX: 1, scaleY: 1 },
    style: { fill: spec.fill, strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: metadata(spec.now, spec.role),
    pluginData: {},
    customProperties: {},
  };
}

export interface OutlineEllipseSpec {
  centerX: number;
  centerY: number;
  diameter: number;
  stroke: string;
  strokeWidth: number;
  role: string;
  now: string;
}

/** Círculo de solo contorno (sin `fill`) — un "filete" circular, nunca un disco relleno. */
export function buildEllipseOutline(spec: OutlineEllipseSpec): DocumentDraft {
  return {
    id: nextObjectId(),
    type: "ellipse",
    size: { width: spec.diameter, height: spec.diameter },
    transform: {
      x: spec.centerX - spec.diameter / 2,
      y: spec.centerY - spec.diameter / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    style: { stroke: spec.stroke, strokeWidth: spec.strokeWidth, opacity: 1, blendMode: "normal" },
    metadata: metadata(spec.now, spec.role),
    pluginData: {},
    customProperties: {},
  };
}

export interface OutlineRectangleSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  role: string;
  now: string;
}

/** Rectángulo de solo contorno (sin `fill`) — el "filete" de una insignia enmarcada. */
export function buildRectangleOutline(spec: OutlineRectangleSpec): DocumentDraft {
  return {
    id: nextObjectId(),
    type: "rectangle",
    size: { width: spec.width, height: spec.height },
    cornerRadius: 0,
    transform: { x: spec.x, y: spec.y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { stroke: spec.stroke, strokeWidth: spec.strokeWidth, opacity: 1, blendMode: "normal" },
    metadata: metadata(spec.now, spec.role),
    pluginData: {},
    customProperties: {},
  };
}

export interface RuleSpec {
  x: number;
  y: number;
  width: number;
  thickness: number;
  color: string;
  role: string;
  now: string;
}

/** Filete simple relleno (una línea fina) — distinto del contorno: aquí el color pinta el trazo mismo. */
export function buildRule(spec: RuleSpec): DocumentDraft {
  return {
    id: nextObjectId(),
    type: "rectangle",
    size: { width: spec.width, height: spec.thickness },
    cornerRadius: 0,
    transform: { x: spec.x, y: spec.y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: spec.color, strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: metadata(spec.now, spec.role),
    pluginData: {},
    customProperties: {},
  };
}

/**
 * Documento completo alrededor de una lista de objetos ya construidos —
 * idéntico andamiaje (una página, una capa) que usan los tres arquetipos
 * de esta receta; lo único que varía entre ellos es qué objetos pasan
 * aquí. Igual que en Fase 1 (`componer.ts`), se devuelve un literal crudo
 * para validar con `DocumentSchema.parse` en el llamador, nunca casteado.
 */
export function buildDocumentDraft(pageSize: number, objects: readonly DocumentDraft[], now: string): DocumentDraft {
  const metadata = { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now };
  return {
    id: nextDocumentId(),
    schemaVersion: 1,
    documentVersion: 1,
    pages: [
      {
        id: nextPageId(),
        size: { width: pageSize, height: pageSize },
        unit: "px",
        layers: [
          {
            id: nextLayerId(),
            objects,
            metadata,
            pluginData: {},
            customProperties: {},
          },
        ],
        grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
        metadata,
        pluginData: {},
        customProperties: {},
      },
    ],
    assets: [],
    metadata,
    history: { entries: [] },
    pluginData: {},
    customProperties: {},
  };
}

export interface ArrangeRingTextSpec {
  centerX: number;
  centerY: number;
  radius: number;
  fragments: readonly string[];
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  fill: string;
  role: string;
  now: string;
  /** Grados, convención de canvas (0° = 3 en punto, sentido horario). Default -90 (12 en punto). */
  startAngleDeg?: number;
}

/**
 * Aproxima un anillo de texto perimetral distribuyendo `fragments` en
 * ángulos igualmente espaciados alrededor de un círculo, cada uno como un
 * `TextObject` recto rotado para quedar tangente al círculo — no es texto
 * curvado letra por letra (`@impulso/document-schema` no lo soporta, un
 * `TextObject` es siempre una caja recta).
 *
 * Reimplementación deliberada de la misma técnica que
 * `apps/sticker-builder/src/catalogTemplates/kit/ringText.ts` ya usa para
 * el catálogo de plantillas — no se importa directamente porque vive en una
 * app, no en un paquete, y `THOREN_TECHNICAL_ARCHITECTURE.md` §4 prohíbe
 * que el Motor Creativo dependa de la Interfaz. Promover esa utilidad a un
 * paquete compartido es una simplificación válida para una fase futura,
 * pero no para esta (evidencia insuficiente todavía de que haga falta un
 * tercer consumidor).
 *
 * Derivación geométrica (pivote de rotación = `transform.x,y`, la esquina
 * superior-izquierda de la caja de texto — ver
 * `@impulso/export-engine/src/svg/transformToSvgAttr.ts`): para que el
 * punto superior-centro de la caja caiga sobre el círculo en el ángulo φ,
 * con la caja rotada φ+90° (tangente, sentido horario):
 *   x = centerX + radius·cos(φ) + (width/2)·sin(φ)
 *   y = centerY + radius·sin(φ) − (width/2)·cos(φ)
 */
export function arrangeRingText(spec: ArrangeRingTextSpec): DocumentDraft[] {
  const startAngleDeg = spec.startAngleDeg ?? -90;
  const stepDeg = 360 / spec.fragments.length;

  return spec.fragments.map((content, index) => {
    const phiDeg = startAngleDeg + index * stepDeg;
    const phiRad = (phiDeg * Math.PI) / 180;
    const width = estimateTextWidth(content, spec.fontSize, 0.62);
    const height = spec.fontSize * 1.2;
    const rotation = phiDeg + 90;
    const x = spec.centerX + spec.radius * Math.cos(phiRad) + (width / 2) * Math.sin(phiRad);
    const y = spec.centerY + spec.radius * Math.sin(phiRad) - (width / 2) * Math.cos(phiRad);

    return buildTextObject({
      content,
      fontFamily: spec.fontFamily,
      fontWeight: spec.fontWeight,
      fontSize: spec.fontSize,
      fill: spec.fill,
      textAlign: "center",
      x,
      y,
      width,
      height,
      rotation,
      role: spec.role,
      now: spec.now,
    });
  });
}
