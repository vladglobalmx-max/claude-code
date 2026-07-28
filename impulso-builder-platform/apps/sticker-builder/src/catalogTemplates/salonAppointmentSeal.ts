import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { arrangeRingText } from "./kit/ringText.js";

const DIAMETER_MM = 30;
const FONT_MONOGRAM = "Playfair Display";
const FONT_RING = "Work Sans";
/** Paleta real del template (`TEMPLATE_BATCH_03.md`, Template 12): rosa
 * antiguo como acento dominante, casi negro para el anillo perimetral,
 * rosa pálido como fondo del sello. */
const COLOR_ROSE = "#B76E79";
const COLOR_INK = "#2B2224";
const COLOR_PALE = "#F7E9EA";

export interface CreateSalonAppointmentSealProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Sello de Cita — Salón de Belleza"
 * (catálogo 3.1, `TEMPLATE_BATCH_03.md` Template 12) — Lote 3 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Primer template del catálogo en
 * usar `arrangeRingText` (anillo de texto perimetral de 360°, ver
 * `THOREN_DECISION_LOG.md`) — aprobado vía `THOREN_VISUAL_ACCEPTANCE.md`
 * como patrón base para el resto del Lote 3 (10.1 Sello Corporativo).
 *
 * El peso 700 del anillo (en vez del tamaño original de fuente) es la
 * variante ganadora de la comparación estética previa a la aprobación —
 * ver DEC-013 en `THOREN_DECISION_LOG.md`: para anillos de texto cortos
 * en sellos de ~30mm, se prioriza aumentar el peso tipográfico antes que
 * el tamaño cuando el monograma central debe conservar la jerarquía
 * principal.
 *
 * El "versalitas" y el "tracking amplio" del batch para el texto
 * perimetral se aproximan con contenido en mayúsculas y el tracking por
 * defecto del renderer — `@impulso/document-schema` no tiene un campo de
 * letter-spacing (misma clase de limitación ya documentada para texto
 * curvado/partido en colores).
 */
export function createSalonAppointmentSealProject(options: CreateSalonAppointmentSealProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sello de Cita — Salón de Belleza",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM, fill: COLOR_PALE });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      // Monograma: ~40% del diámetro total (Layout del batch), fontSize
      // derivado de height = fontSize * 1.2 (convención de `createTextObject`).
      const monogramFontSize = (diameterPx * 0.4) / 1.2;
      const monogramWidth = monogramFontSize * 1.1;
      const monogramHeight = monogramFontSize * 1.2;

      // Anillo perimetral: radio dentro del área segura (3mm de margen
      // interno respecto al troquel), sin tocarla.
      const safeMarginPx = diameterPx * (3 / DIAMETER_MM);
      const ringRadius = diameterPx / 2 - safeMarginPx;
      const ringFontSize = 8;

      return [
        ...dieLineObjects,
        // Monograma central — dominante, el elemento gráfico ES la
        // tipografía en sí (sin ícono aparte, per Dirección de Arte).
        createTextObject({
          ids,
          now,
          content: "M",
          fontFamily: FONT_MONOGRAM,
          fontSize: monogramFontSize,
          fontWeight: 600,
          textAlign: "center",
          fill: COLOR_ROSE,
          role: "monogram",
          name: "Monograma",
          x: centerPx - monogramWidth / 2,
          y: centerPx - monogramHeight / 2,
          width: monogramWidth,
          height: monogramHeight,
        }),
        // Anillo perimetral con el nombre completo del salón, partido en
        // 2 fragmentos (arriba/abajo, 180° de separación) — convención de
        // sello/moneda documentada en `kit/ringText.ts`.
        ...arrangeRingText({
          ids,
          now,
          centerX: centerPx,
          centerY: centerPx,
          radius: ringRadius,
          fragments: [
            { content: "SALÓN", fontFamily: FONT_RING, fontSize: ringFontSize, fontWeight: 700, fill: COLOR_INK, role: "ring-text", name: "Anillo — Salón" },
            { content: "MARINA", fontFamily: FONT_RING, fontSize: ringFontSize, fontWeight: 700, fill: COLOR_INK, role: "ring-text", name: "Anillo — Marina" },
          ],
        }),
      ];
    },
  });
}
