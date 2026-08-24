import { differenceInCalendarDays, parseISO } from "date-fns";
import type { OrderOperationalStatus } from "@/types/domain";

/**
 * THÖREN Fase 6I — lógica pura del Dashboard operativo, separada de
 * get-dashboard-data.ts (que hace los fetches a Supabase) para poder
 * probarla con Vitest sin mockear la base de datos — mismo criterio que
 * quote-totals.ts/folio-preview.ts en este proyecto.
 */

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

export interface AttentionQueueSourceRow {
  id: string;
  folio: string;
  clientName: string;
  businessUnitName: string;
  salespersonName: string;
  operationalStatus: OrderOperationalStatus;
}

export interface AttentionQueueRow extends AttentionQueueSourceRow {
  lastChangedAt: string;
  daysInStatus: number;
}

/**
 * Cruza pedidos activos con la fecha del cambio de operational_status más
 * reciente por pedido (order_operational_status_history, 0033) y ordena de
 * más antiguo a más reciente en su estado actual — el que lleva más
 * tiempo sin avanzar aparece primero. Un pedido sin entrada en
 * `latestChangeByOrder` se descarta (defensivo: el trigger 0033 siempre
 * debería dejar al menos una fila, pero nunca se inventa una fecha).
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
      return {
        ...row,
        lastChangedAt,
        daysInStatus: Math.max(0, differenceInCalendarDays(now, parseISO(lastChangedAt))),
      };
    })
    .filter((row): row is AttentionQueueRow => row !== null)
    .sort((a, b) => a.lastChangedAt.localeCompare(b.lastChangedAt))
    .slice(0, limit);
}
