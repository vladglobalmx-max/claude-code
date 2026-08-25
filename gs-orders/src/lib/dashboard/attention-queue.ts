import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatNumber } from "@/lib/utils/format";
import type { DueDateStatus } from "@/lib/dashboard/due-dates";
import type { OrderOperationalStatus } from "@/types/domain";

/**
 * THÖREN Fase 6I/6J — lógica pura del seguimiento operativo (antigüedad,
 * semáforo, orden de prioridad), separada de get-dashboard-data.ts y de
 * pedidos/page.tsx (que hacen los fetches a Supabase) para poder probarla
 * con Vitest sin mockear la base de datos — mismo criterio que
 * quote-totals.ts/folio-preview.ts en este proyecto. Fase 6J la extendió
 * para que sea la ÚNICA fuente de verdad de cálculo de días/nivel/orden,
 * reutilizada tanto por el Dashboard ("Requieren atención") como por el
 * listado de Pedidos (columna Seguimiento + filtro de atención) — pedido
 * explícito del usuario, no crear una segunda implementación.
 */

/**
 * THÖREN Fase 6I — los 8 valores de operational_status (0033), en el orden
 * de la línea de tiempo del pedido. 'completado'/'cancelado' son las
 * salidas del pipeline — todo lo demás cuenta como "activo" para la
 * sección "Requieren atención" y para el semáforo de antigüedad (Fase 6J
 * §1: un pedido completado/cancelado nunca se considera atrasado).
 */
export const OPERATIONAL_STATUSES: OrderOperationalStatus[] = [
  "pedido",
  "en_proceso",
  "ordenado_a_proveedor",
  "en_transito",
  "recibido",
  "programado_entrega_instalacion",
  "completado",
  "cancelado",
];
export const ACTIVE_OPERATIONAL_STATUSES = OPERATIONAL_STATUSES.filter((s) => s !== "completado" && s !== "cancelado");

export function buildOperationalStatusBreakdown(
  statuses: OrderOperationalStatus[]
): Record<OrderOperationalStatus, number> {
  const breakdown: Record<OrderOperationalStatus, number> = {
    pedido: 0,
    en_proceso: 0,
    ordenado_a_proveedor: 0,
    en_transito: 0,
    recibido: 0,
    programado_entrega_instalacion: 0,
    completado: 0,
    cancelado: 0,
  };
  for (const status of statuses) {
    breakdown[status] = (breakdown[status] ?? 0) + 1;
  }
  return breakdown;
}

/**
 * THÖREN Fase 6J — semáforo de antigüedad. Solo tiene sentido para un
 * pedido activo (ver ACTIVE_OPERATIONAL_STATUSES en get-dashboard-data.ts
 * — completado/cancelado nunca deben clasificarse como atrasados,
 * requisito explícito de esta fase): esta función es intencionalmente
 * ciega a operational_status — quien la llame decide si corresponde
 * clasificar o no según el estado del pedido.
 */
export type AttentionLevel = "normal" | "atencion" | "critico";

export function classifyAttentionLevel(daysInStatus: number): AttentionLevel {
  if (daysInStatus >= 6) return "critico";
  if (daysInStatus >= 3) return "atencion";
  return "normal";
}

/** Etiquetas del semáforo — usadas tanto por el Dashboard como por el listado de Pedidos (Fase 6J §5, una sola fuente). */
export const ATTENTION_LEVEL_LABELS: Record<AttentionLevel, string> = {
  normal: "Normal",
  atencion: "Atención",
  critico: "Crítico",
};

/** Color del punto del indicador discreto — mismos tokens ya usados en el resto de la app (bg-warning/bg-danger), sin dependencias nuevas. */
export const ATTENTION_LEVEL_DOT_COLOR: Record<AttentionLevel, string> = {
  normal: "bg-ink-faint",
  atencion: "bg-warning",
  critico: "bg-danger",
};

/** Calendario, no reloj — "3 días" significa 3 fechas distintas, sin importar la hora exacta del cambio. Nunca negativo (defensivo ante un reloj de cliente ligeramente adelantado). */
export function calculateDaysInStatus(lastChangedAt: string, now: Date): number {
  return Math.max(0, differenceInCalendarDays(now, parseISO(lastChangedAt)));
}

/** "1 día" / "N días" — una sola fuente para el singular/plural, usada por el Dashboard y por el listado de Pedidos (Fase 6J §5). */
export function formatDaysInStatus(days: number): string {
  return days === 1 ? "1 día" : `${formatNumber(days)} días`;
}

/**
 * A partir de las filas de order_operational_status_history de un conjunto
 * de pedidos (ORDENADAS por changed_at DESCENDENTE), arma un mapa
 * order_id -> fecha del cambio más reciente. La primera ocurrencia por
 * order_id ya es la más reciente gracias al orden de entrada.
 */
export function buildLatestChangeMap(historyRows: { order_id: string; changed_at: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of historyRows) {
    if (!map.has(row.order_id)) map.set(row.order_id, row.changed_at);
  }
  return map;
}

export interface AttentionQueueSourceRow {
  id: string;
  folio: string;
  clientName: string;
  businessUnitName: string;
  salespersonName: string;
  operationalStatus: OrderOperationalStatus;
  /**
   * THÖREN Fase 6K — vencimiento contra la fecha compromiso relevante (ver
   * lib/dashboard/due-dates.ts). null = sin fecha relevante capturada
   * todavía (nunca se inventa un vencimiento). Solo afecta el orden de
   * prioridad cuando vale 'vencido' — ver DECISIÓN de buildAttentionQueue.
   */
  dueDateStatus: DueDateStatus | null;
}

export interface AttentionQueueRow extends AttentionQueueSourceRow {
  lastChangedAt: string;
  daysInStatus: number;
  attentionLevel: AttentionLevel;
}

/**
 * Prioridad combinada final (Fase 6K — AJUSTE FINAL, confirmada por el
 * usuario), un único orden total de 5 niveles que entrelaza vencimiento y
 * antigüedad — NO son dos ejes independientes:
 *   1) Vencido (sin importar el nivel de antigüedad)
 *   2) Crítico por antigüedad (que no esté ya Vencido)
 *   3) Próximo a vencer (que no sea ya Crítico)
 *   4) Atención por antigüedad
 *   5) Normal
 * 'sin_fecha'/'en_tiempo'/null (estado sin concepto de vencimiento) no
 * alteran el orden — el pedido se ubica solo por su nivel de antigüedad.
 */
function combinedPriority(row: { dueDateStatus: DueDateStatus | null; attentionLevel: AttentionLevel }): number {
  if (row.dueDateStatus === "vencido") return 0;
  if (row.attentionLevel === "critico") return 1;
  if (row.dueDateStatus === "proximo_a_vencer") return 2;
  if (row.attentionLevel === "atencion") return 3;
  return 4;
}

/**
 * Cruza pedidos activos con la fecha del cambio de operational_status más
 * reciente por pedido (order_operational_status_history, 0033), calcula el
 * semáforo de antigüedad y ordena por la prioridad combinada de arriba;
 * dentro de cada nivel, el que lleve más días en su estado actual va
 * primero. Un pedido sin entrada en `latestChangeByOrder` se descarta
 * (defensivo: el trigger 0033 siempre debería dejar al menos una fila,
 * pero nunca se inventa una fecha).
 */
export function buildAttentionQueue(
  rows: AttentionQueueSourceRow[],
  latestChangeByOrder: Map<string, string>,
  now: Date,
  limit: number
): AttentionQueueRow[] {
  return rows
    .map((row) => {
      const lastChangedAt = latestChangeByOrder.get(row.id);
      if (!lastChangedAt) return null;
      const daysInStatus = calculateDaysInStatus(lastChangedAt, now);
      return {
        ...row,
        lastChangedAt,
        daysInStatus,
        attentionLevel: classifyAttentionLevel(daysInStatus),
      };
    })
    .filter((row): row is AttentionQueueRow => row !== null)
    .sort((a, b) => {
      const priorityDiff = combinedPriority(a) - combinedPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return b.daysInStatus - a.daysInStatus;
    })
    .slice(0, limit);
}
