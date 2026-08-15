import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(dateStr: string) {
  return format(parseISO(dateStr), "d 'de' MMMM yyyy", { locale: es });
}

export function formatDateShort(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy");
}

export function formatDateTime(dateStr: string) {
  return format(parseISO(dateStr), "d MMM yyyy, HH:mm", { locale: es });
}

const UNIT_LABEL: Record<string, string> = { m: "m", cm: "cm", pies: "pies" };

export function formatMeasure(value: number | null | undefined, unit: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const unitLabel = unit ? UNIT_LABEL[unit] ?? unit : "";
  return `${value} ${unitLabel}`.trim();
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Conteos del Dashboard (pedidos, clientes, etc.) — sin cifras monetarias: GS Orders no tiene ningún campo de precio/monto hoy. */
export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value);
}

/**
 * Variación porcentual entre dos conteos (ej. pedidos de este mes vs mes
 * anterior). Devuelve null cuando no hay una base contra la cual comparar
 * (mes anterior en cero) — mostrar "+∞%" sería engañoso, así que ese caso
 * se maneja aparte en la UI.
 */
export function formatPercentDelta(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
}
