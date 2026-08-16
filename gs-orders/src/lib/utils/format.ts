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

/** Conteos del Dashboard (pedidos, clientes, etc.) — nunca cifras monetarias. */
export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX").format(value);
}

/**
 * Precio sugerido de product_catalog (ver 0019_core_product_catalog_pricing.sql)
 * — nunca un total ni un monto de cotización real: THÖREN Quotes aún no
 * existe. MXN/USD se formatean por separado, sin conversión entre sí.
 */
export function formatMoneyMxn(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export function formatMoneyUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/**
 * THÖREN Quotes Q4 — monto real de una Quote en su propia moneda (a
 * diferencia de formatMoneyMxn/formatMoneyUsd, que hoy solo formatean el
 * precio sugerido del catálogo). Sin conversión entre monedas: cada Quote
 * vive únicamente en la moneda con la que se creó.
 */
export function formatMoneyByCurrency(value: number, currency: "MXN" | "USD") {
  return currency === "USD" ? formatMoneyUsd(value) : formatMoneyMxn(value);
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
