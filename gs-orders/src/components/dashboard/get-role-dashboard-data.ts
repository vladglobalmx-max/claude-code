import "server-only";
import { FileSpreadsheet, ClipboardList, ClipboardCheck, Package, PackageCheck, Receipt, FileText, Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
 * THÖREN 0084 (V1) / 0085 (V2 — rediseño visual) — Dashboard de Inicio por
 * rol. V2 es ÚNICAMENTE presentación: mismas métricas, mismos filtros,
 * mismos umbrales que V1. Los únicos dos cambios de query respecto a V1,
 * ambos aditivos (nunca alteran qué fila califica ni ningún conteo):
 *   1) `customer_name` se agrega al SELECT de cotizaciones de "Requiere
 *      atención" (columna ya denormalizada en `quotes`, sin join nuevo) —
 *      la UI de V2 pide mostrar cliente/proveedor cuando existe.
 *   2) Un nuevo `count` de facturas `status='overdue'` — V1 nunca lo
 *      calculaba aparte (solo traía filas limitadas para la lista de
 *      atención); el panel "Hoy" de V2 lo necesita como cifra propia.
 * Para Órdenes de Venta/Requisiciones/Órdenes de Compra/Recepciones/
 * Surtidos NO hay cliente/proveedor disponible sin agregar un join nuevo
 * — se omite ahí (deliberado, no un olvido).
 *
 * `lib/dashboard/attention-queue.ts`/`due-dates.ts` (Pedidos, usados fuera
 * de este dashboard) siguen sin tocarse.
 */

const CANDIDATE_LIMIT = 20;
const ATTENTION_LIMIT = 15;
/** Umbral propio de "Entregas pendientes": despachado hace más de N días sin cerrarse = atrasada. Concepto distinto de PIPELINE_DUE_SOON_THRESHOLD_DAYS (que es "cuánto falta", no "cuánto ha pasado"). */
const SHIPPED_STALE_THRESHOLD_DAYS = 2;

export interface DashboardCard {
  label: string;
  count: number;
  href: string;
  icon: LucideIcon;
}

export type AttentionSeverity = "vencido" | "atencion" | "pendiente";

export interface AttentionItem {
  id: string;
  type: string;
  folio: string;
  counterparty: string | null;
  reason: string;
  agingLabel: string;
  severity: AttentionSeverity;
  href: string;
}

export interface TodayPanelItem {
  label: string;
  count: number;
  href: string;
}

export interface RoleDashboardData {
  name: string;
  timezone: string;
  isAdmin: boolean;
  isCompras: boolean;
  isLogistica: boolean;
  /** Gating real de "Nueva Orden de Compra" en Quick Actions — mismo guard que /compras/nueva. */
  canCreatePurchaseOrder: boolean;
  /** Hasta 3 KPIs destacados del hero — subconjunto de las mismas tarjetas de abajo, nunca un cálculo nuevo. */
  heroKpis: DashboardCard[];
  adminComercialCards: DashboardCard[] | null;
  adminComprasCards: DashboardCard[] | null;
  adminOperacionCards: DashboardCard[] | null;
  attentionItems: AttentionItem[];
  /** Solo Admin (mismos datos que las tarjetas de arriba, reempaquetados) — panel derecho "Hoy". */
  todayPanel: TodayPanelItem[] | null;
  vendorCards: DashboardCard[] | null;
  comprasCards: DashboardCard[] | null;
  logisticaCards: DashboardCard[] | null;
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
  const canCreatePurchaseOrder = canPreparePurchaseOrders(profile, capabilities);
  const isCompras = !isAdmin && canCreatePurchaseOrder;
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

  let adminComercialCards: DashboardCard[] | null = null;
  let adminComprasCards: DashboardCard[] | null = null;
  let adminOperacionCards: DashboardCard[] | null = null;
  let attentionItems: AttentionItem[] = [];
  let todayPanel: TodayPanelItem[] | null = null;
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
      { count: invoicesOverdueCount, error: e17 },
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
      // Nuevo en V2 (ver DECISIÓN de cabecera) — solo para el panel "Hoy", ningún filtro existente cambia.
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
      // --- candidatos para "Requiere atención" (acotados, nunca la tabla completa) ---
      supabase
        .from("quotes")
        .select("id, folio, valid_until, customer_name")
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
    errors.push(e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14, e15, e16, e17);

    const quotesOpen: DashboardCard = { label: "Cotizaciones abiertas", count: quotesOpenCount ?? 0, href: "/cotizaciones", icon: FileSpreadsheet };
    const quotesDueSoon: DashboardCard = { label: "Por vencer", count: quotesDueSoonCount ?? 0, href: "/cotizaciones", icon: FileSpreadsheet };
    const salesOrdersActive: DashboardCard = { label: "Órdenes de Venta activas", count: salesOrdersActiveCount ?? 0, href: "/ordenes-venta", icon: ClipboardList };
    const invoicesPending: DashboardCard = { label: "Facturas pendientes", count: invoicesPendingCount ?? 0, href: "/facturas", icon: Receipt };
    const requisitionsPending: DashboardCard = { label: "Requisiciones pendientes", count: requisitionsPendingCount ?? 0, href: "/requisiciones", icon: ClipboardCheck };
    const purchaseOrdersOpen: DashboardCard = { label: "Órdenes de Compra abiertas", count: purchaseOrdersOpenCount ?? 0, href: "/compras", icon: Package };
    const receiptsPending: DashboardCard = { label: "Recepciones pendientes", count: goodsReceiptsPendingCount ?? 0, href: "/recepciones", icon: PackageCheck };
    const fulfillmentsPending: DashboardCard = { label: "Surtidos pendientes", count: fulfillmentsPendingCount ?? 0, href: "/surtidos", icon: PackageCheck };
    const fulfillmentsShipped: DashboardCard = { label: "Entregas pendientes", count: fulfillmentsShippedCount ?? 0, href: "/surtidos", icon: PackageCheck };
    const workOrdersActive: DashboardCard = { label: "Órdenes de Trabajo activas", count: activeWorkOrdersRaw ?? 0, href: "/pedidos", icon: FileText };

    adminComercialCards = [quotesOpen, quotesDueSoon, salesOrdersActive, invoicesPending];
    adminComprasCards = [requisitionsPending, purchaseOrdersOpen, receiptsPending];
    adminOperacionCards = [fulfillmentsPending, fulfillmentsShipped, workOrdersActive];

    const heroKpis: DashboardCard[] = [quotesOpen, salesOrdersActive, invoicesPending];

    todayPanel = [
      { label: "Cotizaciones por vencer", count: quotesDueSoonCount ?? 0, href: "/cotizaciones" },
      { label: "Recepciones esperadas", count: goodsReceiptsPendingCount ?? 0, href: "/recepciones" },
      { label: "Entregas pendientes", count: fulfillmentsShippedCount ?? 0, href: "/surtidos" },
      { label: "Facturas vencidas", count: invoicesOverdueCount ?? 0, href: "/facturas" },
    ];

    const candidates: AttentionItem[] = [];

    for (const row of (quotesAttentionRows ?? []) as { id: string; folio: string; valid_until: string; customer_name: string | null }[]) {
      const status = classifyPipelineDueDate(row.valid_until, now);
      if (status === "en_tiempo") continue;
      candidates.push({
        id: `quote-${row.id}`,
        type: "Cotización",
        folio: row.folio,
        counterparty: row.customer_name,
        reason: "Vigencia por vencer",
        agingLabel: formatDueInDays(row.valid_until, now),
        severity: status === "vencido" ? "vencido" : "atencion",
        href: `/cotizaciones/${row.id}`,
      });
    }

    for (const row of (soBlockedRows ?? []) as { id: string; order_number: string; created_at: string }[]) {
      const daysOpen = differenceInCalendarDays(now, parseISO(row.created_at));
      candidates.push({
        id: `so-blocked-${row.id}`,
        type: "Orden de Venta",
        folio: row.order_number,
        counterparty: null,
        reason: "Bloqueada por liberación financiera",
        agingLabel: `Abierta hace ${daysOpen} día${daysOpen === 1 ? "" : "s"}`,
        severity: "atencion",
        href: `/ordenes-venta/${row.id}`,
      });
    }

    for (const row of (requisitionsSubmittedRows ?? []) as { id: string; requisition_number: string; requested_at: string }[]) {
      const daysWaiting = differenceInCalendarDays(now, parseISO(row.requested_at));
      candidates.push({
        id: `req-${row.id}`,
        type: "Requisición",
        folio: row.requisition_number,
        counterparty: null,
        reason: "Pendiente de convertir a Orden de Compra",
        agingLabel: `Enviada hace ${daysWaiting} día${daysWaiting === 1 ? "" : "s"}`,
        severity: "pendiente",
        href: `/requisiciones/${row.id}`,
      });
    }

    for (const row of (poOverdueRows ?? []) as { id: string; folio: string; required_date: string }[]) {
      candidates.push({
        id: `po-${row.id}`,
        type: "Orden de Compra",
        folio: row.folio,
        counterparty: null,
        reason: "Fecha requerida vencida",
        agingLabel: formatDueInDays(row.required_date, now),
        severity: "vencido",
        href: `/compras/${row.id}`,
      });
    }

    for (const row of (receiptsDraftRows ?? []) as { id: string; receipt_number: string; received_at: string }[]) {
      const daysWaiting = differenceInCalendarDays(now, parseISO(row.received_at));
      candidates.push({
        id: `receipt-${row.id}`,
        type: "Recepción",
        folio: row.receipt_number,
        counterparty: null,
        reason: "Pendiente de confirmar",
        agingLabel: `Hace ${daysWaiting} día${daysWaiting === 1 ? "" : "s"}`,
        severity: "pendiente",
        href: `/recepciones/${row.id}`,
      });
    }

    for (const row of (fulfillmentsShippedRows ?? []) as { id: string; fulfillment_number: string; shipped_at: string }[]) {
      const daysShipped = differenceInCalendarDays(now, parseISO(row.shipped_at));
      if (daysShipped < SHIPPED_STALE_THRESHOLD_DAYS) continue;
      candidates.push({
        id: `fulfillment-${row.id}`,
        type: "Surtido",
        folio: row.fulfillment_number,
        counterparty: null,
        reason: "Despachado, sin cerrar",
        agingLabel: `Hace ${daysShipped} día${daysShipped === 1 ? "" : "s"}`,
        severity: "atencion",
        href: `/surtidos/${row.id}`,
      });
    }

    for (const row of (invoicesOverdueRows ?? []) as { id: string; invoice_number: string; due_date: string }[]) {
      candidates.push({
        id: `invoice-${row.id}`,
        type: "Factura",
        folio: row.invoice_number,
        counterparty: null,
        reason: "Pago vencido",
        agingLabel: formatDueInDays(row.due_date, now),
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
      // Opción B (ticket V1, decisión 4): señal derivada de sales_orders, NUNCA
      // se consulta sales_fulfillments para un vendedor normal (esa policy
      // no tiene rama de dueño).
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", salespersonId)
        .in("status", ["confirmed", "in_progress"])
        .in("fulfillment_release_status", ["released", "partially_released"]),
      // Sin filtro explícito de salesperson_id: invoices no tiene esa
      // columna directa, y RLS (invoices_select) ya acota a la Sales Order
      // propia — mismo criterio que /facturas/page.tsx.
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["pending", "partially_paid", "overdue"]),
    ]);
    errors.push(v1, v2, v3, v4, v5, v6);

    vendorCards = [
      { label: "Mis cotizaciones abiertas", count: myQuotesOpenCount ?? 0, href: "/cotizaciones", icon: FileSpreadsheet },
      { label: "Mis cotizaciones por vencer", count: myQuotesDueSoonCount ?? 0, href: "/cotizaciones", icon: FileSpreadsheet },
      { label: "Mis Órdenes de Venta", count: mySalesOrdersCount ?? 0, href: "/ordenes-venta", icon: ClipboardList },
      { label: "Pendientes de liberación", count: myBlockedCount ?? 0, href: "/ordenes-venta", icon: ClipboardList },
      { label: "Pendientes de surtido/entrega", count: myPendingFulfillmentCount ?? 0, href: "/ordenes-venta", icon: PackageCheck },
      { label: "Facturas pendientes", count: myInvoicesPendingCount ?? 0, href: "/facturas", icon: Receipt },
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
      { label: "Requisiciones pendientes", count: requisitionsPendingCount ?? 0, href: "/requisiciones", icon: ClipboardCheck },
      { label: "OCs en borrador", count: poDraftCount ?? 0, href: "/compras", icon: Package },
      { label: "OCs ordenadas/confirmadas", count: poOrderedCount ?? 0, href: "/compras", icon: Package },
      { label: "OCs con fecha requerida vencida", count: poOverdueCount ?? 0, href: "/compras", icon: Package },
      { label: "Recepciones pendientes", count: receiptsDraftCount ?? 0, href: "/recepciones", icon: PackageCheck },
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
      // Mismo RPC ya usado por el dashboard V1 y por /inventario (0036) — sin filtro de producto, agregado en JS.
      supabase.rpc("rpc_inventory_incoming_by_product"),
    ]);
    errors.push(l1, l2, l3, l4);

    const incomingTotal = ((incomingRows ?? []) as { incoming: number }[]).reduce((sum, row) => sum + row.incoming, 0);

    logisticaCards = [
      { label: "Recepciones pendientes", count: receiptsDraftCount ?? 0, href: "/recepciones", icon: PackageCheck },
      { label: "Surtidos pendientes", count: fulfillmentsPendingCount ?? 0, href: "/surtidos", icon: PackageCheck },
      { label: "Entregas pendientes", count: fulfillmentsShippedCount ?? 0, href: "/surtidos", icon: PackageCheck },
      { label: "Inventario pendiente de recibir", count: incomingTotal, href: "/inventario", icon: Boxes },
    ];
  }

  // Hero KPIs — mismas tarjetas ya calculadas arriba, nunca un cálculo nuevo.
  // Admin usa las 3 de organización; el resto usa las propias si existen
  // (fallback en cascada: vendedor -> Compras -> Logística -> ninguna).
  const heroKpisRaw: (DashboardCard | undefined)[] = isAdmin && adminComercialCards
    ? [adminComercialCards[0], adminComercialCards[2], adminComercialCards[3]]
    : vendorCards
      ? [vendorCards[0], vendorCards[2], vendorCards[5]]
      : comprasCards
        ? comprasCards.slice(0, 3)
        : logisticaCards
          ? logisticaCards.slice(0, 3)
          : [];
  const heroKpis: DashboardCard[] = heroKpisRaw.filter((card): card is DashboardCard => card !== undefined);

  return {
    name: profile?.name ?? "",
    timezone,
    isAdmin,
    isCompras,
    isLogistica,
    canCreatePurchaseOrder,
    heroKpis,
    adminComercialCards,
    adminComprasCards,
    adminOperacionCards,
    attentionItems,
    todayPanel,
    vendorCards,
    comprasCards,
    logisticaCards,
    activeWorkOrdersCount: activeWorkOrdersRaw ?? 0,
    hasError: errors.some(Boolean),
  };
}
