import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject } from "./kit/textObjects.js";
import { createEllipse } from "./kit/graphicElements.js";

const DIAMETER_MM = 25;
const FONT_FAMILY = "Work Sans";
/** Misma paleta neutra del Serum/Etiqueta Neutral — tercera vez que
 * aparece en el catálogo (`TEMPLATE_BATCH_06.md`, Template 26), reforzando
 * su identidad como "la paleta neutra de THÖREN" para piezas agnósticas
 * de industria. */
const COLOR_CARBON = "#23282B";

export interface CreateClosureSealProjectOptions {
  now: string;
  generateId?: () => string;
}

/**
 * Construye el `Project` real de "Sello de Cierre" (catálogo 8.1,
 * `TEMPLATE_BATCH_06.md` Template 26) — Lote 1 del
 * `THOREN_CATALOG_PRODUCTION_PLAN_v1.md`. El "borde de contorno fino
 * opcional" del batch se modela como un segundo `EllipseObject`
 * concéntrico sin relleno (solo `stroke`) — capacidad ya soportada por
 * `createEllipse`, sin necesitar ningún componente nuevo.
 */
export function createClosureSealProject(options: CreateClosureSealProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Sello de Cierre",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM });
      const dieLine = dieLineObjects[0];
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      const centerPx = diameterPx / 2;

      const borderInset = 6;
      const borderDiameter = diameterPx - borderInset * 2;
      const textBoxWidth = 65;
      const fontSize = 8;

      return [
        ...dieLineObjects,
        // Borde de contorno fino opcional — decorativo, concéntrico al
        // troquel, sin relleno.
        createEllipse({
          ids,
          now,
          x: borderInset,
          y: borderInset,
          width: borderDiameter,
          height: borderDiameter,
          stroke: COLOR_CARBON,
          strokeWidth: 0.4,
          opacity: 0.6,
          role: "decorative-border",
          name: "Borde decorativo",
        }),
        // Logo o inicial de marca — único elemento, ocupa el máximo
        // tamaño posible dentro del área segura (Layout del batch).
        createTextObject({
          ids,
          now,
          content: "TU MARCA",
          fontFamily: FONT_FAMILY,
          fontSize,
          fontWeight: 500,
          textAlign: "center",
          fill: COLOR_CARBON,
          role: "wordmark",
          name: "Logo / inicial",
          x: centerPx - textBoxWidth / 2,
          y: centerPx - (fontSize * 1.2) / 2,
          width: textBoxWidth,
          height: fontSize * 1.2,
        }),
      ];
    },
  });
}
