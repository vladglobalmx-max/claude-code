import { sanitizeFilename } from "@impulso/export-engine";
import type { PrintProfileId } from "./types.js";

export interface PrintFilenameOptions {
  projectName: string;
  profile: PrintProfileId;
  /** 1-based — se omite del nombre si `pageCount <= 1` (un solo archivo no
   * necesita numerarse). */
  pageIndex?: number;
  pageCount: number;
  /** Palabra usada antes del número (`"page-01"` vs `"sheet-01"`) — Fase
   * 9.4: un PNG imposicionado numera HOJAS, no páginas de origen; el
   * default preserva el naming ya usado desde Fase 9.2. */
  label?: "page" | "sheet";
  /** Instant ISO inyectable — mismo patrón que el resto del código
   * (`ProjectSaveCoordinator`, `createPrintJob`), nunca `Date.now()`
   * directo dentro de esta función pura. */
  date: string;
  extension: "pdf" | "png";
}

/**
 * Naming determinista (sección 23): `nombre-proyecto_perfil_page-01_fecha.ext`.
 * Reutiliza `sanitizeFilename` de `@impulso/export-engine` (Epic 3) para
 * los caracteres inválidos — no se reimplementa esa lógica aquí.
 *
 * Duplicados: esta función es pura y determinista — dos llamadas con los
 * MISMOS argumentos producen el MISMO nombre a propósito (para que la
 * verificación de tests/E2E sea predecible). La resolución de duplicados
 * reales en disco (ej. exportar dos veces en el mismo segundo) es
 * responsabilidad del navegador al descargar (ya agrega "(1)", mismo
 * comportamiento ya aceptado desde Epic 3) — no de esta función pura.
 */
export function buildPrintFilename(options: PrintFilenameOptions): string {
  const nameParts = [sanitizeFilename(options.projectName), options.profile];

  if (options.pageCount > 1 && options.pageIndex !== undefined) {
    nameParts.push(`${options.label ?? "page"}-${String(options.pageIndex).padStart(2, "0")}`);
  }

  const datePart = options.date.slice(0, 10);
  if (datePart.length > 0) nameParts.push(datePart);

  return `${nameParts.join("_")}.${options.extension}`;
}
