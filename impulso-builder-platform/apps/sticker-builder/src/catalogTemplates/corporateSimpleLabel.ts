import { toPixels, type Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createTextObject } from "./kit/textObjects.js";
import { textLineHeight } from "./kit/layout.js";

const SIZE_MM = 40;
const FONT_FAMILY = "Inter";
/** Paleta real del template (`TEMPLATE_BATCH_05.md`, Template 25) —
 * anticipa de forma consistente la paleta que la futura categoría
 * Business usará (Batch 07), evitando introducir una paleta sin
 * precedente cuando esa categoría se produzca. */
const COLOR_TEXT = "#1F2933";

export interface CreateCorporateSimpleLabelProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Etiqueta Corporativa Simple" (catálogo
 * 7.3, `TEMPLATE_BATCH_05.md` Template 25) — Lote 2 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. El "bloque de logo/nombre de
 * empresa" del batch es puramente tipográfico ("Assets necesarios:
 * Ninguno gráfico") — no un placeholder de logo de imagen; se modela como
 * un segundo `TextObject`, no como un rectángulo reservado (a diferencia
 * de 14.3 Empaque Artesanal Etsy, que sí reserva un espacio gráfico real
 * para el logo propio del usuario).
 */
export function createCorporateSimpleLabelProject(options: CreateCorporateSimpleLabelProjectOptions): Project {
  const { now } = options;
  const sizePx = toPixels(SIZE_MM, "mm");
  const centerX = sizePx / 2;

  // Retícula de 2 franjas horizontales (66% / 34%, Layout del batch) —
  // distinta del apilado centrado de `stackVertically`: aquí las dos
  // zonas tienen una proporción fija de la página, no un bloque que se
  // centra como conjunto.
  const nameZoneHeight = sizePx * 0.66;
  const contactZoneHeight = sizePx * 0.34;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Etiqueta Corporativa Simple",
    widthMm: SIZE_MM,
    heightMm: SIZE_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const textBoxWidth = sizePx * 0.85;
      const nameFontSize = 13;
      const contactFontSize = 7;

      return [
        // Bloque de logo/nombre de empresa — dos tercios superiores,
        // dominante.
        createTextObject({
          ids,
          now,
          content: "TU EMPRESA",
          fontFamily: FONT_FAMILY,
          fontSize: nameFontSize,
          fontWeight: 600,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "company-name",
          name: "Nombre de empresa",
          x: centerX - textBoxWidth / 2,
          y: nameZoneHeight / 2 - textLineHeight(nameFontSize) / 2,
          width: textBoxWidth,
          height: textLineHeight(nameFontSize),
        }),
        // Datos de contacto — tercio inferior, nunca excede el 34% de la
        // altura total (Layout del batch).
        createTextObject({
          ids,
          now,
          content: "www.tuempresa.com",
          fontFamily: FONT_FAMILY,
          fontSize: contactFontSize,
          fontWeight: 400,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "contact-info",
          name: "Datos de contacto",
          x: centerX - textBoxWidth / 2,
          y: nameZoneHeight + contactZoneHeight / 2 - textLineHeight(contactFontSize) / 2,
          width: textBoxWidth,
          height: textLineHeight(contactFontSize),
        }),
      ];
    },
  });
}
