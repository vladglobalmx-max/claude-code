import type { Intent } from "../intent.js";
import { resolvePalette, type ArchetypeDefinition, type Recipe } from "../recipe.js";
import { fitFontSize } from "../textMetrics.js";
import { PAGE_SIZE } from "./constants.js";
import { deriveInitials, ringFragments } from "./content.js";
import {
  arrangeRingText,
  buildBackgroundFill,
  buildDocumentDraft,
  buildEllipseOutline,
  buildTextObject,
} from "./helpers.js";

/**
 * Arquetipo "monograma centrado con anillo de texto" — uno de los dos que
 * `THOREN_CREATIVE_ENGINE.md` §5 nombra explícitamente para Elegante.
 *
 * Estructura: un solo elemento dominante (el monograma, grande, centrado)
 * rodeado por un anillo de texto secundario apenas dentro del borde, con
 * una guía circular fina entre ambos — simetría radial, sin marco
 * rectangular, sin texto alineado a un lado. Es la única de las tres
 * composiciones de esta receta con simetría circular.
 */
export const ID = "monograma-anillo";

const CENTER = PAGE_SIZE / 2;
const RING_RADIUS = CENTER * 0.83;
const RING_FONT_SIZE = 13;
const GUIDE_GAP = 6;
const MONOGRAM_BASE_FONT_SIZE = 48;
const MONOGRAM_MIN_FONT_SIZE = 26;
const MONOGRAM_MAX_WIDTH = CENTER; // la mitad de la página — deja margen generoso dentro de la guía

function ringTextHeight(): number {
  return RING_FONT_SIZE * 1.2;
}

function build(intent: Intent, recipe: Recipe, now: string) {
  const palette = resolvePalette(recipe, intent);
  const guideDiameter = (RING_RADIUS - ringTextHeight() - GUIDE_GAP) * 2;

  const background = buildBackgroundFill(PAGE_SIZE, palette.background, now);

  const guide = buildEllipseOutline({
    centerX: CENTER,
    centerY: CENTER,
    diameter: guideDiameter,
    stroke: palette.accent,
    strokeWidth: 1.5,
    role: "ornamento-anillo-guia",
    now,
  });

  const ring = arrangeRingText({
    centerX: CENTER,
    centerY: CENTER,
    radius: RING_RADIUS,
    fragments: ringFragments(intent),
    fontFamily: recipe.typography.secondary.fontFamily,
    fontWeight: recipe.typography.secondary.fontWeight,
    fontSize: RING_FONT_SIZE,
    fill: palette.accent,
    role: "anillo-texto",
    now,
  });

  const monogramContent = deriveInitials(intent);
  const monogramFontSize = fitFontSize(
    monogramContent,
    MONOGRAM_MAX_WIDTH,
    MONOGRAM_BASE_FONT_SIZE,
    MONOGRAM_MIN_FONT_SIZE,
  );
  const monogramWidth = MONOGRAM_MAX_WIDTH;
  const monogramHeight = monogramFontSize * 1.2;
  const monogram = buildTextObject({
    content: monogramContent,
    fontFamily: recipe.typography.primary.fontFamily,
    fontWeight: recipe.typography.primary.fontWeight,
    fontSize: monogramFontSize,
    fill: palette.ink,
    textAlign: "center",
    x: CENTER - monogramWidth / 2,
    y: CENTER - monogramHeight / 2,
    width: monogramWidth,
    height: monogramHeight,
    role: "monograma",
    now,
  });

  return buildDocumentDraft(PAGE_SIZE, [background, guide, ...ring, monogram], now);
}

export const monogramaAnillo: ArchetypeDefinition = { id: ID, build };
