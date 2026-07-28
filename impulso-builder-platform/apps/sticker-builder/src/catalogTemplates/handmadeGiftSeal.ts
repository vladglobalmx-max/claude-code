import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { stackVertically, textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 35;
const FONT_FAMILY = "Caveat";
/** Paleta real del template (`TEMPLATE_BATCH_09.md`, Template 43): marrón
 * kraft para el texto fijo, rojo cálido como único acento — usado aquí en
 * el campo de nombre (la parte personal/editable) para darle "un toque
 * festivo/personal distinto del tono puramente comercial" que el propio
 * batch describe, sin inventar un segundo elemento que no está en la
 * especificación. La textura kraft del fondo se aproxima como el `fill`
 * del die-line (`#F5EFE3`) — ver `THOREN_DECISION_LOG.md` DEC-009. */
const COLOR_KRAFT_BG = "#F5EFE3";
const COLOR_TEXT = "#8B6F47";
const COLOR_ACCENT = "#C0392B";

export interface CreateHandmadeGiftSealProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Sello de Regalo Hecho a Mano" (catálogo
 * 13.3, `TEMPLATE_BATCH_09.md` Template 43) — Lote 2 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. Reasignado desde el Lote 1 por
 * su textura kraft (ver `THOREN_DECISION_LOG.md` DEC-005).
 */
export function createHandmadeGiftSealProject(options: CreateHandmadeGiftSealProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sello de Regalo Hecho a Mano",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM, fill: COLOR_KRAFT_BG });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      const { positions } = stackVertically(
        [
          { key: "fixed-text", height: textLineHeight(11), gapAfter: 6 },
          { key: "name", height: textLineHeight(10) },
        ] as const,
        centerPx,
      );
      const y = Object.fromEntries(positions.map((p) => [p.key, p.y])) as Record<"fixed-text" | "name", number>;
      const textBoxWidth = diameterPx * 0.75;

      return [
        ...dieLineObjects,
        // Texto fijo "Hecho con cariño por..." — dominante.
        createTextObject({
          ids,
          now,
          content: "Hecho con cariño por...",
          fontFamily: FONT_FAMILY,
          fontSize: 11,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "fixed-text",
          name: "Texto fijo",
          x: centerPx - textBoxWidth / 2,
          y: y["fixed-text"],
          width: textBoxWidth,
          height: textLineHeight(11),
        }),
        // Campo de nombre editable — único uso del acento rojo (Dirección
        // de Arte del batch).
        createTextObject({
          ids,
          now,
          content: "Tu Nombre",
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_ACCENT,
          role: "name",
          name: "Campo de nombre",
          x: centerPx - textBoxWidth / 2,
          y: y.name,
          width: textBoxWidth,
          height: textLineHeight(10),
        }),
      ];
    },
  });
}
