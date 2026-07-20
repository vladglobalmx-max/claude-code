/**
 * Estimación de memoria (sección 21 del enunciado, corrección 8): NUNCA
 * usar únicamente `width × height × 4` (RGBA crudo) como presupuesto total
 * — eso ignora el canvas de composición final, los buffers temporales de
 * decodificación/codificación, y páginas simultáneas en memoria a la vez.
 * Se usa como BASE y se le aplica un overhead documentado.
 *
 * Fase 9.2 (sección 14 del enunciado) amplía el modelo, de forma aditiva,
 * con: cache de Assets ya decodificados (`cachedImageBytes`) y una
 * categoría de riesgo de 3 niveles (`riskLevel`) en vez de un único
 * booleano — sin cambiar el cálculo de `totalEstimatedBytes`/`withinBudget`
 * ya usado por Preflight (Fase 9.1) cuando estos campos nuevos no se
 * proveen (quedan en 0 por defecto).
 */
export interface MemoryEstimateInput {
  canvasWidthPx: number;
  canvasHeightPx: number;
  /**
   * Cuántas instancias de esta pieza están en memoria SIMULTÁNEAMENTE —
   * normalmente 1. La imposición (Fase 9.4) debe reutilizar UNA pieza
   * rasterizada y componerla N veces sobre el canvas final (corrección 8:
   * "no volver a renderizar el mismo diseño N veces") — eso mantiene este
   * valor en 1 incluso con una hoja de muchas copias; el propio canvas
   * final de composición ya está cubierto por `OVERHEAD_FACTOR`, no por
   * este campo.
   */
  simultaneousPages?: number;
  /**
   * Bytes ya ocupados por el cache de imágenes decodificadas de la
   * exportación en curso (Fase 9.2, ver `assetImageCache.ts`) — se suman
   * al total SIN aplicarles `MEMORY_OVERHEAD_FACTOR` de nuevo (ya
   * representan memoria real ya reservada, no una proyección). 0 por
   * defecto — compatible con el uso de Fase 9.1 (Preflight), que no
   * conoce ningún cache todavía en ese punto del pipeline.
   */
  cachedImageBytes?: number;
}

export type MemoryRiskLevel = "recommended" | "warning" | "blocking";

export interface MemoryEstimate {
  /** width × height × 4 de una sola pieza — la base, nunca el total. */
  rasterBytes: number;
  /** `rasterBytes × simultaneousPages × OVERHEAD_FACTOR + cachedImageBytes`
   * — la estimación real usada para decidir si se procede o se bloquea. */
  totalEstimatedBytes: number;
  /** `riskLevel !== "blocking"` — se mantiene por compatibilidad con Fase
   * 9.1 (Preflight ya lo consume así). */
  withinBudget: boolean;
  budgetBytes: number;
  /**
   * Fase 9.2: `"recommended"` (holgado, por debajo de
   * `WARNING_THRESHOLD_RATIO` del presupuesto), `"warning"` (grande pero
   * todavía dentro del presupuesto — la operación es posible, se sugiere
   * avisar antes de proceder), `"blocking"` (excede el presupuesto
   * seguro — sección 14: "no intentar renderizar para 'ver si funciona'").
   */
  riskLevel: MemoryRiskLevel;
}

/**
 * ~256MB — presupuesto conservador para un solo canvas en un navegador de
 * escritorio típico (`HTMLCanvasElement` tiene límites prácticos bastante
 * por debajo de la memoria total del sistema, y varían por navegador). No
 * es una medición exacta de ESTE proyecto — es un punto de partida
 * documentado, ajustable si la evidencia real (Fase 9.5, Hardening) lo
 * justifica.
 */
export const DEFAULT_MEMORY_BUDGET_BYTES = 256 * 1024 * 1024;

/**
 * Multiplicador sobre el raster RGBA crudo — cubre, sin medirlos por
 * separado: el canvas de composición final (hasta 1x adicional en el peor
 * caso), buffers temporales de codificación/decodificación de imagen (PNG/
 * JPEG, otro ~0.5x-1x), y overhead general no determinístico del
 * navegador. Documentado como aproximación deliberada — nunca se afirma
 * que sea una medición exacta.
 */
export const MEMORY_OVERHEAD_FACTOR = 2.5;

/** Proporción del presupuesto por debajo de la cual el riesgo se considera
 * `"recommended"` — punto de partida documentado (no una medición de este
 * proyecto), ajustable en Fase 9.5 con evidencia real. */
export const WARNING_THRESHOLD_RATIO = 0.5;

export function estimateMemoryBytes(
  input: MemoryEstimateInput,
  budgetBytes: number = DEFAULT_MEMORY_BUDGET_BYTES,
): MemoryEstimate {
  const rasterBytes = input.canvasWidthPx * input.canvasHeightPx * 4;
  const simultaneousPages = input.simultaneousPages ?? 1;
  const cachedImageBytes = input.cachedImageBytes ?? 0;
  const totalEstimatedBytes = rasterBytes * simultaneousPages * MEMORY_OVERHEAD_FACTOR + cachedImageBytes;
  const withinBudget = totalEstimatedBytes <= budgetBytes;
  const riskLevel: MemoryRiskLevel = !withinBudget
    ? "blocking"
    : totalEstimatedBytes <= budgetBytes * WARNING_THRESHOLD_RATIO
      ? "recommended"
      : "warning";
  return {
    rasterBytes,
    totalEstimatedBytes,
    withinBudget,
    budgetBytes,
    riskLevel,
  };
}
