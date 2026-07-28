import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { arrangeRingText } from "./kit/ringText.js";

const DIAMETER_MM = 30;
const FONT_FAMILY = "Inter";
/** Paleta real del template (`TEMPLATE_BATCH_07.md`, Template 31) —
 * idéntica a la Etiqueta Corporativa Simple (`TEMPLATE_BATCH_05.md`,
 * Template 25, Lote 2), confirmando la continuidad de paleta entre
 * lotes que el propio batch señala explícitamente. El tercer color de la
 * familia (`#4B6673`, azul grisáceo) no se usa en ningún elemento de
 * este template — mismo criterio que 7.3, cuyos únicos dos elementos
 * (nombre de empresa, datos de contacto) tampoco lo usan; es un acento
 * de la paleta de familia, no un requisito por template. */
const COLOR_INK = "#1F2933";
const COLOR_WHITE = "#FFFFFF";

export interface CreateCorporateSealProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Sello Corporativo" (catálogo 10.1,
 * `TEMPLATE_BATCH_07.md` Template 31) — Lote 3 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Segundo template en usar
 * `arrangeRingText`, replicando el patrón aprobado en 3.1 Sello de Cita
 * (ver `THOREN_DECISION_LOG.md` DEC-013).
 *
 * A diferencia de 3.1 (que usa dos familias tipográficas distintas para
 * monograma y anillo), este batch especifica **una sola familia** (Inter
 * peso 600) para ambos elementos — el batch no pide presencia adicional
 * en el anillo, así que aquí NO se aplica el ajuste de peso de DEC-013:
 * la jerarquía (monograma dominante) ya queda garantizada por el tamaño
 * (~40% del diámetro), no por el peso, y usar el mismo peso 600 en ambos
 * es exactamente lo que `TEMPLATE_BATCH_07.md` especifica.
 */
export function createCorporateSealProject(options: CreateCorporateSealProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sello Corporativo",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM, fill: COLOR_WHITE });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      // Monograma: ~40% del diámetro total (Layout del batch), fontSize
      // derivado de height = fontSize * 1.2 (misma convención que 3.1).
      const monogramFontSize = (diameterPx * 0.4) / 1.2;
      const monogramWidth = monogramFontSize * 1.1;
      const monogramHeight = monogramFontSize * 1.2;

      // Anillo perimetral: radio dentro del área segura (3mm de margen
      // interno respecto al troquel), sin tocarla — misma fórmula que 3.1.
      const safeMarginPx = diameterPx * (3 / DIAMETER_MM);
      const ringRadius = diameterPx / 2 - safeMarginPx;
      const ringFontSize = 8;

      return [
        ...dieLineObjects,
        // Monograma central — dominante, el elemento gráfico ES la
        // tipografía en sí (sin ícono aparte, Iconografía Nivel 0 del batch).
        createTextObject({
          ids,
          now,
          content: "T",
          fontFamily: FONT_FAMILY,
          fontSize: monogramFontSize,
          fontWeight: 600,
          textAlign: "center",
          fill: COLOR_INK,
          role: "monogram",
          name: "Monograma",
          x: centerPx - monogramWidth / 2,
          y: centerPx - monogramHeight / 2,
          width: monogramWidth,
          height: monogramHeight,
        }),
        // Anillo perimetral con el nombre completo de la empresa, partido
        // en 2 fragmentos (arriba/abajo, 180° de separación) — mismo
        // placeholder "TU EMPRESA" que Etiqueta Corporativa Simple (Lote 2).
        ...arrangeRingText({
          ids,
          now,
          centerX: centerPx,
          centerY: centerPx,
          radius: ringRadius,
          fragments: [
            { content: "TU", fontFamily: FONT_FAMILY, fontSize: ringFontSize, fontWeight: 600, fill: COLOR_INK, role: "ring-text", name: "Anillo — Tu" },
            { content: "EMPRESA", fontFamily: FONT_FAMILY, fontSize: ringFontSize, fontWeight: 600, fill: COLOR_INK, role: "ring-text", name: "Anillo — Empresa" },
          ],
        }),
      ];
    },
  });
}
