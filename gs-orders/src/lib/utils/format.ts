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
