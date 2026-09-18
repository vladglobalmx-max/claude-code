import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { getCurrentOrganizationTimezone } from "@/lib/auth/organization";
import { getBusinessToday, addDays } from "@/lib/business-date";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { canReceiveInventory, canManageSalesFulfillment } from "@/lib/auth/logistics";
import { ACTIVE_OPERATIONAL_STATUSES } from "@/lib/dashboard/attention-queue";
import { classifyPipelineDueDate, formatDueInDays, PIPELINE_DUE_SOON_THRESHOLD_DAYS } from "@/lib/dashboard/pipeline-due-dates";
import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * THÖREN 0084 — Dashboard de Inicio por rol. Reemplaza por completo el
 * viejo `get-dashboard-data.ts` (exclusivo del módulo legado "Órdenes de
 * Trabajo"/`orders` — se elimina junto con `dashboard-view.tsx` y sus
 * subcomponentes, ninguno usado fuera de /inicio, ver auditoría previa).
 * `lib/dashboard/attention-queue.ts`/`due-dates.ts` SÍ se preservan intactos
 * — los sigue usando /pedidos independientemente de este dashboard.
 *
 * DECISIÓN — solo counts/filtros/límites, cero N+1: cada sección (Admin/
 * Vendedor/Compras/Logística) resuelve sus tarjetas con queries `count:
 * "exact", head: true` (sin traer filas) y su "Requiere atención" con
 * queries acotadas a `CANDIDATE_LIMIT` filas, ordenadas por la fecha
 * relevante — nunca `select("*")` de una tabla completa.
 *
 * DECISIÓN — roles NO excluyentes (ticket, punto 5): `isCompras`/
 * `isLogistica` se evalúan de forma independiente sobre cualquier usuario
 * no-admin; ambas secciones se muestran juntas si aplican las dos
 * capabilities. Admin ve la vista completa de organización en vez de
 * cualquier sección "propia" (un admin no suele tener salesperson_id).
 *
 * DECISIÓN — Vendedor / "pendientes de surtido/entrega" (ajuste post-
 * review, opción B del ticket): `sales_fulfillments_select` NO tiene rama
 * de dueño-vendedor (admin/can_manage_sales_fulfillment/can_view_all_sales
 * únicamente) — un vendedor sin esas capabilities NO puede leer sus
 * propios registros de Surtido, y este ticket prohíbe tocar RLS. La señal
 * para Vendedor se deriva en cambio de `sales_orders.status`/
 * `fulfillment_release_status` (tabla que el vendedor SÍ puede leer,
 * `sales_orders_select_own_or_admin`): confirmada/en curso Y ya liberada
 * (parcial o totalmente) = "en curso de surtido/entrega" desde su
 * perspectiva, sin consultar `sales_fulfillments` en absoluto para esta
 * sección.
 *
 * DECISIÓN — "Entregas pendientes" en este dashboard nuevo = despachado
 * pero aún no cerrado (`sales_fulfillments.status = 'shipped'`), NO el
 * módulo legado `deliveries` (atado a `orders`/Pedidos, dominio distinto) —
 * confirmado explícitamente por el usuario.
 *
 * DECISIÓN — "OC con fecha requerida vencida" = `purchase_orders.
 * required_date < businessToday` (columna real, 0081) — NO
 * `estimated_reception_date`.
 *
 * DECISIÓN — "Requiere atención" (Admin, hasta 15): cada candidato trae
 * consigo su severidad (`vencido` > `atencion` > `pendiente`); se ordenan
 * por severidad y, dentro de cada una, por la fecha ya usada en su propia
 * query (ascendente = más urgente primero). No existe hoy un timestamp de
 * "bloqueada desde"/"atrasada desde" para OV bloqueadas ni para Surtidos
 * despachados — se usa `created_at`/`shipped_at` como proxy razonable,
 * documentado aquí en vez de inventar una columna nueva (prohibido por el
 * ticket).
 */

const CANDIDATE_LIMIT = 20;
const ATTENTION_LIMIT = 15;
/** Umbral propio de "Entregas pendientes": despachado hace más de N días sin cerrarse = atrasada. Concepto distinto de PIPELINE_DUE_SOON_THRESHOLD_DAYS (que es "cuánto falta", no "cuánto ha pasado"). */
const SHIPPED_STALE_THRESHOLD_DAYS = 2;

export interface DashboardCard {
  label: string;
  count: number;
  href: string;
}

export type AttentionSeverity = "vencido" | "atencion" | "pendiente";

export interface AttentionItem {
  id: string;
  label: string;
  description: string;
  severity: AttentionSeverity;
  href: string;
}

export interface RoleDashboardData {
  name: string;
  isAdmin: boolean;
  isCompras: boolean;
  isLogistica: boolean;
  /** null cuando la sección no aplica a este usuario (no se ejecutó ninguna query de esa sección). */
  adminCards: DashboardCard[] | null;
  attentionItems: AttentionItem[];
  vendorCards: DashboardCard[] | null;
  comprasCards: DashboardCard[] | null;
  logisticaCards: DashboardCard[] | null;
  /** THÖREN — "Órdenes de Trabajo" ya no domina Inicio, pero sigue siendo una métrica más cuando aplica (ticket, decisión 1). */
  activeWorkOrdersCount: number;
  hasError: boolean;
}

const severityWeight: Record<AttentionSeverity, number> = { vencido: 0, atencion: 1, pendiente: 2 };

export async function getRoleDashboardData(): Promise<RoleDashboardData> {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const supabase = createSupabaseServerClient();
  const timezone = await getCurrentOrganizationTimezone();
  const businessToday = getBusinessToday(timezone);
  const dueSoonUntil = addDays(businessToday, PIPELINE_DUE_SOON_THRESHOLD_DAYS);
  const now = new Date();

  const isAdmin = profile?.role === "admin";
  const isCompras = !isAdmin && canPreparePurchaseOrders(profile, capabilities);
  const isLogistica = !isAdmin && (canReceiveInventory(profile, capabilities) || canManageSalesFulfillment(profile, capabilities));
  const salespersonId = profile?.salespersonId ?? null;

  const errors: unknown[] = [];

  // ===========================================================================
  // "Órdenes de Trabajo activas" — una sola query de conteo, siempre.
  // ===========================================================================
  const { count: activeWorkOrdersRaw, error: workOrdersError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("operational_status", ACTIVE_OPERATIONAL_STATUSES);
  errors.push(workOrdersError);

  let adminCards: DashboardCard[] | null = null;
  let attentionItems: AttentionItem[] = [];
  let vendorCards: DashboardCard[] | null = null;
  let comprasCards: DashboardCard[] | null = null;
  let logisticaCards: DashboardCard[] | null = null;

  if (isAdmin) {
    const [
      { count: quotesOpenCount, error: e1 },
      { count: quotesDueSoonCount, error: e2 },
      { count: salesOrdersActiveCount, error: e3 },
      { count: requisitionsPendingCount, error: e4 },
      { count: purchaseOrdersOpenCount, error: e5 },
      { count: goodsReceiptsPendingCount, error: e6 },
      { count: fulfillmentsPendingCount, error: e7 },
      { count: fulfillmentsShippedCount, error: e8 },
      { count: invoicesPendingCount, error: e9 },
      { data: quotesAttentionRows, error: e10 },
      { data: soBlockedRows, error: e11 },
      { data: requisitionsSubmittedRows, error: e12 },
      { data: poOverdueRows, error: e13 },
      { data: receiptsDraftRows, error: e14 },
      { data: fulfillmentsShippedRows, error: e15 },
      { data: invoicesOverdueRows, error: e16 },
    ] = await Promise.all([
      supabase.from("quotes").select("id", { count: "exact", head: true }).in("status", ["borrador", "enviada"]),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .in("status", ["borrador", "enviada"])
        .gte("valid_until", businessToday)
        .lte("valid_until", dueSoonUntil),
      supabase.from("sales_orders").select("id", { count: "exact", head: true }).not("status", "in", "(closed,cancelled)"),
      supabase
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "submitted", "partially_ordered"]),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).not("status", "in", "(recibida,cancelada)"),
      supabase.from("goods_receipts").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("sales_fulfillments").select("id", { count: "exact", head: true }).in("status", ["draft", "ready"]),
      supabase.from("sales_fulfillments").select("id", { count: "exact", head: true }).eq("status", "shipped"),
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["pending", "partially_paid", "overdue"]),
      // --- candidatos para "Requiere atención" (acotados, nunca la tabla completa) ---
      supabase
        .from("quotes")
        .select("id, folio, valid_until")
        .in("status", ["borrador", "enviada"])
        .lte("valid_until", dueSoonUntil)
        .order("valid_until", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("sales_orders")
        .select("id, order_number, created_at")
        .eq("fulfillment_release_status", "blocked")
        .not("status", "in", "(draft,cancelled)")
        .order("created_at", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("purchase_requisitions")
        .select("id, requisition_number, requested_at")
        .eq("status", "submitted")
        .order("requested_at", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("purchase_orders")
        .select("id, folio, required_date")
        .not("status", "in", "(recibida,cancelada)")
        .not("required_date", "is", null)
        .lt("required_date", businessToday)
        .order("required_date", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("goods_receipts")
        .select("id, receipt_number, received_at")
        .eq("status", "draft")
        .order("received_at", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("sales_fulfillments")
        .select("id, fulfillment_number, shipped_at")
        .eq("status", "shipped")
        .not("shipped_at", "is", null)
        .order("shipped_at", { ascending: true })
        .limit(CANDIDATE_LIMIT),
      supabase
        .from("invoices")
        .select("id, invoice_number, due_date")
        .eq("status", "overdue")
        .order("due_date", { ascending: true })
        .limit(CANDIDATE_LIMIT),
    ]);
    errors.push(e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14, e15, e16);

    adminCards = [
      { label: "Cotizaciones abiertas", count: quotesOpenCount ?? 0, href: "/cotizaciones" },
      { label: "Cotizaciones por vencer", count: quotesDueSoonCount ?? 0, href: "/cotizaciones" },
      { label: "Órdenes de Venta activas", count: salesOrdersActiveCount ?? 0, href: "/ordenes-venta" },
      { label: "Requisiciones de Compra pendientes", count: requisitionsPendingCount ?? 0, href: "/requisiciones" },
      { label: "Órdenes de Compra abiertas", count: purchaseOrdersOpenCount ?? 0, href: "/compras" },
      { label: "Recepciones pendientes", count: goodsReceiptsPendingCount ?? 0, href: "/recepciones" },
      { label: "Surtidos pendientes", count: fulfillmentsPendingCount ?? 0, href: "/surtidos" },
      { label: "Entregas pendientes", count: fulfillmentsShippedCount ?? 0, href: "/surtidos" },
      { label: "Facturas pendientes de pago", count: invoicesPendingCount ?? 0, href: "/facturas" },
    ];

    const candidates: AttentionItem[] = [];

    for (const row of (quotesAttentionRows ?? []) as { id: string; folio: string; valid_until: string }[]) {
      const status = classifyPipelineDueDate(row.valid_until, now);
      if (status === "en_tiempo") continue;
      candidates.push({
        id: `quote-${row.id}`,
        label: `Cotización ${row.folio}`,
        description: formatDueInDays(row.valid_until, now),
        severity: status === "vencido" ? "vencido" : "atencion",
        href: `/cotizaciones/${row.id}`,
      });
    }

    for (const row of (soBlockedRows ?? []) as { id: string; order_number: string }[]) {
      candidates.push({
        id: `so-blocked-${row.id}`,
        label: `Orden de Venta ${row.order_number}`,
        description: "Bloqueada por liberación financiera",
        severity: "atencion",
        href: `/ordenes-venta/${row.id}`,
      });
    }

    for (const row of (requisitionsSubmittedRows ?? []) as { id: string; requisition_number: string }[]) {
      candidates.push({
        id: `req-${row.id}`,
        label: `Requisición ${row.requisition_number}`,
        description: "Enviada, pendiente de convertir a Orden de Compra",
        severity: "pendiente",
        href: `/requisiciones/${row.id}`,
      });
    }

    for (const row of (poOverdueRows ?? []) as { id: string; folio: string; required_date: string }[]) {
      candidates.push({
        id: `po-${row.id}`,
        label: `Orden de Compra ${row.folio}`,
        description: formatDueInDays(row.required_date, now),
        severity: "vencido",
        href: `/compras/${row.id}`,
      });
    }

    for (const row of (receiptsDraftRows ?? []) as { id: string; receipt_number: string }[]) {
      candidates.push({
        id: `receipt-${row.id}`,
        label: `Recepción ${row.receipt_number}`,
        description: "Pendiente de confirmar",
        severity: "pendiente",
        href: `/recepciones/${row.id}`,
      });
    }

    for (const row of (fulfillmentsShippedRows ?? []) as { id: string; fulfillment_number: string; shipped_at: string }[]) {
      const daysShipped = differenceInCalendarDays(now, parseISO(row.shipped_at));
      if (daysShipped < SHIPPED_STALE_THRESHOLD_DAYS) continue;
      candidates.push({
        id: `fulfillment-${row.id}`,
        label: `Surtido ${row.fulfillment_number}`,
        description: `Despachado hace ${daysShipped} día${daysShipped === 1 ? "" : "s"}, sin cerrar`,
        severity: "atencion",
        href: `/surtidos/${row.id}`,
      });
    }

    for (const row of (invoicesOverdueRows ?? []) as { id: string; invoice_number: string; due_date: string }[]) {
      candidates.push({
        id: `invoice-${row.id}`,
        label: `Factura ${row.invoice_number}`,
        description: formatDueInDays(row.due_date, now),
        severity: "vencido",
        href: `/facturas/${row.id}`,
      });
    }

    attentionItems = candidates.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]).slice(0, ATTENTION_LIMIT);
  }

  if (!isAdmin && salespersonId) {
    const [
      { count: myQuotesOpenCount, error: v1 },
      { count: myQuotesDueSoonCount, error: v2 },
      { count: mySalesOrdersCount, error: v3 },
      { count: myBlockedCount, error: v4 },
      { count: myPendingFulfillmentCount, error: v5 },
      { count: myInvoicesPendingCount, error: v6 },
    ] = await Promise.all([
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", salespersonId)
        .in("status", ["borrador", "enviada"]),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", salespersonId)
        .in("status", ["borrador", "enviada"])
        .gte("valid_until", businessToday)
        .lte("valid_until", dueSoonUntil),
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", salespersonId)
        .not("status", "in", "(closed,cancelled)"),
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", salespersonId)
        .eq("fulfillment_release_status", "blocked")
        .not("status", "in", "(draft,cancelled)"),
      // Opción B (ticket, decisión 4): señal derivada de sales_orders, NUNCA
      // se consulta sales_fulfillments para un vendedor normal (esa policy
      // no tiene rama de dueño — ver DECISIÓN de cabecera).
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", salespersonId)
        .in("status", ["confirmed", "in_progress"])
        .in("fulfillment_release_status", ["released", "partially_released"]),
      // Sin filtro explícito de salesperson_id: invoices no tiene esa
      // columna directa, y RLS (invoices_select) ya acota a la Sales Order
      // propia — mismo criterio exacto que /facturas/page.tsx (confía en
      // RLS, sin re-implementar el join aquí). Nota: si este vendedor
      // ADEMÁS tuviera can_view_all_sales/can_manage_sales_order_finance,
      // este conteo dejaría de ser "solo mis facturas" — combinación fuera
      // de alcance de este ticket.
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["pending", "partially_paid", "overdue"]),
    ]);
    errors.push(v1, v2, v3, v4, v5, v6);

    vendorCards = [
      { label: "Mis cotizaciones abiertas", count: myQuotesOpenCount ?? 0, href: "/cotizaciones" },
      { label: "Mis cotizaciones por vencer", count: myQuotesDueSoonCount ?? 0, href: "/cotizaciones" },
      { label: "Mis Órdenes de Venta", count: mySalesOrdersCount ?? 0, href: "/ordenes-venta" },
      { label: "Pendientes de liberación", count: myBlockedCount ?? 0, href: "/ordenes-venta" },
      { label: "Pendientes de surtido/entrega", count: myPendingFulfillmentCount ?? 0, href: "/ordenes-venta" },
      { label: "Facturas pendientes", count: myInvoicesPendingCount ?? 0, href: "/facturas" },
    ];
  }

  if (isCompras) {
    const [
      { count: requisitionsPendingCount, error: c1 },
      { count: poDraftCount, error: c2 },
      { count: poOrderedCount, error: c3 },
      { count: poOverdueCount, error: c4 },
      { count: receiptsDraftCount, error: c5 },
    ] = await Promise.all([
      supabase.from("purchase_requisitions").select("id", { count: "exact", head: true }).in("status", ["draft", "submitted", "partially_ordered"]),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "borrador"),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).in("status", ["ordenada", "confirmada"]),
      supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(recibida,cancelada)")
        .not("required_date", "is", null)
        .lt("required_date", businessToday),
      supabase.from("goods_receipts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);
    errors.push(c1, c2, c3, c4, c5);

    comprasCards = [
      { label: "Requisiciones pendientes", count: requisitionsPendingCount ?? 0, href: "/requisiciones" },
      { label: "OCs en borrador", count: poDraftCount ?? 0, href: "/compras" },
      { label: "OCs ordenadas/confirmadas", count: poOrderedCount ?? 0, href: "/compras" },
      { label: "OCs con fecha requerida vencida", count: poOverdueCount ?? 0, href: "/compras" },
      { label: "Recepciones pendientes", count: receiptsDraftCount ?? 0, href: "/recepciones" },
    ];
  }

  if (isLogistica) {
    const [
      { count: receiptsDraftCount, error: l1 },
      { count: fulfillmentsPendingCount, error: l2 },
      { count: fulfillmentsShippedCount, error: l3 },
      { data: incomingRows, error: l4 },
    ] = await Promise.all([
      supabase.from("goods_receipts").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("sales_fulfillments").select("id", { count: "exact", head: true }).in("status", ["draft", "ready"]),
      supabase.from("sales_fulfillments").select("id", { count: "exact", head: true }).eq("status", "shipped"),
      // Mismo RPC ya usado por el dashboard legado y por /inventario (0036) — sin filtro de producto, agregado en JS (mismo criterio que Inventario).
      supabase.rpc("rpc_inventory_incoming_by_product"),
    ]);
    errors.push(l1, l2, l3, l4);

    const incomingTotal = ((incomingRows ?? []) as { incoming: number }[]).reduce((sum, row) => sum + row.incoming, 0);

    logisticaCards = [
      { label: "Recepciones pendientes", count: receiptsDraftCount ?? 0, href: "/recepciones" },
      { label: "Surtidos pendientes", count: fulfillmentsPendingCount ?? 0, href: "/surtidos" },
      { label: "Entregas pendientes", count: fulfillmentsShippedCount ?? 0, href: "/surtidos" },
      { label: "Inventario pendiente de recibir", count: incomingTotal, href: "/inventario" },
    ];
  }

  return {
    name: profile?.name ?? "",
    isAdmin,
    isCompras,
    isLogistica,
    adminCards,
    attentionItems,
    vendorCards,
    comprasCards,
    logisticaCards,
    activeWorkOrdersCount: activeWorkOrdersRaw ?? 0,
    hasError: errors.some(Boolean),
  };
}
