import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";

const DIAMETER_MM = 35;
const FONT_FAMILY = "Playfair Display";
/** Paleta real del template (`TEMPLATE_BATCH_07.md`, Template 33): casi
 * negro para el único texto (sin segundo nivel de jerarquía) — hueso y
 * rosa antiguo son parte de la paleta sugerida del mockup, sin uso dentro
 * del Project en sí, porque el batch no describe ningún dato que amerite
 * un segundo acento (mismo principio ya aplicado en Etiqueta Neutral
 * Minimalista). */
const COLOR_TEXT = "#2B2224";

export interface CreateThankYouPreferenceProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Gracias por tu Preferencia" (catálogo
 * 10.3, `TEMPLATE_BATCH_07.md` Template 33) — Lote 1 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Un solo `TextObject` — "un solo
 * nivel — el texto de agradecimiento es el único elemento del diseño"
 * (Dirección de Arte del batch) — sin partición ni línea divisoria.
 * `Playfair Display` es una tipografía serif libre (Google Fonts, SIL Open
 * Font License), sin el riesgo de licenciamiento que motivó la sustitución
 * de Century Gothic en el piloto.
 */
export function createThankYouPreferenceProject(options: CreateThankYouPreferenceProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Gracias por tu Preferencia",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      const textBoxWidth = 95;
      const textBoxHeight = 45;
      const fontSize = 10;

      return [
        ...dieLineObjects,
        // Texto de agradecimiento — único elemento del diseño.
        createTextObject({
          ids,
          now,
          content: "Gracias por su preferencia",
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "thank-you-text",
          name: "Texto de agradecimiento",
          x: centerPx - textBoxWidth / 2,
          y: centerPx - textBoxHeight / 2,
          width: textBoxWidth,
          height: textBoxHeight,
        }),
      ];
    },
  });
}
