import type { PageId } from "@impulso/document-schema";
import { convertUnit, physicalToPixels } from "../units.js";
import { estimateMemoryBytes, DEFAULT_MEMORY_BUDGET_BYTES } from "../memory.js";
import { computeImpositionLayout, type ImpositionLayout } from "../imposition/impositionLayout.js";
import { validateImpositionLayoutGeometry } from "../imposition/validateLayoutGeometry.js";
import type { PrintJob } from "../types.js";
import type { PreflightIssue } from "./types.js";

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Valida la CONFIGURACIÓN escalar de `printJob.imposition` (Fase 9.4,
 * sección 16) — gaps/márgenes deben ser números finitos y nunca negativos
 * ANTES de que cualquier geometría (`computeImpositionLayout`) los use en
 * aritmética (un valor `NaN`/negativo ahí produciría resultados
 * silenciosamente incorrectos, nunca un error). `[]` si `mode !== "grid"`
 * (sección 3: la imposición `"single"` no tiene nada que validar aquí).
 *
 * `insufficient_gap` (warning, no error): un gap de 0 es geométricamente
 * válido — el motor de imposición lo acepta y las piezas simplemente
 * quedan a tope entre sí — pero si además hay un cut path vectorial activo
 * con un grosor de línea físico mayor al gap disponible, la línea de corte
 * de una pieza invadiría visualmente a la de al lado. Se avisa, nunca se
 * bloquea (una hoja con piezas a tope es una elección de producto legítima
 * cuando no hay cut path que dibujar).
 */
export function checkImpositionConfig(printJob: PrintJob): PreflightIssue[] {
  const imposition = printJob.imposition;
  if (imposition.mode !== "grid") return [];
  const issues: PreflightIssue[] = [];

  const gaps: Array<["gapX" | "gapY", number]> = [
    ["gapX", imposition.gapX],
    ["gapY", imposition.gapY],
  ];
  for (const [field, value] of gaps) {
    if (!isFiniteNumber(value) || value < 0) {
      issues.push({
        code: "imposition_invalid",
        severity: "error",
        message: `El separador "${field}" de la imposición (${value}) no es válido — debe ser un número finito, nunca negativo.`,
        recommendation: "Corrige el valor de separación entre piezas antes de continuar.",
      });
    }
  }

  const margins: Array<["marginTop" | "marginRight" | "marginBottom" | "marginLeft", number]> = [
    ["marginTop", imposition.marginTop],
    ["marginRight", imposition.marginRight],
    ["marginBottom", imposition.marginBottom],
    ["marginLeft", imposition.marginLeft],
  ];
  for (const [field, value] of margins) {
    if (!isFiniteNumber(value) || value < 0) {
      issues.push({
        code: "imposition_invalid",
        severity: "error",
        message: `El margen "${field}" de la imposición (${value}) no es válido — debe ser un número finito, nunca negativo.`,
        recommendation: "Corrige el valor de margen de la hoja antes de continuar.",
      });
    }
  }

  if (issues.length === 0 && printJob.cutPath.mode !== "none") {
    const strokeInSheetUnit = convertUnit(printJob.cutPath.stroke, printJob.cutPath.unit, imposition.sheet.unit);
    if (imposition.gapX < strokeInSheetUnit || imposition.gapY < strokeInSheetUnit) {
      issues.push({
        code: "insufficient_gap",
        severity: "warning",
        message: "El separador entre piezas es más angosto que el grosor de línea del cut path — las líneas de corte de piezas contiguas podrían visualmente tocarse o superponerse.",
        data: { gapX: imposition.gapX, gapY: imposition.gapY, cutPathStroke: printJob.cutPath.stroke },
        recommendation: "Aumenta el separador entre piezas, o reduce el grosor de línea del cut path.",
      });
    }
  }

  return issues;
}

/**
 * Traduce la geometría de un `ImpositionLayout` YA calculado (nunca lo
 * recalcula) a issues de Preflight — separado de `checkImpositionForPage`
 * para poder probarlo directamente contra un layout construido a mano
 * (mismo criterio que `validateLayoutGeometry.test.ts`: `computeImpositionLayout`
 * nunca produce, por construcción, un layout con piezas solapadas o fuera
 * de hoja, así que ejercer estas ramas de mapeo requiere un layout
 * corrompido deliberadamente, no uno real).
 *
 * `hasOverlap` (de `validateImpositionLayoutGeometry`) cubre honestamente
 * TANTO `cut_paths_overlap` COMO `crop_marks_overlap` con un único chequeo
 * (ver `validateLayoutGeometry.ts`) — se reporta cada código solo si el
 * elemento correspondiente realmente existe en esta imposición
 * (`marksMode === "per-piece"` / `cutPath.mode !== "none"`).
 */
export function mapImpositionLayoutGeometryIssues(layout: ImpositionLayout, printJob: PrintJob, pageId: PageId): PreflightIssue[] {
  if (printJob.imposition.mode !== "grid") return [];
  const issues: PreflightIssue[] = [];

  const geometryIssues = validateImpositionLayoutGeometry(layout);
  const hasOverlap = geometryIssues.some((issue) => issue.code === "footprints_overlap");
  const hasOutsideSheet = geometryIssues.some((issue) => issue.code === "piece_outside_sheet");

  if (hasOutsideSheet) {
    issues.push({
      code: "piece_outside_sheet",
      severity: "error",
      pageId,
      message: "Alguna pieza de la imposición calculada cae fuera de los límites físicos de la hoja.",
      recommendation: "Reporta este problema — indica una inconsistencia interna en el cálculo de imposición.",
    });
  }
  if (hasOverlap) {
    if (printJob.imposition.mode === "grid" && printJob.imposition.marksMode === "per-piece") {
      issues.push({
        code: "crop_marks_overlap",
        severity: "error",
        pageId,
        message: "Las marcas de corte por pieza de copias contiguas se solapan entre sí.",
        recommendation: "Reporta este problema — indica una inconsistencia interna en el cálculo de imposición.",
      });
    }
    if (printJob.cutPath.mode !== "none") {
      issues.push({
        code: "cut_paths_overlap",
        severity: "error",
        pageId,
        message: "Los cut paths de copias contiguas se solapan entre sí.",
        recommendation: "Reporta este problema — indica una inconsistencia interna en el cálculo de imposición.",
      });
    }
  }

  return issues;
}

/**
 * Valida la IMPOSICIÓN calculada de UNA página (Fase 9.4, sección 16) —
 * corre `computeImpositionLayout` (la MISMA función pura que usan los
 * exportadores, nunca una segunda implementación) y traduce su resultado
 * a issues de Preflight. `[]` si `mode !== "grid"`.
 *
 * Cuando el layout SÍ es válido, además corre `mapImpositionLayoutGeometryIssues`
 * — una red de seguridad que nunca debería producir issues en la práctica
 * (sección 18) — y verifica el presupuesto de memoria de la HOJA completa
 * (nunca solo el de una pieza, que ya cubre `raster_too_large` en
 * `runPreflight`; una hoja de imposición puede ser mucho más grande que
 * cualquier pieza individual).
 */
export function checkImpositionForPage(pageId: PageId, printJob: PrintJob, memoryBudgetBytes?: number): PreflightIssue[] {
  if (printJob.imposition.mode !== "grid") return [];

  const result = computeImpositionLayout(printJob, pageId);
  if (!result.ok) {
    return [
      {
        code: result.reason,
        severity: "error",
        pageId,
        message: `La imposición de esta página no es válida (${result.reason}).`,
        recommendation: "Revisa el tamaño de hoja, la cantidad, los márgenes/gaps y el modo de colocación de la imposición.",
      },
    ];
  }

  const { layout } = result;
  const issues = mapImpositionLayoutGeometryIssues(layout, printJob, pageId);

  const sheetWidthPx = physicalToPixels(layout.sheet.width, layout.unit, printJob.resolution.targetPpi);
  const sheetHeightPx = physicalToPixels(layout.sheet.height, layout.unit, printJob.resolution.targetPpi);
  // `simultaneousPages: 1` — la imposición reutiliza UNA pieza rasterizada
  // y la compone N veces sobre el canvas de la hoja (ver `memory.ts`); el
  // propio canvas de la hoja ya queda cubierto por `MEMORY_OVERHEAD_FACTOR`.
  const estimate = estimateMemoryBytes({ canvasWidthPx: sheetWidthPx, canvasHeightPx: sheetHeightPx, simultaneousPages: 1 }, memoryBudgetBytes ?? DEFAULT_MEMORY_BUDGET_BYTES);
  if (!estimate.withinBudget) {
    issues.push({
      code: "sheet_memory_budget_exceeded",
      severity: "error",
      pageId,
      message: `El tamaño estimado de la hoja (${Math.round(sheetWidthPx)}×${Math.round(sheetHeightPx)}px a ${printJob.resolution.targetPpi} PPI) excede el presupuesto de memoria seguro.`,
      data: { sheetWidthPx, sheetHeightPx, estimatedBytes: estimate.totalEstimatedBytes, budgetBytes: estimate.budgetBytes },
      recommendation: "Reduce el tamaño de hoja, la resolución objetivo, o exporta en PNG por hoja en vez de PDF.",
    });
  }

  if (layout.lastSheetEmptyCells > 0) {
    issues.push({
      code: "partial_output_required",
      severity: "info",
      pageId,
      message: `La última hoja quedará parcialmente ocupada: ${layout.lastSheetPieceCount} de ${layout.capacityPerSheet} celdas.`,
      data: { lastSheetPieceCount: layout.lastSheetPieceCount, capacityPerSheet: layout.capacityPerSheet, emptyCells: layout.lastSheetEmptyCells },
    });
  }

  return issues;
}
