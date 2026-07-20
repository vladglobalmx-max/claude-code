/**
 * Estimación de memoria (sección 21 del enunciado, corrección 8): NUNCA
 * usar únicamente `width × height × 4` (RGBA crudo) como presupuesto total
 * — eso ignora el canvas de composición final, los buffers temporales de
 * decodificación/codificación, y páginas simultáneas en memoria a la vez.
 * Se usa como BASE y se le aplica un overhead documentado.
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
}

export interface MemoryEstimate {
  /** width × height × 4 de una sola pieza — la base, nunca el total. */
  rasterBytes: number;
  /** `rasterBytes × simultaneousPages × OVERHEAD_FACTOR` — la estimación
   * real usada para decidir si se procede o se bloquea. */
  totalEstimatedBytes: number;
  withinBudget: boolean;
  budgetBytes: number;
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

export function estimateMemoryBytes(
  input: MemoryEstimateInput,
  budgetBytes: number = DEFAULT_MEMORY_BUDGET_BYTES,
): MemoryEstimate {
  const rasterBytes = input.canvasWidthPx * input.canvasHeightPx * 4;
  const simultaneousPages = input.simultaneousPages ?? 1;
  const totalEstimatedBytes = rasterBytes * simultaneousPages * MEMORY_OVERHEAD_FACTOR;
  return {
    rasterBytes,
    totalEstimatedBytes,
    withinBudget: totalEstimatedBytes <= budgetBytes,
    budgetBytes,
  };
}
