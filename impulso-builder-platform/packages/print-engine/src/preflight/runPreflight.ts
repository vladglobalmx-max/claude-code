import { ProjectSchema, type Page, type Project } from "@impulso/document-schema";
import type { ExportAssetResolver } from "@impulso/export-engine";
import { computeBoxes } from "../boxes.js";
import { physicalToPixels } from "../units.js";
import { estimateMemoryBytes, type MemoryEstimateInput } from "../memory.js";
import { throwIfAborted } from "../errors.js";
import type { PrintJob } from "../types.js";
import { browserFontChecker, type FontChecker } from "./fonts.js";
import { browserImageDimensionsProbe, type ImageDimensionsProbe } from "./imageProbe.js";
import { checkCropMarksConfig, checkCropMarksGeometry } from "./cropMarksChecks.js";
import { checkSafeAreaConfig, checkSafeAreaForPage } from "./safeAreaChecks.js";
import { checkCutPathForPage } from "./cutPathChecks.js";
import { checkImpositionConfig, checkImpositionForPage } from "./impositionChecks.js";
import type { PreflightIssue, PreflightResult } from "./types.js";

export interface RunPreflightOptions {
  resolver: ExportAssetResolver;
  fontChecker?: FontChecker;
  imageProbe?: ImageDimensionsProbe;
  memoryBudgetBytes?: number;
  /** Fase 9.5 (hardening) — Preflight puede recorrer muchas páginas/objects
   * con I/O real (`resolver.resolve`/`imageProbe.measure`/`fontChecker.check`)
   * por cada uno; antes de este campo, un `signal` abortado durante una
   * corrida de Preflight en un documento grande no tenía efecto hasta que
   * TODO Preflight terminara — el único punto de cancelación cooperativa
   * que faltaba en todo el pipeline (ver `throwIfAborted`, `errors.ts`). */
  signal?: AbortSignal;
}

function findPage(project: Project, pageId: string): Page | undefined {
  return project.document.pages.find((page) => page.id === pageId);
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Preflight Engine puro (sección 13) — Fase 9.1: validaciones
 * ESTRUCTURALES (dimensiones, bleed, escala, assets, resolución, fuentes,
 * presupuesto de memoria). Deliberadamente NO incluye todavía: validez de
 * cut path (Fase 9.3), invasión de safe area (Fase 9.3), fondo que no
 * cubre bleed (Fase 9.3), transparencia no soportada por el perfil (Fase
 * 9.2), ni imposición que no cabe (Fase 9.4) — cada una se agrega en su
 * propia fase sobre esta misma estructura.
 *
 * Orden determinista: `printJob.pageIds` en su propio orden; dentro de
 * cada página, `layers` y `objects` en el orden natural del array (nunca
 * `Set`/`Map`) — el mismo input produce siempre la misma lista de issues
 * en el mismo orden (sección 2: resultados deterministas).
 */
export async function runPreflight(
  project: Project,
  printJob: PrintJob,
  options: RunPreflightOptions,
): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const fontChecker = options.fontChecker ?? browserFontChecker;
  const imageProbe = options.imageProbe ?? browserImageDimensionsProbe;

  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    issues.push({
      code: "document_not_normalized",
      severity: "error",
      message: "El proyecto no pasa la validación del Document Schema — no se puede exportar de forma confiable.",
      data: { issues: parsed.error.issues.map((issue) => issue.message) },
      recommendation: "Abre y vuelve a guardar el proyecto; si el problema persiste, contacta soporte.",
    });
    return { issues, hasBlockingErrors: true };
  }

  const { width: trimWidth, height: trimHeight, unit: trimUnit } = printJob.dimensions;
  if (!isFiniteNumber(trimWidth) || !isFiniteNumber(trimHeight) || trimWidth <= 0 || trimHeight <= 0) {
    issues.push({
      code: "invalid_dimensions",
      severity: "error",
      message: `El tamaño final (${trimWidth}×${trimHeight}${trimUnit}) no es válido — debe ser un número positivo y finito.`,
      recommendation: "Corrige el ancho/alto del Print Job antes de continuar.",
    });
  }

  const { top, right, bottom, left } = printJob.bleed;
  const bleedValues = { top, right, bottom, left };
  for (const [side, value] of Object.entries(bleedValues)) {
    if (!isFiniteNumber(value) || value < 0) {
      issues.push({
        code: "invalid_bleed",
        severity: "error",
        message: `El sangrado del lado "${side}" (${value}) no es válido — debe ser un número finito, nunca negativo.`,
        recommendation: "Corrige el valor de sangrado antes de continuar.",
      });
    }
  }

  if (!isFiniteNumber(printJob.scale) || printJob.scale <= 0) {
    issues.push({
      code: "extreme_scale",
      severity: "error",
      message: `La escala (${printJob.scale}) no es válida — debe ser un número positivo y finito.`,
      recommendation: "Corrige la escala del Print Job antes de continuar.",
    });
  } else if (printJob.scale < 0.01 || printJob.scale > 100) {
    issues.push({
      code: "extreme_scale",
      severity: "warning",
      message: `La escala (${printJob.scale}) es extrema — revisa que sea intencional antes de exportar.`,
      recommendation: "Verifica el valor de escala; un valor tan extremo suele ser un error de tipeo.",
    });
  }

  // Presupuesto de memoria — depende solo de la geometría del PrintJob
  // (MediaBox + resolución), no del contenido de cada página. Conservador:
  // asume todas las páginas simultáneamente en memoria (ver `memory.ts`,
  // corrección 8) — una futura implementación por streaming podría
  // relajar esto sin cambiar este chequeo.
  if (isFiniteNumber(trimWidth) && isFiniteNumber(trimHeight) && trimWidth > 0 && trimHeight > 0) {
    const boxes = computeBoxes(printJob.dimensions, printJob.bleed, printJob.safeArea, printJob.cropMarks);
    const canvasWidthPx = physicalToPixels(boxes.media.width, boxes.media.unit, printJob.resolution.targetPpi);
    const canvasHeightPx = physicalToPixels(boxes.media.height, boxes.media.unit, printJob.resolution.targetPpi);
    const memoryInput: MemoryEstimateInput = {
      canvasWidthPx,
      canvasHeightPx,
      simultaneousPages: Math.max(1, printJob.pageIds.length),
    };
    const estimate = estimateMemoryBytes(memoryInput, options.memoryBudgetBytes);
    if (!estimate.withinBudget) {
      issues.push({
        code: "raster_too_large",
        severity: "error",
        message: `El tamaño estimado (${Math.round(canvasWidthPx)}×${Math.round(canvasHeightPx)}px a ${printJob.resolution.targetPpi} PPI) excede el presupuesto de memoria seguro.`,
        data: { canvasWidthPx, canvasHeightPx, estimatedBytes: estimate.totalEstimatedBytes, budgetBytes: estimate.budgetBytes },
        recommendation: "Reduce la resolución objetivo o exporta por páginas separadas.",
      });
    }
  }

  const warnBelowPpi = printJob.resolution.warnBelowPpi ?? printJob.resolution.targetPpi * (2 / 3);

  // Crop marks y safe area son configuración a nivel de JOB (no dependen
  // del contenido de una página en particular) — se validan una sola vez.
  // La geometría de marcas solo se verifica si la configuración ya es
  // válida (sección 3-5 del enunciado de Fase 9.3, ver ADR-0023).
  const cropMarksConfigIssues = checkCropMarksConfig(printJob);
  issues.push(...cropMarksConfigIssues);
  if (cropMarksConfigIssues.length === 0) {
    issues.push(...checkCropMarksGeometry(printJob));
  }
  issues.push(...checkSafeAreaConfig(printJob));
  issues.push(...checkImpositionConfig(printJob));

  for (const pageId of printJob.pageIds) {
    throwIfAborted(options.signal, "preflight-page");
    const page = findPage(project, pageId);
    if (!page) {
      issues.push({
        code: "page_not_found",
        severity: "error",
        message: `El Print Job referencia una página ("${pageId}") que ya no existe en el documento.`,
        pageId,
        recommendation: "Quita esa página del Print Job o vuelve a abrir el proyecto.",
      });
      continue;
    }

    // Safe area (invasión por object) y cut path SÍ dependen del
    // contenido de cada página — se recalculan por página, nunca se
    // reutiliza el resultado de la primera (sección 24, multipágina).
    issues.push(...checkSafeAreaForPage(page, pageId, printJob));
    issues.push(...checkCutPathForPage(page, pageId, printJob));
    issues.push(...checkImpositionForPage(pageId, printJob, options.memoryBudgetBytes));

    let visibleObjectCount = 0;
    for (const layer of page.layers) {
      if (!layer.metadata.visible) continue;
      for (const object of layer.objects) {
        if (!object.metadata.visible) continue;
        visibleObjectCount += 1;
        throwIfAborted(options.signal, "preflight-object");

        if (object.type === "image") {
          const assetExists = project.document.assets.some((asset) => asset.id === object.assetId);
          if (!assetExists) {
            issues.push({
              code: "asset_reference_missing",
              severity: "error",
              message: `Un object referencia un Asset ("${object.assetId}") que ya no existe en la Biblioteca de Assets.`,
              pageId,
              objectId: object.id,
              data: { assetId: object.assetId },
              recommendation: "Reemplaza la imagen o elimina el object antes de exportar para producción.",
            });
            continue;
          }
          // `resolver.resolve` es I/O real provisto por el caller (Fase 9.5,
          // bug real encontrado): un rechazo (no solo un `undefined`) nunca
          // estaba contemplado — se propagaba crudo fuera de `runPreflight`,
          // interrumpiendo Preflight entero en vez de reportarse como el
          // mismo issue estructurado que ya existe para "no se encontró el
          // archivo". Desde la perspectiva de Preflight, un resolver que
          // falla es indistinguible de uno que no encuentra el archivo.
          let blob: Blob | undefined;
          try {
            blob = await options.resolver.resolve(object.assetId);
          } catch {
            blob = undefined;
          }
          if (!blob) {
            issues.push({
              code: "asset_binary_missing",
              severity: "error",
              message: `No se encontró el archivo de una imagen ("${object.assetId}") en la Biblioteca de Assets.`,
              pageId,
              objectId: object.id,
              data: { assetId: object.assetId },
              recommendation: "Vuelve a subir la imagen antes de exportar para producción.",
            });
            continue;
          }
          const dimensions = await imageProbe.measure(blob);
          if (dimensions) {
            const renderedWidthCanonicalPx = object.size.width * printJob.scale;
            const renderedWidthInches = renderedWidthCanonicalPx / 96;
            const effectivePpi = renderedWidthInches > 0 ? dimensions.width / renderedWidthInches : Infinity;
            if (isFiniteNumber(effectivePpi) && effectivePpi < warnBelowPpi) {
              const critical = effectivePpi < warnBelowPpi * 0.5;
              issues.push({
                code: critical ? "resolution_insufficient" : "resolution_borderline",
                severity: critical ? "warning" : "info",
                message: `Una imagen tiene una resolución efectiva de ~${Math.round(effectivePpi)} PPI (objetivo: ${printJob.resolution.targetPpi} PPI) — podría verse pixelada al imprimir.`,
                pageId,
                objectId: object.id,
                data: { effectivePpi, targetPpi: printJob.resolution.targetPpi },
                recommendation: "Usa una imagen de mayor resolución o reduce su tamaño en el diseño.",
              });
            }
          }
        }

        if (object.type === "text") {
          const availability = await fontChecker.check(object.fontFamily);
          if (availability === "unavailable") {
            issues.push({
              code: "font_unavailable",
              severity: "warning",
              message: `La fuente "${object.fontFamily}" no está disponible — el navegador usará una fuente de reemplazo.`,
              pageId,
              objectId: object.id,
              data: { fontFamily: object.fontFamily },
              recommendation: "Revisa el preview visual antes de exportar, o cambia la fuente por una disponible.",
            });
          } else if (availability === "verification-uncertain") {
            issues.push({
              code: "font_verification_uncertain",
              severity: "info",
              message: `No se pudo confirmar con certeza si la fuente "${object.fontFamily}" está disponible.`,
              pageId,
              objectId: object.id,
              data: { fontFamily: object.fontFamily },
              recommendation: "Revisa el preview visual — es la forma más confiable de verificarlo.",
            });
          }
        }
      }
    }

    if (visibleObjectCount === 0) {
      issues.push({
        code: "empty_page",
        severity: "warning",
        message: "Esta página no tiene ningún object visible — se exportará en blanco.",
        pageId,
        recommendation: "Confirma que sea intencional antes de exportar.",
      });
    }
  }

  return { issues, hasBlockingErrors: issues.some((issue) => issue.severity === "error") };
}
