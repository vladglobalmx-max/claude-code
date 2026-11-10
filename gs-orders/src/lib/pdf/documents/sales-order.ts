import "server-only";
import { SALES_ORDER_STATUS_LABELS, SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS } from "@/types/domain";
import type { SalesOrder, SalesOrderItem } from "@/types/domain";
import { formatDate, formatDateTime, formatMoneyByCurrency } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * Mismo criterio de acceso que src/app/(app)/ordenes-venta/[id]/page.tsx:
 * un simple select por id vía el cliente con sesión — RLS (sales_orders_select)
 * es la única puerta. Sin JOIN a datos maestros más allá de nombre de
 * cliente/vendedor (texto de despliegue, no reconstrucción de montos —
 * los montos/línea vienen 100% de columnas ya guardadas en la propia SO).
 */
export const salesOrderPdfAdapter: PdfDocumentAdapter = {
  docType: "sales-order",
  async build({ supabase, id }) {
    const { data } = await supabase.from("sales_orders").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const salesOrder = data as SalesOrder;

    const [{ data: itemsData }, { data: customer }, { data: salesperson }] = await Promise.all([
      supabase.from("sales_order_items").select("*").eq("sales_order_id", id).order("position"),
      supabase.from("customers").select("name").eq("id", salesOrder.customer_id).maybeSingle(),
      supabase.from("salespeople").select("name").eq("id", salesOrder.salesperson_id).maybeSingle(),
    ]);
    const items = (itemsData ?? []) as SalesOrderItem[];

    // THÖREN | PDF — CORRECCIÓN FINAL DE DISEÑO: a diferencia de los otros
    // 6 adapters (que no tienen concepto de Business Unit propio, 0078),
    // sales_orders.business_unit_id SÍ existe desde 0088 — se resuelve el
    // logo real de la BU en vez de pasar null a propósito, como hacían
    // antes los 7. Si la BU no tiene logo o business_unit_id es null (SO
    // creada antes de tener BU asignada), resolveBranding cae a texto
    // plano (nombre de BU/organización) — nunca una inicial decorativa.
    const branding = await resolveBranding(supabase, salesOrder.organization_id, salesOrder.business_unit_id);

    const spec: PdfDocumentSpec = {
      // THÖREN | PDF — CORRECCIÓN FINAL DE DISEÑO: "Pedido" (no "Sales
      // Order") — mismo término ya usado en la navegación/UI desde el
      // Ticket E1 ("Pedidos" en nav-config.ts); el nombre técnico interno
      // (Sales Order) queda en comentarios de código, nunca en lo que ve
      // el usuario.
      documentTypeLabel: "Pedido",
      folio: salesOrder.order_number,
      statusLabel: SALES_ORDER_STATUS_LABELS[salesOrder.status] ?? salesOrder.status,
      dateLabel: `Creada: ${formatDate(salesOrder.created_at)}`,
      relatedData: [
        { label: "Cliente", value: customer?.name ?? "—" },
        { label: "Vendedor", value: salesperson?.name ?? "—" },
        { label: "Moneda", value: salesOrder.currency },
        {
          label: "Condición de pago",
          value: SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS[salesOrder.payment_terms_type] ?? salesOrder.payment_terms_type,
        },
        ...(salesOrder.requested_delivery_date
          ? [{ label: "Fecha requerida", value: formatDate(salesOrder.requested_delivery_date) }]
          : []),
        ...(salesOrder.shipping_address_snapshot ? [{ label: "Dirección de entrega", value: salesOrder.shipping_address_snapshot }] : []),
      ],
      columns: [
        { key: "sku", label: "SKU" },
        { key: "description", label: "Descripción" },
        { key: "quantity", label: "Cant.", align: "right" },
        { key: "unitPrice", label: "P. Unit.", align: "right" },
        { key: "total", label: "Total", align: "right" },
      ],
      rows: items.map((item) => ({
        sku: item.sku_snapshot,
        description: item.description_snapshot ?? "",
        quantity: String(item.quantity),
        unitPrice: formatMoneyByCurrency(item.unit_price, salesOrder.currency),
        total: formatMoneyByCurrency(item.line_total, salesOrder.currency),
      })),
      totals: [
        { label: "Subtotal", value: formatMoneyByCurrency(salesOrder.subtotal, salesOrder.currency) },
        { label: "Impuestos", value: formatMoneyByCurrency(salesOrder.tax_total, salesOrder.currency) },
        { label: "Total", value: formatMoneyByCurrency(salesOrder.total, salesOrder.currency), emphasis: true },
      ],
      notes: salesOrder.commercial_notes,
      isTest: salesOrder.is_test,
      disclaimer: null,
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return { spec, filename: buildPdfFilename([salesOrder.order_number]) };
  },
};
