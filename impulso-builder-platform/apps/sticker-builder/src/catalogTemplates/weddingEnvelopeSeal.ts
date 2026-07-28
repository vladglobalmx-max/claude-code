import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 25;
const FONT_FAMILY = "Parisienne";
/** Paleta real del template (`TEMPLATE_BATCH_08.md`, Template 36):
 * dorado como único acento, blanco de fondo, casi negro reservado (sin
 * uso en este template — un solo nivel de jerarquía, ver DEC nota abajo). */
const COLOR_GOLD = "#D4AF37";
const COLOR_WHITE = "#FFFFFF";

export interface CreateWeddingEnvelopeSealProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Sello de Sobre de Invitación" (catálogo
 * 12.1, `TEMPLATE_BATCH_08.md` Template 36) — Lote 3 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. NO usa `arrangeRingText`: su
 * especificación completa (leída antes de codear, ver
 * `THOREN_DECISION_LOG.md` DEC-012) describe un solo nivel de jerarquía
 * (iniciales entrelazadas), sin ninguna zona perimetral — se mantiene en
 * el Lote 3 de todas formas porque no introduce ningún riesgo nuevo.
 *
 * El batch recomienda "Parisienne o Playfair Display Italic" — se usa
 * Parisienne (script nativo) en vez de una itálica, porque
 * `@impulso/document-schema` no tiene un campo de estilo itálico en
 * `TextObject` (solo `fontWeight` numérico); un script dedicado logra el
 * mismo carácter elegante sin depender de una capacidad que el schema no
 * soporta.
 */
export function createWeddingEnvelopeSealProject(options: CreateWeddingEnvelopeSealProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sello de Sobre de Invitación",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM, fill: COLOR_WHITE });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      // Iniciales entrelazadas — único elemento, máximo tamaño legible
      // dentro del área segura (margen de 4mm, más generoso que el
      // estándar de 3mm por ser el formato más pequeño del catálogo).
      const fontSize = 16;
      const textWidth = diameterPx * 0.75;

      return [
        ...dieLineObjects,
        createTextObject({
          ids,
          now,
          content: "M & J",
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_GOLD,
          role: "monogram",
          name: "Iniciales entrelazadas",
          x: centerPx - textWidth / 2,
          y: centerPx - textLineHeight(fontSize) / 2,
          width: textWidth,
          height: textLineHeight(fontSize),
        }),
      ];
    },
  });
}
