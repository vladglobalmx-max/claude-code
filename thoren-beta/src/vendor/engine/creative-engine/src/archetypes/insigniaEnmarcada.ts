import type { Intent } from "../intent.js";
import { resolvePalette, type ArchetypeDefinition, type Recipe } from "../recipe.js";
import { fitFontSize } from "../textMetrics.js";
import { PAGE_SIZE } from "./constants.js";
import { primaryContent } from "./content.js";
import { buildBackgroundFill, buildDocumentDraft, buildRectangleOutline, buildTextObject } from "./helpers.js";

/**
 * Arquetipo "insignia enmarcada por línea fina doble" — el segundo de los
 * dos que `THOREN_CREATIVE_ENGINE.md` §5 nombra explícitamente para
 * Elegante.
 *
 * Estructura: un marco RECTANGULAR de doble filete (a propósito distinto
 * del círculo del Arquetipo A) conteniendo un bloque de texto centrado —
 * simetría rectangular, jerarquía por apilado vertical (nombre grande,
 * fecha discreta debajo) en vez de la simetría radial del monograma.
 */
export const ID = "insignia-doble-filete";

const CENTER = PAGE_SIZE / 2;
const OUTER_FRAME_SIZE = PAGE_SIZE * 0.82;
const INNER_FRAME_SIZE = PAGE_SIZE * 0.74;
const CONTENT_MARGIN = 20;
const PRIMARY_BASE_FONT_SIZE = 26;
const PRIMARY_MIN_FONT_SIZE = 14;
const SECONDARY_FONT_SIZE = 13;
const STACK_GAP = 10;

function frameOrigin(size: number): number {
  return (PAGE_SIZE - size) / 2;
}

function build(intent: Intent, recipe: Recipe, now: string) {
  const palette = resolvePalette(recipe, intent);
  const maxTextWidth = INNER_FRAME_SIZE - CONTENT_MARGIN * 2;

  const background = buildBackgroundFill(PAGE_SIZE, palette.background, now);

  const outerFrame = buildRectangleOutline({
    x: frameOrigin(OUTER_FRAME_SIZE),
    y: frameOrigin(OUTER_FRAME_SIZE),
    width: OUTER_FRAME_SIZE,
    height: OUTER_FRAME_SIZE,
    stroke: palette.accent,
    strokeWidth: 2,
    role: "marco-exterior",
    now,
  });
  const innerFrame = buildRectangleOutline({
    x: frameOrigin(INNER_FRAME_SIZE),
    y: frameOrigin(INNER_FRAME_SIZE),
    width: INNER_FRAME_SIZE,
    height: INNER_FRAME_SIZE,
    stroke: palette.accent,
    strokeWidth: 1,
    role: "marco-interior",
    now,
  });

  const primary = primaryContent(intent);
  const primaryFontSize = fitFontSize(primary, maxTextWidth, PRIMARY_BASE_FONT_SIZE, PRIMARY_MIN_FONT_SIZE);
  const primaryHeight = primaryFontSize * 1.2;
  const secondaryHeight = SECONDARY_FONT_SIZE * 1.2;
  const hasDate = Boolean(intent.date);
  const stackHeight = hasDate ? primaryHeight + STACK_GAP + secondaryHeight : primaryHeight;
  const stackTop = CENTER - stackHeight / 2;

  const primaryText = buildTextObject({
    content: primary,
    fontFamily: recipe.typography.primary.fontFamily,
    fontWeight: recipe.typography.primary.fontWeight,
    fontSize: primaryFontSize,
    fill: palette.ink,
    textAlign: "center",
    x: CENTER - maxTextWidth / 2,
    y: stackTop,
    width: maxTextWidth,
    height: primaryHeight,
    role: "nombre",
    now,
  });

  const objects = [background, outerFrame, innerFrame, primaryText];

  if (intent.date) {
    const secondaryText = buildTextObject({
      content: intent.date,
      fontFamily: recipe.typography.secondary.fontFamily,
      fontWeight: recipe.typography.secondary.fontWeight,
      fontSize: SECONDARY_FONT_SIZE,
      fill: palette.accent,
      textAlign: "center",
      x: CENTER - maxTextWidth / 2,
      y: stackTop + primaryHeight + STACK_GAP,
      width: maxTextWidth,
      height: secondaryHeight,
      role: "fecha",
      now,
    });
    objects.push(secondaryText);
  }

  return buildDocumentDraft(PAGE_SIZE, objects, now);
}

export const insigniaEnmarcada: ArchetypeDefinition = { id: ID, build };
