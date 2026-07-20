import { toPixels, type Page, type PageId } from "@impulso/document-schema";
import { checkSafeAreaInvasions } from "../safearea/safeAreaCheck.js";
import { computeSafeAreaCanonicalRect } from "../safearea/safeAreaRect.js";
import type { PrintJob } from "../types.js";
import type { PreflightIssue } from "./types.js";

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** Valida la CONFIGURACIÓN de `printJob.safeArea` (Fase 9.3, sección 8). */
export function checkSafeAreaConfig(printJob: PrintJob): PreflightIssue[] {
  if (!printJob.safeArea.enabled) return [];
  const { margin } = printJob.safeArea;
  if (!isFiniteNumber(margin) || margin < 0) {
    return [
      {
        code: "safe_area_invalid",
        severity: "error",
        message: `El margen de safe area (${margin}) no es válido — debe ser un número finito, nunca negativo.`,
        recommendation: "Corrige el margen de safe area antes de continuar.",
      },
    ];
  }
  return [];
}

/**
 * Detecta objects que invaden el safe area de UNA página (Fase 9.3,
 * sección 8) — siempre `warning`, nunca bloquea la exportación. Política
 * conservadora (sección 9): todos los objects visibles no-die-line
 * participan, un `group` cuenta como una sola unidad.
 */
export function checkSafeAreaForPage(page: Page, pageId: PageId, printJob: PrintJob): PreflightIssue[] {
  if (!printJob.safeArea.enabled) return [];
  const safeAreaRect = computeSafeAreaCanonicalRect(printJob);
  if (!safeAreaRect) return [];

  const trimWidthPx = toPixels(printJob.dimensions.width, printJob.dimensions.unit);
  const trimHeightPx = toPixels(printJob.dimensions.height, printJob.dimensions.unit);
  const invasions = checkSafeAreaInvasions(page, trimWidthPx, trimHeightPx, safeAreaRect);

  return invasions.map((invasion) => ({
    code: "object_crosses_safe_area" as const,
    severity: "warning" as const,
    message: "Un object cruza el límite del safe area — podría recortarse o quedar muy cerca del borde de corte real. Si es un fondo decorativo grande, esto puede ser intencional.",
    pageId,
    objectId: invasion.objectId,
    data: { boundingBox: invasion.boundingBox, safeAreaRect },
    recommendation: "Revisa el preview técnico; mueve el object hacia adentro si su contenido importante queda cerca del borde.",
  }));
}
