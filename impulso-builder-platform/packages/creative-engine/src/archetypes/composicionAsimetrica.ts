import type { Intent } from "../intent.js";
import { resolvePalette, type ArchetypeDefinition, type Recipe } from "../recipe.js";
import { fitFontSize } from "../textMetrics.js";
import { PAGE_SIZE } from "./constants.js";
import { primaryContent } from "./content.js";
import { buildBackgroundFill, buildDocumentDraft, buildRule, buildTextObject } from "./helpers.js";

/**
 * Arquetipo "composición asimétrica apilada" — el tercer arquetipo que
 * `THOREN_CREATIVE_ENGINE.md` §19 exige ("cada receta debe definir mínimo
 * tres arquetipos válidos"), sin nombre propio en §5 pero coherente con
 * los principios de Elegante (espaciado generoso, un filete simple, un
 * solo elemento dominante).
 *
 * Estructura: sin marco de ningún tipo (ni círculo ni rectángulo — a
 * diferencia de A y B), texto alineado a la izquierda en vez de centrado,
 * un filete simple corto (no un contorno cerrado) como único divisor. Es
 * la única de las tres sin simetría — el espacio negativo a la derecha es
 * deliberado, no un descuido.
 */
export const ID = "composicion-asimetrica";

const LEFT_MARGIN = PAGE_SIZE * 0.14;
const CONTENT_WIDTH = PAGE_SIZE * 0.72;
const PRIMARY_Y = PAGE_SIZE * 0.32;
const PRIMARY_BASE_FONT_SIZE = 28;
const PRIMARY_MIN_FONT_SIZE = 15;
const RULE_WIDTH = PAGE_SIZE * 0.28;
const RULE_THICKNESS = 2;
const RULE_GAP = 14;
const SECONDARY_FONT_SIZE = 13;
const SECONDARY_GAP = 10;

function build(intent: Intent, recipe: Recipe, now: string) {
  const palette = resolvePalette(recipe, intent);
  const background = buildBackgroundFill(PAGE_SIZE, palette.background, now);

  const primary = primaryContent(intent);
  const primaryFontSize = fitFontSize(primary, CONTENT_WIDTH, PRIMARY_BASE_FONT_SIZE, PRIMARY_MIN_FONT_SIZE);
  const primaryHeight = primaryFontSize * 1.2;

  const primaryText = buildTextObject({
    content: primary,
    fontFamily: recipe.typography.primary.fontFamily,
    fontWeight: recipe.typography.primary.fontWeight,
    fontSize: primaryFontSize,
    fill: palette.ink,
    textAlign: "left",
    x: LEFT_MARGIN,
    y: PRIMARY_Y,
    width: CONTENT_WIDTH,
    height: primaryHeight,
    role: "nombre",
    now,
  });

  const ruleY = PRIMARY_Y + primaryHeight + RULE_GAP;
  const rule = buildRule({
    x: LEFT_MARGIN,
    y: ruleY,
    width: RULE_WIDTH,
    thickness: RULE_THICKNESS,
    color: palette.accent,
    role: "filete",
    now,
  });

  const objects = [background, primaryText, rule];

  if (intent.date) {
    const secondaryText = buildTextObject({
      content: intent.date,
      fontFamily: recipe.typography.secondary.fontFamily,
      fontWeight: recipe.typography.secondary.fontWeight,
      fontSize: SECONDARY_FONT_SIZE,
      fill: palette.accent,
      textAlign: "left",
      x: LEFT_MARGIN,
      y: ruleY + RULE_THICKNESS + SECONDARY_GAP,
      width: CONTENT_WIDTH,
      height: SECONDARY_FONT_SIZE * 1.2,
      role: "fecha",
      now,
    });
    objects.push(secondaryText);
  }

  return buildDocumentDraft(PAGE_SIZE, objects, now);
}

export const composicionAsimetrica: ArchetypeDefinition = { id: ID, build };
