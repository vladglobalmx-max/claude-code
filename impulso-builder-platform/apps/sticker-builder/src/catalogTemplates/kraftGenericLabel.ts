import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { createEllipse } from "./kit/graphicElements.js";
import { stackVertically, textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 45;
const FONT_WORDMARK = "Lora";
const FONT_SUBTITLE = "Work Sans";
/** Paleta real del template (`TEMPLATE_BATCH_05.md`, Template 24) —
 * exactamente la misma del Jabón Artesanal en Barra, reutilizada de forma
 * intencional. La "textura de papel kraft" del batch se aproxima como el
 * `fill` sólido del die-line (`#F5EFE3`) — ver `THOREN_DECISION_LOG.md`
 * DEC-009 — no como una imagen tileable real. */
const COLOR_KRAFT_BG = "#F5EFE3";
const COLOR_TEXT = "#2B2216";

export interface CreateKraftGenericLabelProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Etiqueta Kraft Genérica" (catálogo 7.2,
 * `TEMPLATE_BATCH_05.md` Template 24) — Lote 2 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. El "sello circular simple
 * superpuesto opcional" del batch se modela como un anillo decorativo sin
 * relleno cerca del borde (`createEllipse`, mismo patrón que el borde
 * concéntrico de `closureSeal.ts`) — es geometría vectorial simple ("línea,
 * sin ilustración figurativa" según el propio batch), no una ilustración
 * real; no requiere `@impulso/asset-library`.
 */
export function createKraftGenericLabelProject(options: CreateKraftGenericLabelProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Etiqueta Kraft Genérica",
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
          { key: "wordmark", height: textLineHeight(16), gapAfter: 8 },
          { key: "subtitle", height: textLineHeight(8) },
        ] as const,
        centerPx,
      );
      const y = Object.fromEntries(positions.map((p) => [p.key, p.y])) as Record<"wordmark" | "subtitle", number>;
      const textBoxWidth = diameterPx * 0.7;

      // Sello circular decorativo — máx. 20% del diámetro (Layout del
      // batch), superpuesto cerca de un borde (esquina superior derecha).
      const sealDiameter = diameterPx * 0.18;
      const sealInset = diameterPx * 0.12;

      return [
        ...dieLineObjects,
        // Wordmark de marca/producto — dominante (Dirección de Arte del batch).
        createTextObject({
          ids,
          now,
          content: "TU MARCA",
          fontFamily: FONT_WORDMARK,
          fontSize: 16,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "wordmark",
          name: "Wordmark",
          x: centerPx - textBoxWidth / 2,
          y: y.wordmark,
          width: textBoxWidth,
          height: textLineHeight(16),
        }),
        // Subtítulo corto (ej. "hecho a mano").
        createTextObject({
          ids,
          now,
          content: "Hecho a mano",
          fontFamily: FONT_SUBTITLE,
          fontSize: 8,
          fontWeight: 400,
          textAlign: "center",
          fill: COLOR_TEXT,
          role: "subtitle",
          name: "Subtítulo",
          x: centerPx - textBoxWidth / 2,
          y: y.subtitle,
          width: textBoxWidth,
          height: textLineHeight(8),
        }),
        // Sello circular decorativo opcional — máx. 20% del diámetro
        // (Layout del batch), superpuesto cerca de un borde.
        createEllipse({
          ids,
          now,
          x: diameterPx - sealInset - sealDiameter,
          y: sealInset,
          width: sealDiameter,
          height: sealDiameter,
          stroke: COLOR_TEXT,
          strokeWidth: 0.6,
          opacity: 0.7,
          role: "decorative-seal",
          name: "Sello decorativo",
        }),
      ];
    },
  });
}
