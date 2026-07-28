import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 45;
const FONT_FAMILY = "Lora";
/** Misma paleta y textura de Etiqueta Kraft Genérica (catálogo 7.2),
 * reutilizada de forma intencional (`TEMPLATE_BATCH_09.md`, Template 44).
 * La textura kraft se aproxima como el `fill` del die-line — ver
 * `THOREN_DECISION_LOG.md` DEC-009. */
const COLOR_KRAFT_BG = "#F5EFE3";
const COLOR_TEXT = "#2B2216";

export interface CreateKraftHandmadeEtsyProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Kraft Hecho a Mano" (catálogo 14.1,
 * `TEMPLATE_BATCH_09.md` Template 44) — Lote 2 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Un solo elemento — el nombre de
 * la tienda de Etsy/marketplace — sin línea divisoria ni sello decorativo,
 * a diferencia de la Etiqueta Kraft Genérica (7.2) de la que reutiliza
 * paleta y fondo.
 */
export function createKraftHandmadeEtsyProject(options: CreateKraftHandmadeEtsyProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Kraft Hecho a Mano",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM, fill: COLOR_KRAFT_BG });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      const textBoxWidth = diameterPx * 0.75;
      const fontSize = 15;

      return [
        ...dieLineObjects,
        // Nombre de la tienda — único elemento, ocupa el máximo tamaño
        // legible dentro del área segura (Layout del batch).
        createTextObject({
          ids,
          now,
          content: "Tu Tienda",
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "shop-name",
          name: "Nombre de la tienda",
          x: centerPx - textBoxWidth / 2,
          y: centerPx - textLineHeight(fontSize) / 2,
          width: textBoxWidth,
          height: textLineHeight(fontSize),
        }),
      ];
    },
  });
}
