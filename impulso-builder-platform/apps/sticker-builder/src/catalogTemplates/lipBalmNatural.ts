import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { stackVertically, textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 20;
const FONT_FAMILY = "Quicksand";
/** Paleta real del template (`TEMPLATE_BATCH_03.md`, Template 11 —
 * Bálsamo Labial Natural): terracota para el mockup (no usado dentro del
 * Project), crema para el fondo del mockup (idem), casi negro para el
 * único texto de alto contraste — sin acento, es el segundo template del
 * catálogo (después del Serum) resuelto exclusivamente con tipografía. */
const COLOR_TEXT = "#2B2B2B";

export interface CreateLipBalmNaturalProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Bálsamo Labial Natural" (catálogo 2.5,
 * `TEMPLATE_BATCH_03.md` Template 11) — Lote 1 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. El formato de 20mm es el más
 * pequeño de todo el catálogo; el batch describe el wordmark de marca "en
 * arco pequeño" sobre el borde inferior — se simplifica aquí a texto recto
 * centrado, apilado debajo del sabor, porque el texto curvo (`arrangeRingText`)
 * es una capacidad todavía no construida, reservada para el Lote 3; esta
 * simplificación se documenta en el reporte de producción del Lote 1, no se
 * oculta.
 */
export function createLipBalmNaturalProject(options: CreateLipBalmNaturalProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Bálsamo Labial Natural",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM });
      const dieLine = dieLineObjects[0];
      const centerPx = dieLine?.type === "ellipse" ? dieLine.size.width / 2 : 0;

      const { positions } = stackVertically(
        [
          { key: "flavor", height: textLineHeight(7), gapAfter: 2 },
          { key: "wordmark", height: textLineHeight(4) },
        ] as const,
        centerPx,
      );
      const y = Object.fromEntries(positions.map((p) => [p.key, p.y])) as Record<"flavor" | "wordmark", number>;

      const textBoxWidth = 48;

      return [
        ...dieLineObjects,
        // Sabor/aroma — único elemento verdaderamente dominante (Dirección
        // de Arte del batch).
        createTextObject({
          ids,
          now,
          content: "Vainilla",
          fontFamily: FONT_FAMILY,
          fontSize: 7,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "flavor",
          name: "Sabor",
          x: centerPx - textBoxWidth / 2,
          y: y.flavor,
          width: textBoxWidth,
          height: textLineHeight(7),
        }),
        // Wordmark de marca — notablemente más pequeño que el sabor.
        createTextObject({
          ids,
          now,
          content: "TU MARCA",
          fontFamily: FONT_FAMILY,
          fontSize: 4,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "wordmark",
          name: "Wordmark",
          x: centerPx - textBoxWidth / 2,
          y: y.wordmark,
          width: textBoxWidth,
          height: textLineHeight(4),
        }),
      ];
    },
  });
}
