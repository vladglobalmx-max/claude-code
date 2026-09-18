import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * Clasificador de vencimiento genérico para el dashboard de Inicio por rol
 * (0084) — Cotizaciones (`valid_until`), Órdenes de Compra (`required_date`),
 * Facturas (`due_date`). Deliberadamente SEPARADO de
 * `lib/dashboard/due-dates.ts` (que sigue siendo exclusivo de Pedidos/
 * `OrderOperationalStatus`, usado también fuera del dashboard en
 * /pedidos — no se toca): esta versión no depende de ningún estado
 * operativo, solo compara una fecha simple contra "hoy". Mismo concepto
 * que `classifyDueDateStatus` (vencido/próximo a vencer/en tiempo), sin
 * acoplarlo al dominio de Pedidos.
 */
export type PipelineDueDateStatus = "en_tiempo" | "proximo_a_vencer" | "vencido";

/** Ventana de "próximo a vencer": vence hoy o dentro de los próximos 3 días. */
export const PIPELINE_DUE_SOON_THRESHOLD_DAYS = 3;

export function classifyPipelineDueDate(dueDate: string, now: Date): PipelineDueDateStatus {
  const daysUntilDue = differenceInCalendarDays(parseISO(dueDate), now);
  if (daysUntilDue < 0) return "vencido";
  if (daysUntilDue <= PIPELINE_DUE_SOON_THRESHOLD_DAYS) return "proximo_a_vencer";
  return "en_tiempo";
}

/**
 * Texto corto para la sección "Requiere atención" — "Vencida hace N días" /
 * "Vence hoy" / "Vence en N días". Nunca dice "en tiempo" aquí: solo se usa
 * para ítems que ya calificaron como próximos a vencer o vencidos.
 */
export function formatDueInDays(dueDate: string, now: Date): string {
  const days = differenceInCalendarDays(parseISO(dueDate), now);
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoy";
  return `Vence en ${days} día${days === 1 ? "" : "s"}`;
}
