import { toPixels, type Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createTextObject } from "./kit/textObjects.js";
import { createRectangle } from "./kit/graphicElements.js";
import { textLineHeight } from "./kit/layout.js";

const SIZE_MM = 40;
const FONT_FAMILY = "Work Sans";
/** Paleta real del template (`TEMPLATE_BATCH_10.md`, Template 46) — misma
 * paleta ya validada en Sello de Cierre (catálogo 8.1). */
const COLOR_TEXT = "#23282B";
const COLOR_ACCENT = "#9C4E27";

export interface CreateEtsyNeutralPackagingProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Empaque Artesanal Etsy" (catálogo 14.3,
 * `TEMPLATE_BATCH_10.md` Template 46) — Lote 2 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. El "espacio de logo (a completar
 * por el usuario)" del batch es el primer caso real del catálogo de un
 * placeholder gráfico que NO es contenido de THÖREN — se modela como un
 * `RectangleObject` sin relleno, solo con borde (`metadata.role:
 * "user-logo-placeholder"`), dándole al comprador una guía visual de
 * proporción en vez de dejar el espacio vacío sin ninguna referencia (el
 * "error más común a evitar" que el propio batch señala en su Nivel de
 * Calidad). El acento cobre se usa exclusivamente en este borde — su único
 * propósito es señalar "esta zona es especial, no es contenido fijo",
 * consistente con la regla de un acento a la vez.
 */
export function createEtsyNeutralPackagingProject(options: CreateEtsyNeutralPackagingProjectOptions): Project {
  const { now } = options;
  const sizePx = toPixels(SIZE_MM, "mm");
  const centerX = sizePx / 2;

  // Retícula de 2 franjas horizontales (66% / 34%, Layout del batch) —
  // misma proporción que Etiqueta Corporativa Simple (7.3), aunque aquí
  // la zona superior es un espacio de logo gráfico, no texto.
  const logoZoneHeight = sizePx * 0.66;
  const thankYouZoneHeight = sizePx * 0.34;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Empaque Artesanal Etsy",
    widthMm: SIZE_MM,
    heightMm: SIZE_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const logoPlaceholderMargin = sizePx * 0.1;
      const logoPlaceholderSize = logoZoneHeight - logoPlaceholderMargin * 2;
      const thankYouFontSize = 8;
      const textBoxWidth = sizePx * 0.85;

      return [
        // Espacio de logo — dos tercios superiores, reservado para el
        // logo propio del usuario (no es contenido de THÖREN).
        createRectangle({
          ids,
          now,
          x: centerX - logoPlaceholderSize / 2,
          y: (logoZoneHeight - logoPlaceholderSize) / 2,
          width: logoPlaceholderSize,
          height: logoPlaceholderSize,
          stroke: COLOR_ACCENT,
          strokeWidth: 0.6,
          opacity: 0.6,
          role: "user-logo-placeholder",
          name: "Espacio de logo (usuario)",
        }),
        // Línea de agradecimiento corta — tercio inferior, nunca excede
        // el 34% de la altura total (Layout del batch).
        createTextObject({
          ids,
          now,
          content: "Gracias por tu compra",
          fontFamily: FONT_FAMILY,
          fontSize: thankYouFontSize,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "thank-you-line",
          name: "Línea de agradecimiento",
          x: centerX - textBoxWidth / 2,
          y: logoZoneHeight + thankYouZoneHeight / 2 - textLineHeight(thankYouFontSize) / 2,
          width: textBoxWidth,
          height: textLineHeight(thankYouFontSize),
        }),
      ];
    },
  });
}
