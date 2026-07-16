/**
 * Formato de folios (docs/ARCHITECTURE.md §7.1). Funciones puras: no tocan
 * la base de datos ni deciden el consecutivo — solo dan forma al string una
 * vez que `issueFolio()` (sequence.ts) ya reservó el numero.
 */

export function padConsecutive(consecutive: number, width = 4): string {
  return String(consecutive).padStart(width, "0");
}

/** TSS-2026-07-0001-KS */
export function formatLongFolio(input: {
  lineCode: string;
  year: number;
  month: number;
  consecutive: number;
  sellerCode: string;
}): string {
  const month = String(input.month).padStart(2, "0");
  return `${input.lineCode}-${input.year}-${month}-${padConsecutive(input.consecutive)}-${input.sellerCode}`;
}

/** TSS-2607-0001 (AAMM = año y mes de 2 digitos cada uno) */
export function formatShortFolio(input: {
  lineCode: string;
  year: number;
  month: number;
  consecutive: number;
}): string {
  const yy = String(input.year).slice(-2);
  const mm = String(input.month).padStart(2, "0");
  return `${input.lineCode}-${yy}${mm}-${padConsecutive(input.consecutive)}`;
}

/** PED-TSS-2026-0001 — serie independiente de la de cotizaciones. */
export function formatOrderFolio(input: { lineCode: string; year: number; consecutive: number }): string {
  return `PED-${input.lineCode}-${input.year}-${padConsecutive(input.consecutive)}`;
}

/**
 * TSS-2026-07-0001-KS -> TSS-2026-07-0001-KS-V2. El folio raiz nunca cambia:
 * cualquier edicion posterior al envio solo le agrega el sufijo de version
 * (docs/ARCHITECTURE.md §7.3).
 */
export function appendVersion(folio: string, versionNumber: number): string {
  return `${folio}-V${versionNumber}`;
}

/**
 * Folio tal como debe mostrarse (docs/ARCHITECTURE.md §7.3, Módulo 8): la
 * versión 1 (la original, nunca editada tras enviarse) se muestra sin
 * sufijo — es el mismo folio que ya se probó/mostró en los Módulos 6 y 9,
 * sin romper esas pantallas. El sufijo `-V{n}` solo aparece a partir de la
 * primera edición posterior al envío (versión 2 en adelante).
 */
export function displayFolio(folio: string, currentVersion: number): string {
  return currentVersion > 1 ? appendVersion(folio, currentVersion) : folio;
}
