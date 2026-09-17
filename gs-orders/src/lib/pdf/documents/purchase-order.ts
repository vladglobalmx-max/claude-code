import "server-only";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec, PdfTotalsRow } from "../types";
import type { PdfDocumentAdapter } from "./types";
import {
  purchaseOrderLabel,
  translatePurchaseOrderStatus,
  translatePurchaseOrderDate,
  translatePurchaseOrderDateTime,
} from "./purchase-order-i18n";

/**
 * Mismo criterio que src/app/(app)/compras/[id]/page.tsx: select por id +
 * join a suppliers, RLS (purchase_orders_select) es la única puerta.
 * Formato "para enviar al proveedor" (ticket 0078): SOLO
 * proveedor/folio/referencia/fechas/referencias-modelos de proveedor/
 * cantidades/unidad/notas — deliberadamente NO incluye campos internos
 * (order_id/business_unit, customer_requirements, quantity_received,
 * sequence_number) que no le corresponden a un tercero externo.
 *
 * THÖREN — Orden de Compra Directa (0081): una Purchase Order con
 * origin='directa' SÍ tiene precios/moneda/idioma de documento propios
 * (a diferencia de Pedido/Requisición, que nunca capturaron esos datos) —
 * el PDF respeta document_language (snapshot, ver purchase-order-i18n.ts)
 * y agrega precio unitario/impuesto/importe por línea + totales, y resuelve
 * el branding real de su Business Unit. Para origin='pedido'/'requisicion'
 * el documento se mantiene EXACTAMENTE igual que antes de 0081 (sin tocar
 * "PDFs actuales", requisito explícito del ticket).
 */
export const purchaseOrderPdfAdapter: PdfDocumentAdapter = {
  docType: "purchase-order",
  async build({ supabase, id }) {
    const { data } = await supabase.from("purchase_orders").select("*, supplier:suppliers(*)").eq("id", id).maybeSingle();
    if (!data) return null;
    const raw = data as PurchaseOrder & { supplier: Supplier | Supplier[] | null };
    const purchaseOrder: PurchaseOrder = raw;
    const supplier = Array.isArray(raw.supplier) ? (raw.supplier[0] ?? null) : raw.supplier;

    const { data: itemsData } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", id)
      .order("position");
    const items = (itemsData ?? []) as PurchaseOrderItem[];

    const isDirect = purchaseOrder.origin === "directa";
    const language = isDirect ? purchaseOrder.document_language : "es";

    let destinationWarehouseName: string | null = null;
    if (isDirect && purchaseOrder.destination_warehouse_id) {
      const { data: warehouse } = await supabase
        .from("warehouses")
        .select("name")
        .eq("id", purchaseOrder.destination_warehouse_id)
        .maybeSingle();
      destinationWarehouseName = warehouse?.name ?? null;
    }

    const branding = await resolveBranding(
      supabase,
      purchaseOrder.organization_id,
      isDirect ? purchaseOrder.business_unit_id : null
    );

    const documentTypeLabel = isDirect ? purchaseOrderLabel("documentType", language) : "Purchase Order";
    const statusLabel = isDirect
      ? translatePurchaseOrderStatus(purchaseOrder.status, language, PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status])
      : (PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status] ?? purchaseOrder.status);

    const relatedData = isDirect
      ? [
          { label: purchaseOrderLabel("supplier", language), value: supplier?.name ?? "—" },
          ...(purchaseOrder.required_date
            ? [
                {
                  label: purchaseOrderLabel("requiredDate", language),
                  value: translatePurchaseOrderDate(purchaseOrder.required_date, language, formatDate(purchaseOrder.required_date)),
                },
              ]
            : []),
          ...(purchaseOrder.payment_terms
            ? [{ label: purchaseOrderLabel("paymentTerms", language), value: purchaseOrder.payment_terms }]
            : []),
          ...(destinationWarehouseName ? [{ label: purchaseOrderLabel("shipTo", language), value: destinationWarehouseName }] : []),
        ]
      : [
          { label: "Proveedor", value: supplier?.name ?? "—" },
          { label: "Referencia proveedor", value: purchaseOrder.supplier_reference ?? "—" },
          ...(purchaseOrder.supplier_commitment_date
            ? [{ label: "Fecha compromiso proveedor", value: formatDate(purchaseOrder.supplier_commitment_date) }]
            : []),
          ...(purchaseOrder.estimated_reception_date
            ? [{ label: "Fecha estimada de recepción", value: formatDate(purchaseOrder.estimated_reception_date) }]
            : []),
        ];

    const columns = isDirect
      ? [
          { key: "description", label: purchaseOrderLabel("description", language) },
          { key: "unit", label: purchaseOrderLabel("unit", language) },
          { key: "quantity", label: purchaseOrderLabel("quantity", language), align: "right" as const },
          { key: "unitPrice", label: purchaseOrderLabel("unitPrice", language), align: "right" as const },
          { key: "amount", label: purchaseOrderLabel("amount", language), align: "right" as const },
        ]
      : [
          { key: "reference", label: "Referencia/modelo proveedor" },
          { key: "description", label: "Descripción" },
          { key: "unit", label: "Unidad" },
          { key: "quantity", label: "Cantidad", align: "right" as const },
        ];

    const formatMoney = (value: number | null) => (value != null ? `$${value.toFixed(2)}` : "—");

    const rows = isDirect
      ? items.map((item) => ({
          description: item.description ?? item.model,
          unit: item.unit ?? "—",
          quantity: String(item.quantity_ordered),
          unitPrice: formatMoney(item.unit_price),
          amount: formatMoney(item.line_total),
        }))
      : items.map((item) => ({
          reference: item.supplier_sku_snapshot ?? item.supplier_model_snapshot ?? "—",
          description: item.supplier_description_snapshot ?? item.description ?? item.model,
          unit: item.supplier_uom_snapshot ?? item.unit ?? "—",
          quantity: String(item.quantity_ordered),
        }));

    const totals: PdfTotalsRow[] | null = isDirect
      ? [
          { label: purchaseOrderLabel("subtotal", language), value: formatMoney(purchaseOrder.subtotal) },
          { label: purchaseOrderLabel("taxes", language), value: formatMoney(purchaseOrder.tax_total) },
          {
            label: purchaseOrderLabel("total", language),
            value: `${formatMoney(purchaseOrder.total)} ${purchaseOrder.currency ?? ""}`.trim(),
            emphasis: true,
          },
        ]
      : null;

    const generatedAtIso = new Date().toISOString();

    const spec: PdfDocumentSpec = {
      documentTypeLabel,
      folio: purchaseOrder.folio,
      statusLabel,
      dateLabel: `${isDirect ? purchaseOrderLabel("date", language) : "Fecha"}: ${
        isDirect ? translatePurchaseOrderDate(purchaseOrder.po_date, language, formatDate(purchaseOrder.po_date)) : formatDate(purchaseOrder.po_date)
      }`,
      relatedData,
      columns,
      rows,
      totals,
      notes: purchaseOrder.notes,
      isTest: purchaseOrder.is_test,
      disclaimer: null,
      branding,
      generatedAtLabel: isDirect
        ? translatePurchaseOrderDateTime(generatedAtIso, language, formatDateTime(generatedAtIso))
        : formatDateTime(generatedAtIso),
      ...(isDirect
        ? {
            relatedDataSectionLabel: purchaseOrderLabel("relatedData", language),
            notesSectionLabel: purchaseOrderLabel("notes", language),
            generatedAtPrefixLabel: purchaseOrderLabel("generatedOn", language),
          }
        : {}),
    };

    return { spec, filename: buildPdfFilename([purchaseOrder.folio]) };
  },
};
