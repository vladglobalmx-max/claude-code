import { toPixels, type Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createTextObject } from "./kit/textObjects.js";
import { createDividerLine } from "./kit/graphicElements.js";
import { stackVertically, textLineHeight } from "./kit/layout.js";

const WIDTH_MM = 75;
const HEIGHT_MM = 30;
const FONT_FAMILY = "Work Sans";
/** Misma paleta del Serum Facial Premium, reutilizada de forma intencional
 * (`TEMPLATE_BATCH_05.md`, Template 23) — ambos templates comparten
 * familia de lenguaje visual (Lujo Silencioso) y esa consistencia de
 * paleta es, según el propio batch, "la prueba de que el sistema funciona
 * across categorías distintas". */
const COLOR_CARBON = "#23282B";

export interface CreateNeutralMinimalLabelProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Etiqueta Neutral Minimalista" (catálogo
 * 7.1, `TEMPLATE_BATCH_05.md` Template 23) — Lote 1 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Sin troquel personalizado
 * (rectángulo estándar). A diferencia del Serum, este template no tiene
 * ningún dato tipo "% de activo" que justifique el acento cobre — el
 * batch no lo menciona en absoluto, así que no se fuerza su aparición
 * (mismo principio de "un acento a la vez, usado con moderación" del
 * Design Language Guide: si no hay un dato que lo amerite, el acento
 * simplemente no aparece).
 */
export function createNeutralMinimalLabelProject(options: CreateNeutralMinimalLabelProjectOptions): Project {
  const { now } = options;
  const widthPx = toPixels(WIDTH_MM, "mm");
  const heightPx = toPixels(HEIGHT_MM, "mm");
  const centerX = widthPx / 2;
  const centerY = heightPx / 2;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Etiqueta Neutral Minimalista",
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const { positions } = stackVertically(
        [
          { key: "wordmark", height: textLineHeight(14), gapAfter: 5 },
          { key: "divider", height: 0.6, gapAfter: 5 },
          { key: "subtitle", height: textLineHeight(8) },
        ] as const,
        centerY,
      );
      const y = Object.fromEntries(positions.map((p) => [p.key, p.y])) as Record<"wordmark" | "divider" | "subtitle", number>;

      const textBoxWidth = widthPx * 0.75;
      const dividerWidth = widthPx * 0.35; // bajo el máximo del 40% del batch

      return [
        // Wordmark de marca/producto — centrado, dominante.
        createTextObject({
          ids,
          now,
          content: "TU MARCA",
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_CARBON,
          role: "wordmark",
          name: "Wordmark",
          x: centerX - textBoxWidth / 2,
          y: y.wordmark,
          width: textBoxWidth,
          height: textLineHeight(14),
        }),
        // Línea divisoria fina — máx. 40% del ancho (Layout del batch).
        createDividerLine({
          ids,
          now,
          centerX,
          y: y.divider,
          width: dividerWidth,
          thickness: 0.6,
          color: COLOR_CARBON,
          opacity: 0.35,
        }),
        // Subtítulo corto — categoría de producto o dato breve.
        createTextObject({
          ids,
          now,
          content: "Categoría de producto",
          fontFamily: FONT_FAMILY,
          fontSize: 8,
          fontWeight: 400,
          textAlign: "center",
          fill: COLOR_CARBON,
          role: "subtitle",
          name: "Subtítulo",
          x: centerX - textBoxWidth / 2,
          y: y.subtitle,
          width: textBoxWidth,
          height: textLineHeight(8),
        }),
      ];
    },
  });
}
