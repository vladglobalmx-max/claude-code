import type { Project } from "@impulso/document-schema";
import { createCatalogProject } from "./kit/projectFactory.js";
import { createDieLineObjects } from "./kit/dieLine.js";
import { createTextObject, createSplitAccentLine } from "./kit/textObjects.js";
import { createDividerLine } from "./kit/graphicElements.js";
import { stackVertically, textLineHeight } from "./kit/layout.js";

const DIAMETER_MM = 40;
const FONT_FAMILY = "Poppins";
/**
 * Paleta real del template (`TEMPLATE_BATCH_02.md`, Template 7 — Serum
 * Facial Premium): carbón para texto de alto contraste, hueso para el
 * fondo del mockup (no usado dentro del Project en sí, el troquel es
 * transparente/blanco como cualquier otro sticker), cobre como único
 * acento — usado exclusivamente en el % de activo, nunca en un bloque
 * grande (ver Dirección de Arte del batch).
 */
const COLOR_CARBON = "#23282B";
const COLOR_COBRE = "#9C4E27";

export interface CreateSerumFacialPremiumProjectOptions {
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
}

/**
 * Construye el `Project` real del template piloto "Serum Facial Premium"
 * (catálogo 2.1, `TEMPLATE_BATCH_02.md`) — primer template del catálogo de
 * 63 traducido de especificación en prosa a un `Project` funcional de
 * `@impulso/document-schema`, y el primero reescrito sobre la
 * infraestructura de producción (`catalogTemplates/kit/`) una vez aprobada
 * como estándar. Ver `THOREN_PRODUCTION_INFRASTRUCTURE.md` para qué
 * problema resuelve cada pieza del kit usada aquí, y
 * `THOREN_PILOT_TEMPLATE_STANDARD.md` §5 para el proceso original de
 * traducción y las decisiones tomadas (siguen vigentes; este archivo solo
 * cambió CÓMO se ensamblan los mismos objetos, no su contenido).
 *
 * Deliberadamente sin ilustración (la propia sección 5 del batch dice
 * "Ninguno") — el diseño es enteramente tipográfico + una línea divisoria,
 * por eso el piloto no toca `@impulso/asset-library` en absoluto.
 */
export function createSerumFacialPremiumProject(options: CreateSerumFacialPremiumProjectOptions): Project {
  const { now } = options;

  return createCatalogProject({
    moduleId: "sticker-builder",
    name: "Serum Facial Premium",
    widthMm: DIAMETER_MM,
    heightMm: DIAMETER_MM,
    now,
    generateId: options.generateId,
    buildObjects: ({ ids }) => {
      const dieLineObjects = createDieLineObjects({ ids, now, shape: "circle", widthMm: DIAMETER_MM, heightMm: DIAMETER_MM });
      const dieLine = dieLineObjects[0];
      const centerPx = dieLine?.type === "ellipse" ? dieLine.size.width / 2 : 0;

      // Retícula vertical: cada elemento apila su altura (fontSize *
      // lineHeight 1.2, salvo la línea divisoria) más un espacio fijo
      // entre elementos; el bloque completo se centra verticalmente en la
      // página vía `stackVertically` (ver `THOREN_PILOT_TEMPLATE_STANDARD.md`
      // §5 para por qué se calcula así en vez de coordenadas fijas).
      const { positions } = stackVertically(
        [
          { key: "wordmark", height: textLineHeight(15), gapAfter: 4 },
          { key: "product-name", height: textLineHeight(10), gapAfter: 8 },
          { key: "divider", height: 0.8, gapAfter: 8 },
          { key: "data-line", height: textLineHeight(8) },
        ] as const,
        centerPx,
      );
      const y = Object.fromEntries(positions.map((p) => [p.key, p.y])) as Record<
        "wordmark" | "product-name" | "divider" | "data-line",
        number
      >;

      // Ancho de caja de texto conservador (90px) — ver §5.4 de
      // THOREN_PILOT_TEMPLATE_STANDARD.md: 90px deja margen real frente al
      // ancho seguro real del círculo incluso en el punto más alejado del
      // centro vertical que usa este layout, sin necesitar trigonometría
      // por línea (que sería sobre-ingeniería para un solo template).
      const textBoxWidth = 90;

      return [
        // Línea de corte — mismo patrón que `createProjectFromSize`
        // (`shape: "circle"`), vía `createDieLineObjects`.
        ...dieLineObjects,
        // Wordmark / nombre de marca — dominante, único elemento en peso
        // 300 (Dirección de Arte del batch).
        createTextObject({
          ids,
          now,
          content: "TU MARCA",
          fontFamily: FONT_FAMILY,
          fontSize: 15,
          fontWeight: 300,
          textAlign: "center",
          fill: COLOR_CARBON,
          role: "wordmark",
          name: "Wordmark",
          x: centerPx - textBoxWidth / 2,
          y: y.wordmark,
          width: textBoxWidth,
          height: textLineHeight(15),
        }),
        // Nombre del producto — ejemplo tomado literalmente del batch
        // ("Serum Vitamina C").
        createTextObject({
          ids,
          now,
          content: "Serum Vitamina C",
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          fontWeight: 400,
          textAlign: "center",
          fill: COLOR_CARBON,
          role: "product-name",
          name: "Nombre del producto",
          x: centerPx - textBoxWidth / 2,
          y: y["product-name"],
          width: textBoxWidth,
          height: textLineHeight(10),
        }),
        // Línea divisoria fina — máx. 40% del ancho del círculo (Layout
        // del batch); aquí 45px de 151.18px ≈ 30%.
        createDividerLine({
          ids,
          now,
          centerX: centerPx,
          y: y.divider,
          width: 45,
          thickness: 0.8,
          color: COLOR_CARBON,
          opacity: 0.35,
        }),
        // % de activo + volumen — el único uso del acento cobre, en un
        // elemento pequeño, nunca en un bloque grande (Dirección de Arte
        // del batch). Compuesto como dos `TextObject`s independientes (ver
        // `createSplitAccentLine` — decisión técnica documentada en
        // THOREN_PILOT_TEMPLATE_STANDARD.md §6: Style.fill es un solo
        // color por objeto, no admite color parcial dentro de un mismo
        // string).
        ...createSplitAccentLine({
          ids,
          now,
          centerX: centerPx,
          y: y["data-line"],
          height: textLineHeight(8),
          gap: 4,
          left: { content: "15%", fill: COLOR_COBRE, role: "active-percentage", name: "% de activo", fontFamily: FONT_FAMILY, fontSize: 8, width: 34 },
          right: { content: "30ml", fill: COLOR_CARBON, role: "volume", name: "Volumen", fontFamily: FONT_FAMILY, fontSize: 8, width: 34 },
        }),
      ];
    },
  });
}
