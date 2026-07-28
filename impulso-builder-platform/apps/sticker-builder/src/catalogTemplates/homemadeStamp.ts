import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 35;
const FONT_FAMILY = "Caveat";
/** Paleta real del template (`TEMPLATE_BATCH_05.md`, Template 22): crema
 * para el fondo (aproxima la "textura de sello de tinta" como `fill` del
 * die-line, ver `THOREN_DECISION_LOG.md` DEC-009 — la textura tileable
 * real queda reservada para el Lote 4), marrón cálido para el texto. */
const COLOR_CREAM = "#F5EEDD";
const COLOR_BROWN = "#8B5E3C";

export interface CreateHomemadeStampProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Sello 'Hecho en Casa'" (catálogo 6.3,
 * `TEMPLATE_BATCH_05.md` Template 22) — Lote 3 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. NO usa `arrangeRingText`: su
 * especificación completa (leída antes de codear, ver
 * `THOREN_DECISION_LOG.md` DEC-012) describe un sello de un solo elemento
 * central, sin ninguna zona perimetral — se mantiene en el Lote 3 de
 * todas formas porque no introduce ningún riesgo nuevo (reutiliza el
 * patrón de `fill` de textura ya aprobado, DEC-009).
 */
export function createHomemadeStampProject(options: CreateHomemadeStampProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sello \"Hecho en Casa\"",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM, fill: COLOR_CREAM });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      // Texto script único — ocupa el máximo tamaño legible dentro del
      // área segura (Layout del batch); sin segundo rol tipográfico.
      const fontSize = 16;
      const textWidth = diameterPx * 0.85;

      return [
        ...dieLineObjects,
        createTextObject({
          ids,
          now,
          content: "Hecho en casa",
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_BROWN,
          role: "main-text",
          name: "Texto principal",
          x: centerPx - textWidth / 2,
          y: centerPx - textLineHeight(fontSize) / 2,
          width: textWidth,
          height: textLineHeight(fontSize),
        }),
      ];
    },
  });
}
