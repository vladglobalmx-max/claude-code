import { toPixels, type Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createTextObject } from "./kit/textObjects.js";
import { createDividerLine } from "./kit/graphicElements.js";
import { stackVertically, textLineHeight } from "./kit/layout.js";

const WIDTH_MM = 100;
const HEIGHT_MM = 50;
const FONT_FAMILY = "Work Sans";
/** Paleta real del template (`TEMPLATE_BATCH_03.md`, Template 13 — Spa &
 * Bienestar): verde grisáceo como único acento (la línea divisoria), hueso
 * para el fondo del mockup (no usado dentro del Project), verde oscuro
 * casi negro para el texto de contraste mínimo necesario. */
const COLOR_TEXT = "#3A423E";
const COLOR_ACCENT = "#A9BBB4";

export interface CreateSpaWellnessProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Spa & Bienestar" (catálogo 3.2,
 * `TEMPLATE_BATCH_03.md` Template 13) — Lote 1 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Sin troquel personalizado (forma
 * rectangular estándar, `createDieLineObjects` no agrega ningún objeto) —
 * el mismo espacio negativo extremo de familia Lujo Silencioso que el
 * Serum Facial Premium, aplicado a un formato rectangular.
 */
export function createSpaWellnessProject(options: CreateSpaWellnessProjectOptions): Project {
  const { now } = options;
  const widthPx = toPixels(WIDTH_MM, "mm");
  const heightPx = toPixels(HEIGHT_MM, "mm");
  const centerX = widthPx / 2;
  const centerY = heightPx / 2;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Spa & Bienestar",
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const { positions } = stackVertically(
        [
          { key: "name", height: textLineHeight(14), gapAfter: 6 },
          { key: "divider", height: 0.6, gapAfter: 6 },
          { key: "subtitle", height: textLineHeight(8) },
        ] as const,
        centerY,
      );
      const y = Object.fromEntries(positions.map((p) => [p.key, p.y])) as Record<"name" | "divider" | "subtitle", number>;

      const textBoxWidth = widthPx * 0.7;
      const dividerWidth = widthPx * 0.24; // máx. 30% del ancho total (Layout del batch)

      return [
        // Nombre del spa/centro — único elemento de peso visual real.
        createTextObject({
          ids,
          now,
          content: "TU SPA",
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          fontWeight: 300,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "name",
          name: "Nombre del spa",
          x: centerX - textBoxWidth / 2,
          y: y.name,
          width: textBoxWidth,
          height: textLineHeight(14),
        }),
        // Línea fina decorativa — máx. 30% del ancho (Layout del batch).
        createDividerLine({
          ids,
          now,
          centerX,
          y: y.divider,
          width: dividerWidth,
          thickness: 0.6,
          color: COLOR_ACCENT,
        }),
        // Subtítulo corto opcional.
        createTextObject({
          ids,
          now,
          content: "Amenidades de bienestar",
          fontFamily: FONT_FAMILY,
          fontSize: 8,
          fontWeight: 400,
          textAlign: "center",
          fill: COLOR_TEXT,
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
