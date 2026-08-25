import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessMonthRange } from "@/lib/business-date";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  ACTIVE_OPERATIONAL_STATUSES,
  buildAttentionQueue,
  buildLatestChangeMap,
  buildOperationalStatusBreakdown,
  type AttentionQueueRow,
} from "@/lib/dashboard/attention-queue";
import { classifyDueDateStatus } from "@/lib/dashboard/due-dates";
import { BUSINESS_UNIT_LABELS } from "@/types/domain";
import type { OrderOperationalStatus, OrderStatus } from "@/types/domain";

/**
 * Estados que cuentan como "pipeline abierto" — ver ORDER_STATUS_LABELS en
 * types/domain.ts. borrador/pedido todavía requieren trabajo; cerrado ya
 * se completó, cancelado ya no aplica. Decisión documentada en el reporte
 * de THÖREN Experience 1B, no inventada aquí.
 */
const OPEN_STATUSES: OrderStatus[] = ["borrador", "pedido"];

/** Techo de la sección "Requieren atención" — es un resumen de dashboard, no el listado completo (para eso está /pedidos). */
const ATTENTION_QUEUE_LIMIT = 15;

export interface RecentOrderRow {
  id: string;
  folio: string;
  client_name: string;
  status: OrderStatus;
  order_date: string;
  salespersonName: string;
}

export interface SalespersonBreakdownRow {
  salespersonId: string;
  salespersonName: string;
  count: number;
}

/**
 * Una fila de la sección "Requieren atención" (Fase 6I) — pedidos activos
 * (operational_status fuera de completado/cancelado), ordenados por
 * antigüedad EN SU ESTADO ACTUAL (no por fecha de creación): el que lleva
 * más días sin avanzar de estado es el que más necesita atención.
 * `daysInStatus`/`lastChangedAt` se resuelven desde
 * order_operational_status_history (0033) — su fila más reciente por
 * pedido, nunca desde `orders.updated_at` (que cambia por cualquier
 * edición, no solo por cambio de seguimiento). Tipo/lógica reales viven en
 * lib/dashboard/attention-queue.ts (probado con Vitest); se re-exporta
 * aquí para que los componentes de presentación no necesiten conocer esa
 * ruta interna.
 */
export type { AttentionQueueRow } from "@/lib/dashboard/attention-queue";

export interface DashboardData {
  role: "admin" | "vendedor";
  name: string;
  /** true si este usuario/organización no tiene NINGÚN pedido histórico — dispara el Empty State en vez de KPIs en cero. */
  hasAnyOrders: boolean;
  monthOrderCount: number;
  previousMonthOrderCount: number;
  activeOrderCount: number;
  closedThisMonthCount: number;
  distinctClientsThisMonth: number;
  statusBreakdown: Record<OrderStatus, number>;
  /** THÖREN Fase 6I — snapshot ACTUAL (no acotado al mes) de todos los pedidos por operational_status. */
  operationalStatusBreakdown: Record<OrderOperationalStatus, number>;
  recentOrders: RecentOrderRow[];
  /** THÖREN Fase 6I — top ATTENTION_QUEUE_LIMIT pedidos activos, más antiguos en su estado actual primero. */
  attentionQueue: AttentionQueueRow[];
  /** null para VENDEDOR — RLS ya limita sus datos a sus propios pedidos, un comparativo de 1 fila no aporta nada (ver reporte 1B). */
  salespersonBreakdown: SalespersonBreakdownRow[] | null;
  /** true si alguna consulta falló — la página muestra un error explícito en vez de datos parciales silenciosos. */
  hasError: boolean;
}

type MonthOrderRow = {
  id: string;
  folio: string;
  client_name: string;
  status: OrderStatus;
  order_date: string;
  created_at: string;
  salesperson_id: string;
  salesperson: { name: string } | { name: string }[] | null;
};

function salespersonName(row: MonthOrderRow | RecentSourceRow): string {
  const sp = row.salesperson;
  if (!sp) return "—";
  return Array.isArray(sp) ? sp[0]?.name ?? "—" : sp.name;
}

type RecentSourceRow = {
  id: string;
  folio: string;
  client_name: string;
  status: OrderStatus;
  order_date: string;
  salesperson: { name: string } | { name: string }[] | null;
};

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

type AttentionSourceRow = {
  id: string;
  folio: string;
  client_name: string;
  business_unit_id: string | null;
  business_unit: string;
  operational_status: OrderOperationalStatus;
  supplier_commitment_date: string | null;
  estimated_reception_date: string | null;
  scheduled_delivery_date: string | null;
  salesperson: OneOrMany<{ name: string }> | null;
  business_units: OneOrMany<{ name: string }> | null;
};

export async function getDashboardData(): Promise<DashboardData> {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const currentMonth = getBusinessMonthRange(0);
  const previousMonth = getBusinessMonthRange(1);

  const [
    { count: totalCount, error: totalError },
    { data: monthRows, error: monthError },
    { count: previousMonthCount, error: previousMonthError },
    { count: activeCount, error: activeError },
    { data: recentRows, error: recentError },
    { data: operationalStatusRows, error: operationalStatusError },
    { data: attentionSourceRows, error: attentionError },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, folio, client_name, status, order_date, created_at, salesperson_id, salesperson:salespeople(name)")
      .gte("order_date", currentMonth.start)
      .lt("order_date", currentMonth.end),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("order_date", previousMonth.start)
      .lt("order_date", previousMonth.end),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES),
    supabase
      .from("orders")
      .select("id, folio, client_name, status, order_date, salesperson:salespeople(name)")
      .order("created_at", { ascending: false })
      .limit(8),
    // THÖREN Fase 6I — snapshot ACTUAL de operational_status (0033), no
    // acotado al mes: "qué pedidos requieren atención" es una pregunta de
    // hoy, no de este calendario. Escala del proyecto (herramienta interna
    // de un distribuidor, no un catálogo masivo) hace innecesaria una
    // paginación/agregación server-side para esta sola columna.
    supabase.from("orders").select("operational_status"),
    // Pedidos activos (fuera de completado/cancelado) — límite defensivo,
    // el orden final por antigüedad-en-estado se resuelve abajo en JS
    // cruzando con order_operational_status_history (no hay forma de
    // ordenar por ese valor derivado directamente vía PostgREST).
    supabase
      .from("orders")
      .select(
        "id, folio, client_name, business_unit_id, business_unit, operational_status, supplier_commitment_date, estimated_reception_date, scheduled_delivery_date, salesperson:salespeople(name), business_units(name)"
      )
      .in("operational_status", ACTIVE_OPERATIONAL_STATUSES)
      .limit(300),
  ]);

  const hasError = Boolean(
    totalError || monthError || previousMonthError || activeError || recentError || operationalStatusError || attentionError
  );

  const typedMonthRows = (monthRows ?? []) as unknown as MonthOrderRow[];

  const statusBreakdown: Record<OrderStatus, number> = {
    borrador: 0,
    pedido: 0,
    cerrado: 0,
    cancelado: 0,
  };
  const clientSet = new Set<string>();
  const salespersonCounts = new Map<string, SalespersonBreakdownRow>();

  for (const row of typedMonthRows) {
    statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1;
    clientSet.add(row.client_name.trim().toLowerCase());

    if (profile?.role === "admin") {
      const existing = salespersonCounts.get(row.salesperson_id);
      if (existing) {
        existing.count += 1;
      } else {
        salespersonCounts.set(row.salesperson_id, {
          salespersonId: row.salesperson_id,
          salespersonName: salespersonName(row),
          count: 1,
        });
      }
    }
  }

  const salespersonBreakdown =
    profile?.role === "admin"
      ? Array.from(salespersonCounts.values()).sort((a, b) => b.count - a.count)
      : null;

  const recentOrders: RecentOrderRow[] = ((recentRows ?? []) as unknown as RecentSourceRow[]).map((row) => ({
    id: row.id,
    folio: row.folio,
    client_name: row.client_name,
    status: row.status,
    order_date: row.order_date,
    salespersonName: salespersonName(row),
  }));

  const operationalStatusBreakdown = buildOperationalStatusBreakdown(
    ((operationalStatusRows ?? []) as { operational_status: OrderOperationalStatus }[]).map((r) => r.operational_status)
  );

  // THÖREN Fase 6I — "días en ese estado" se resuelve con la fila más
  // reciente de order_operational_status_history por pedido (0033), nunca
  // con orders.updated_at (cambia por cualquier edición del pedido, no
  // solo por un cambio de seguimiento). Segunda consulta porque depende de
  // los ids de la primera — no hay forma de pedirle esto a PostgREST en un
  // solo round trip sin una vista/RPC nueva (fuera de alcance: "no crear
  // migración salvo que sea realmente necesaria").
  const typedAttentionRows = (attentionSourceRows ?? []) as unknown as AttentionSourceRow[];
  let attentionQueue: AttentionQueueRow[] = [];
  if (typedAttentionRows.length > 0) {
    const { data: historyRows } = await supabase
      .from("order_operational_status_history")
      .select("order_id, changed_at")
      .in(
        "order_id",
        typedAttentionRows.map((r) => r.id)
      )
      .order("changed_at", { ascending: false });

    const latestChangeByOrder = buildLatestChangeMap((historyRows ?? []) as { order_id: string; changed_at: string }[]);
    const now = new Date();

    attentionQueue = buildAttentionQueue(
      typedAttentionRows.map((row) => ({
        id: row.id,
        folio: row.folio,
        clientName: row.client_name,
        businessUnitName:
          one(row.business_units)?.name ?? BUSINESS_UNIT_LABELS[row.business_unit as keyof typeof BUSINESS_UNIT_LABELS] ?? "—",
        salespersonName: one(row.salesperson)?.name ?? "—",
        operationalStatus: row.operational_status,
        dueDateStatus: classifyDueDateStatus(
          row.operational_status,
          {
            supplierCommitmentDate: row.supplier_commitment_date,
            estimatedReceptionDate: row.estimated_reception_date,
            scheduledDeliveryDate: row.scheduled_delivery_date,
          },
          now
        ),
      })),
      latestChangeByOrder,
      now,
      ATTENTION_QUEUE_LIMIT
    );
  }

  return {
    role: (profile?.role ?? "vendedor") as "admin" | "vendedor",
    name: profile?.name ?? "",
    hasAnyOrders: (totalCount ?? 0) > 0,
    monthOrderCount: typedMonthRows.length,
    previousMonthOrderCount: previousMonthCount ?? 0,
    activeOrderCount: activeCount ?? 0,
    closedThisMonthCount: statusBreakdown.cerrado,
    distinctClientsThisMonth: clientSet.size,
    statusBreakdown,
    operationalStatusBreakdown,
    recentOrders,
    attentionQueue,
    salespersonBreakdown,
    hasError,
  };
}
