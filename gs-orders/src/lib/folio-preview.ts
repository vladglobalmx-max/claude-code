/**
 * Estimación de folio mostrada en el formulario mientras se captura el
 * pedido (el folio real y definitivo siempre lo asigna la base de datos —
 * ver supabase/migrations/0002_folio.sql — esto es solo una vista previa).
 *
 * Formato: PREFIJO-AAAADDMM-CONSECUTIVO (año + día + mes, NO año-mes-día).
 */
export function computeFolioPreview(
  prefix: string | null | undefined,
  sequenceCurrent: number | null | undefined,
  isoDate: string | null | undefined
): string | null {
  if (!prefix || !isoDate) return null;

  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day || year.length !== 4 || month.length !== 2 || day.length !== 2) return null;

  const next = (sequenceCurrent ?? 0) + 1;
  return `${prefix}-${year}${day}${month}-${String(next).padStart(3, "0")}`;
}
