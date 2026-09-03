import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessMonthRange } from "@/lib/business-date";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { getCurrentOrganizationTimezone } from "@/lib/auth/organization";
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

/** THÖREN Fase 6Q — Command Center: una fila del bloque "Órdenes de compra abiertas" (PO abierta, no recibida/cancelada). */
export interface PurchaseOrderInTransitRow {
  id: string;
  folio: string;
  status: string;
  supplierName: string;
  orderFolio: string;
  estimatedReceptionDate: string | null;
}

/** THÖREN Fase 6Q — una fila del bloque "Entregas próximas" (programada/en_proceso). */
export interface UpcomingDeliveryRow {
  id: string;
  label: string;
  status: string;
  deliveryType: string;
  scheduledDate: string | null;
  orderId: string;
  orderFolio: string;
  clientName: string;
}

/** THÖREN Fase 6Q — una fila del bloque "Pedidos por Business Unit — {mes}" (Analítica A). */
export interface BusinessUnitOrderCountRow {
  businessUnitId: string;
  name: string;
  count: number;
}

export interface DashboardData {
  role: "admin" | "vendedor";
  name: string;
  /** THÖREN 6R.1C — una sola carga por request (ver getCurrentCapabilities), reutilizada para el contexto del Home, prioridad de KPIs y accesos rápidos. Nunca amplía el scoping de datos: RLS sigue siendo la única autoridad sobre qué filas se leen. */
  capabilities: Set<string>;
  /** THÖREN 7C — timezone real de la organización (organizations.timezone, 0053), ya usado para calcular monthOrderCount/previousMonthOrderCount arriba — se reexpone para que CommandCenterHeader muestre la hora/saludo/fecha en la zona horaria correcta, no siempre Monterrey. */
  timezone: string;
  /** true si este usuario/organización no tiene NINGÚN pedido histórico — dispara el Empty State en vez de KPIs en cero. */
  hasAnyOrders: boolean;
  monthOrderCount: number;
  previousMonthOrderCount: number;
  /** THÖREN Fase 6Q — reemplaza al antiguo activeOrderCount (basado en `status` legacy borrador/pedido): cuenta por operational_status (0033) fuera de completado/cancelado, la misma fuente que "Requieren atención" y el Flujo Operativo — un solo número de "pedidos activos" en toda la app. */
  activeOperationalOrderCount: number;
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
  /** THÖREN Fase 6Q — Pedidos de este mes agrupados por Business Unit real (0014), calculado sobre las mismas filas que monthOrderCount (cero queries extra). */
  ordersByBusinessUnit: BusinessUnitOrderCountRow[];
  /** THÖREN Fase 6Q — Cotizaciones en 'borrador'/'enviada' (no resueltas todavía). */
  quotesActiveCount: number;
  /** THÖREN Fase 6Q — Purchase Orders con status fuera de 'recibida'/'cancelada'. */
  purchaseOrdersOpenCount: number;
  /** THÖREN Fase 6Q — hasta 3 POs abiertas, más próximas a su fecha estimada de recepción primero. */
  purchaseOrdersInTransit: PurchaseOrderInTransitRow[];
  /** THÖREN Fase 6Q — suma de `rpc_inventory_committed_levels` (6O) en toda la organización — "unidades reservadas para Pedidos activos". */
  committedUnitsTotal: number;
  /** THÖREN Fase 6Q — suma de `rpc_inventory_incoming_by_product` (6M) en toda la organización — "unidades ordenadas a proveedor, aún no recibidas". */
  incomingUnitsTotal: number;
  /** THÖREN Fase 6Q — unidades ya surtidas (0038) menos unidades ya entregadas en Entregas no canceladas (0039) — "pendiente de entregar" físico, no de pedido. Nunca negativo por construcción (ver DECISIÓN abajo). */
  pendingToDeliverUnitsTotal: number;
  /** THÖREN Fase 6Q — Entregas en 'programada'/'en_proceso'. */
  deliveriesUpcomingCount: number;
  /** THÖREN Fase 6Q — hasta 3 Entregas próximas, más próximas a su fecha programada primero. */
  deliveriesUpcoming: UpcomingDeliveryRow[];
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
  business_unit_id: string | null;
  business_units: OneOrMany<{ name: string }> | null;
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
  // THÖREN 7C — timezone real de la organización: determina qué pedidos
  // cuentan como "de este mes" (getBusinessMonthRange) y qué hora/saludo
  // muestra CommandCenterHeader — nunca siempre Monterrey.
  const timezone = await getCurrentOrganizationTimezone();

  const currentMonth = getBusinessMonthRange(0, timezone);
  const previousMonth = getBusinessMonthRange(1, timezone);

  const [
    capabilities,
    { count: totalCount, error: totalError },
    { data: monthRows, error: monthError },
    { count: previousMonthCount, error: previousMonthError },
    { data: recentRows, error: recentError },
    { data: operationalStatusRows, error: operationalStatusError },
    { data: attentionSourceRows, error: attentionError },
    { count: quotesActiveCountRaw, error: quotesError },
    { data: purchaseOrderRows, error: purchaseOrdersError },
    { data: deliveryRows, error: deliveriesError },
    { data: committedRows, error: committedError },
    { data: incomingRows, error: incomingError },
    { data: fulfilledRows, error: fulfilledError },
    { data: deliveredRows, error: deliveredError },
  ] = await Promise.all([
    getCurrentCapabilities(profile?.userId),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select(
        "id, folio, client_name, status, order_date, created_at, salesperson_id, business_unit_id, business_units(name), salesperson:salespeople(name)"
      )
      .gte("order_date", currentMonth.start)
      .lt("order_date", currentMonth.end),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("order_date", previousMonth.start)
      .lt("order_date", previousMonth.end),
    // THÖREN Fase 6Q.1 — "Pedidos recientes" del Command Center: 3
    // registros (resumen, no listado — para eso está /pedidos), no 8 como
    // en 1B ni 5 como en la primera pasada de 6Q.
    supabase
      .from("orders")
      .select("id, folio, client_name, status, order_date, salesperson:salespeople(name)")
      .order("created_at", { ascending: false })
      .limit(3),
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
    // THÖREN Fase 6Q — Cotizaciones sin resolver ("activas" = ni aceptada/
    // rechazada/cancelada todavía, ver domain.ts QuoteStatus). RLS
    // (quotes_select_own_or_admin, 0020) ya escopea admin=org/vendedor=propias.
    supabase.from("quotes").select("id", { count: "exact", head: true }).in("status", ["borrador", "enviada"]),
    // THÖREN Fase 6Q — Purchase Orders abiertas (fuera de recibida/cancelada),
    // más próximas a su fecha estimada de recepción primero — misma fila
    // sirve para el conteo (purchaseOrdersOpenCount = length) y para el
    // bloque "Órdenes de compra abiertas" (slice a 5), sin una segunda consulta.
    // RLS (purchase_orders_select, 0035) ya escopea admin=org/vendedor=propias.
    supabase
      .from("purchase_orders")
      .select(
        "id, folio, status, estimated_reception_date, supplier:suppliers(name), order:orders(folio)"
      )
      .not("status", "in", "(recibida,cancelada)")
      .order("estimated_reception_date", { ascending: true, nullsFirst: false })
      .limit(50),
    // THÖREN Fase 6Q — Entregas próximas (programada/en_proceso), más
    // próximas a su fecha programada primero — misma fila sirve para el
    // conteo y para el bloque "Entregas próximas" (slice a 5). RLS
    // (deliveries_select_own_or_admin, 0039) ya escopea admin=org/vendedor=propias.
    supabase
      .from("deliveries")
      .select("id, sequence_number, status, delivery_type, scheduled_date, order:orders(id, folio, client_name)")
      .in("status", ["programada", "en_proceso"])
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(50),
    // THÖREN Fase 6Q — mismas RPCs ya usadas por /inventario (6M/6O), sin
    // filtro de producto: devuelven el dataset completo de la organización.
    // Se suman en JS (mismo criterio que la página de Inventario, que ya
    // hace su cruce producto×almacén en JS en vez de en SQL).
    supabase.rpc("rpc_inventory_committed_levels"),
    supabase.rpc("rpc_inventory_incoming_by_product"),
    // THÖREN Fase 6Q — "surtido total" (ver DECISIÓN en 0038/0039: TODAS las
    // reservas, activas o liberadas) menos "ya entregado en Entregas no
    // canceladas" (ver DECISIÓN en 0039) = pendiente de entregar físico.
    // inventory_reservations_select (0037) ya es own-or-admin (igual que
    // Orders/Deliveries) — ninguna columna adicional de organización/
    // vendedor hace falta aquí, a diferencia de Inventory (movimientos),
    // que sí es org-wide.
    supabase.from("inventory_reservations").select("fulfilled_quantity"),
    supabase.from("delivery_items").select("quantity_delivered, deliveries!inner(status)").neq("deliveries.status", "cancelada"),
  ]);

  const hasError = Boolean(
    totalError ||
      monthError ||
      previousMonthError ||
      recentError ||
      operationalStatusError ||
      attentionError ||
      quotesError ||
      purchaseOrdersError ||
      deliveriesError ||
      committedError ||
      incomingError ||
      fulfilledError ||
      deliveredError
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
  const businessUnitCounts = new Map<string, BusinessUnitOrderCountRow>();

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

    if (row.business_unit_id) {
      const existing = businessUnitCounts.get(row.business_unit_id);
      if (existing) {
        existing.count += 1;
      } else {
        businessUnitCounts.set(row.business_unit_id, {
          businessUnitId: row.business_unit_id,
          name: one(row.business_units)?.name ?? "—",
          count: 1,
        });
      }
    }
  }

  const salespersonBreakdown =
    profile?.role === "admin"
      ? Array.from(salespersonCounts.values()).sort((a, b) => b.count - a.count)
      : null;

  const ordersByBusinessUnit = Array.from(businessUnitCounts.values()).sort((a, b) => b.count - a.count);

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

  const activeOperationalOrderCount = ACTIVE_OPERATIONAL_STATUSES.reduce(
    (sum, status) => sum + operationalStatusBreakdown[status],
    0
  );

  const typedPurchaseOrderRows = (purchaseOrderRows ?? []) as unknown as {
    id: string;
    folio: string;
    status: string;
    estimated_reception_date: string | null;
    supplier: OneOrMany<{ name: string }> | null;
    order: OneOrMany<{ folio: string }> | null;
  }[];
  const purchaseOrdersInTransit: PurchaseOrderInTransitRow[] = typedPurchaseOrderRows.slice(0, 3).map((row) => ({
    id: row.id,
    folio: row.folio,
    status: row.status,
    supplierName: one(row.supplier)?.name ?? "—",
    orderFolio: one(row.order)?.folio ?? "—",
    estimatedReceptionDate: row.estimated_reception_date,
  }));

  const typedDeliveryRows = (deliveryRows ?? []) as unknown as {
    id: string;
    sequence_number: number;
    status: string;
    delivery_type: string;
    scheduled_date: string | null;
    order: OneOrMany<{ id: string; folio: string; client_name: string }> | null;
  }[];
  const deliveriesUpcoming: UpcomingDeliveryRow[] = typedDeliveryRows.slice(0, 3).map((row) => {
    const order = one(row.order);
    return {
      id: row.id,
      label: `${order?.folio ?? "—"}-E${row.sequence_number}`,
      status: row.status,
      deliveryType: row.delivery_type,
      scheduledDate: row.scheduled_date,
      orderId: order?.id ?? "",
      orderFolio: order?.folio ?? "—",
      clientName: order?.client_name ?? "—",
    };
  });

  const committedUnitsTotal = ((committedRows ?? []) as { committed: number }[]).reduce(
    (sum, row) => sum + row.committed,
    0
  );
  const incomingUnitsTotal = ((incomingRows ?? []) as { incoming: number }[]).reduce(
    (sum, row) => sum + row.incoming,
    0
  );

  // THÖREN Fase 6Q — pendiente de entregar físico = surtido total (0038,
  // TODAS las reservas) menos ya entregado en Entregas no canceladas
  // (0039) — misma fórmula que rpc_order_delivery_progress, agregada a
  // nivel organización/vendedor en vez de por Pedido (ver DECISIÓN en
  // get-dashboard-data.ts arriba). Nunca negativo: la invariante de 6P
  // (nunca se puede entregar más de lo surtido) garantiza fulfilled >=
  // delivered por partida, y la suma preserva esa propiedad — el
  // Math.max(0, ...) es solo defensivo.
  const fulfilledTotal = ((fulfilledRows ?? []) as { fulfilled_quantity: number }[]).reduce(
    (sum, row) => sum + row.fulfilled_quantity,
    0
  );
  const deliveredTotal = ((deliveredRows ?? []) as { quantity_delivered: number }[]).reduce(
    (sum, row) => sum + row.quantity_delivered,
    0
  );
  const pendingToDeliverUnitsTotal = Math.max(0, fulfilledTotal - deliveredTotal);

  return {
    role: (profile?.role ?? "vendedor") as "admin" | "vendedor",
    name: profile?.name ?? "",
    capabilities,
    timezone,
    hasAnyOrders: (totalCount ?? 0) > 0,
    monthOrderCount: typedMonthRows.length,
    previousMonthOrderCount: previousMonthCount ?? 0,
    activeOperationalOrderCount,
    closedThisMonthCount: statusBreakdown.cerrado,
    distinctClientsThisMonth: clientSet.size,
    statusBreakdown,
    operationalStatusBreakdown,
    recentOrders,
    attentionQueue,
    salespersonBreakdown,
    ordersByBusinessUnit,
    quotesActiveCount: quotesActiveCountRaw ?? 0,
    purchaseOrdersOpenCount: typedPurchaseOrderRows.length,
    purchaseOrdersInTransit,
    committedUnitsTotal,
    incomingUnitsTotal,
    pendingToDeliverUnitsTotal,
    deliveriesUpcomingCount: typedDeliveryRows.length,
    deliveriesUpcoming,
    hasError,
  };
}
