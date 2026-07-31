import type { Document, SceneObject } from "@impulso/document-schema";
import { exportarSVG } from "../exportar.js";
import type { RecipePalette } from "../recipe.js";
import { estimateTextWidth } from "../textMetrics.js";
import { findCollisions } from "./collision.js";
import { CONTRAST_THRESHOLD_GRAPHIC, contrastRatio, requiredTextContrast } from "./contrast.js";

/**
 * Filtro de calidad básico — Fase 2 (docs/product/THOREN_IMPLEMENTATION_PLAN.md,
 * ampliado por instrucción explícita a incluir colisiones). Verifica
 * únicamente lo estructural: texto dentro de límites, contraste válido,
 * elementos sin colisión, exportación correcta.
 *
 * Lo que NO hace esta fase (llega en el Filtro de calidad ampliado de
 * Fase 5, `THOREN_CREATIVE_ENGINE.md` §11-12): clasificación en cinco
 * niveles, ajuste automático tras un rechazo, ni sustitución de receta —
 * aquí una falla es simplemente una falla, reportada con su motivo.
 */
export interface Validacion {
  readonly aprobada: boolean;
  readonly fallas: readonly string[];
}

function allObjects(document: Document): SceneObject[] {
  return document.pages.flatMap((page) => page.layers.flatMap((layer) => layer.objects));
}

function checkTextBounds(objects: readonly SceneObject[]): string[] {
  const fallas: string[] = [];
  for (const object of objects) {
    if (object.type !== "text" || !object.size) continue;
    // Tolerancia del 5% — la estimación de ancho es conservadora por
    // diseño (ver textMetrics.ts), un margen exacto de 0 sería
    // demasiado estricto para una aproximación sin métrica real de fuente.
    const estimated = estimateTextWidth(object.content, object.fontSize);
    if (estimated > object.size.width * 1.05) {
      fallas.push(
        `Texto desbordado: "${object.content}" (ancho estimado ${estimated.toFixed(1)}, caja ${object.size.width.toFixed(1)})`,
      );
    }
  }
  return fallas;
}

function checkContrast(objects: readonly SceneObject[], background: string): string[] {
  const fallas: string[] = [];
  for (const object of objects) {
    if (object.metadata.role === "background") continue;
    if (object.type === "text" && object.style.fill) {
      const ratio = contrastRatio(object.style.fill, background);
      const required = requiredTextContrast(object.fontSize);
      if (ratio < required) {
        fallas.push(`Contraste insuficiente en texto "${object.content}": ${ratio.toFixed(2)}:1 (mínimo ${required}:1)`);
      }
    } else {
      const color = object.style.fill ?? object.style.stroke;
      if (!color) continue;
      const ratio = contrastRatio(color, background);
      if (ratio < CONTRAST_THRESHOLD_GRAPHIC) {
        fallas.push(`Contraste insuficiente en elemento "${object.metadata.role ?? object.type}": ${ratio.toFixed(2)}:1 (mínimo ${CONTRAST_THRESHOLD_GRAPHIC}:1)`);
      }
    }
  }
  return fallas;
}

function checkCollisions(objects: readonly SceneObject[]): string[] {
  return findCollisions(objects).map(
    ([a, b]) => `Colisión entre "${a.metadata.role ?? a.type}" y "${b.metadata.role ?? b.type}"`,
  );
}

async function checkExport(document: Document, expectedContent: readonly string[]): Promise<string[]> {
  try {
    const svg = await exportarSVG(document);
    if (!svg.startsWith("<svg")) {
      return ["Exportación inválida: el SVG no comienza con la etiqueta raíz <svg>"];
    }
    // Case-insensitive: mayúsculas es una transformación tipográfica legítima
    // de la receta (§5 "tracking abierto en mayúsculas pequeñas"), no una
    // alteración del contenido — la fidelidad exige que el texto real
    // sobreviva, no que conserve su capitalización original.
    const lowerSvg = svg.toLowerCase();
    const missing = expectedContent.filter((content) => !lowerSvg.includes(content.toLowerCase()));
    if (missing.length > 0) {
      return [`Fidelidad de contenido: el SVG exportado no contiene: ${missing.join(", ")}`];
    }
    return [];
  } catch (error) {
    return [`Exportación falló: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/**
 * `expectedContent` son las cadenas de texto reales del usuario que deben
 * sobrevivir intactas hasta el SVG final — la verificación de fidelidad de
 * §11 ("que el nombre/marca real aparezca correctamente").
 */
export async function validarComposicion(
  document: Document,
  palette: RecipePalette,
  expectedContent: readonly string[],
): Promise<Validacion> {
  const objects = allObjects(document);
  const fallas = [
    ...checkTextBounds(objects),
    ...checkContrast(objects, palette.background),
    ...checkCollisions(objects),
    ...(await checkExport(document, expectedContent)),
  ];
  return { aprobada: fallas.length === 0, fallas };
}
