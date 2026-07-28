import type { TextObject, TextAlign } from "@impulso/document-schema";
import { buildElementMetadata } from "./metadata.js";
import type { CatalogIdFactory } from "./ids.js";

export interface CreateTextObjectOptions {
  ids: CatalogIdFactory;
  now: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  textAlign?: TextAlign;
  lineHeight?: number;
  fill: string;
  role: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Construye un `TextObject` con caja (`size`) siempre presente — sin ella
 * el texto no hace wrap ni se centra (limitación real de
 * `@impulso/document-schema` encontrada durante el piloto, ver
 * `THOREN_PILOT_TEMPLATE_STANDARD.md` §6). `fontWeight`/`textAlign`/
 * `lineHeight` tienen los mismos defaults que el schema (400/"left"/1.2)
 * para no forzar a quien llama a repetirlos cuando coinciden.
 */
export function createTextObject(options: CreateTextObjectOptions): TextObject {
  const { ids, now, content, fontFamily, fontSize, fill, role, name, x, y, width, height } = options;
  return {
    id: ids.objectId(),
    type: "text",
    content,
    fontFamily,
    fontSize,
    fontWeight: options.fontWeight ?? 400,
    textAlign: options.textAlign ?? "left",
    lineHeight: options.lineHeight ?? 1.2,
    size: { width, height },
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill, strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: buildElementMetadata({ now, role, name }),
    pluginData: {},
    customProperties: {},
  };
}

/** Un "lado" de una línea de datos partida en dos colores (ver
 * `createSplitAccentLine`) — cada lado es, en esencia, las mismas opciones
 * que `createTextObject` salvo posición/alineación (que la función deriva). */
export interface SplitAccentLineSide {
  content: string;
  fill: string;
  role: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  /** Ancho de la caja de este lado — no necesariamente igual al del otro lado. */
  width: number;
}

export interface CreateSplitAccentLineOptions {
  ids: CatalogIdFactory;
  now: string;
  /** Centro horizontal (px) alrededor del cual se parte la línea. */
  centerX: number;
  y: number;
  height: number;
  /** Separación total (px) entre el borde derecho de `left` y el borde
   * izquierdo de `right`. */
  gap: number;
  left: SplitAccentLineSide;
  right: SplitAccentLineSide;
}

/**
 * Construye dos `TextObject`s adyacentes que juntos se leen como "una sola
 * línea de datos" (ej. "15%" / "30ml") pero cada uno con su propio color —
 * la solución encontrada en el piloto (Serum Facial Premium) a que
 * `Style.fill` sea un solo color por objeto: no existe forma de colorear
 * una parte de un string distinta a otra dentro del mismo `TextObject`. Ver
 * `THOREN_PILOT_TEMPLATE_STANDARD.md` §5-6 para el razonamiento completo.
 *
 * `left` queda alineado a la derecha justo antes del centro; `right` queda
 * alineado a la izquierda justo después — el mismo patrón geométrico que
 * "% de activo" / "volumen" en Serum, generalizado para cualquier par de
 * valores cortos que deban leerse como una sola línea.
 */
export function createSplitAccentLine(options: CreateSplitAccentLineOptions): [TextObject, TextObject] {
  const { ids, now, centerX, y, height, gap, left, right } = options;

  const leftObject = createTextObject({
    ids,
    now,
    content: left.content,
    fontFamily: left.fontFamily,
    fontSize: left.fontSize,
    fontWeight: left.fontWeight,
    textAlign: "right",
    fill: left.fill,
    role: left.role,
    name: left.name,
    x: centerX - gap / 2 - left.width,
    y,
    width: left.width,
    height,
  });

  const rightObject = createTextObject({
    ids,
    now,
    content: right.content,
    fontFamily: right.fontFamily,
    fontSize: right.fontSize,
    fontWeight: right.fontWeight,
    textAlign: "left",
    fill: right.fill,
    role: right.role,
    name: right.name,
    x: centerX + gap / 2,
    y,
    width: right.width,
    height,
  });

  return [leftObject, rightObject];
}
