import "server-only";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * Mismo criterio que src/app/(app)/compras/[id]/page.tsx: select por id +
 * join a suppliers, RLS (purchase_orders_select) es la única puerta.
 * Formato "para enviar al proveedor" (ticket 0078): SOLO
 * proveedor/folio/referencia/fechas/referencias-modelos de proveedor/
 * cantidades/unidad/notas — deliberadamente NO incluye campos internos
 * (order_id/business_unit, customer_requirements, quantity_received,
 * sequence_number) que no le corresponden a un tercero externo.
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

    const branding = await resolveBranding(supabase, purchaseOrder.organization_id, null);

    const spec: PdfDocumentSpec = {
      documentTypeLabel: "Purchase Order",
      folio: purchaseOrder.folio,
      statusLabel: PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status] ?? purchaseOrder.status,
      dateLabel: `Fecha: ${formatDate(purchaseOrder.po_date)}`,
      relatedData: [
        { label: "Proveedor", value: supplier?.name ?? "—" },
        { label: "Referencia proveedor", value: purchaseOrder.supplier_reference ?? "—" },
        ...(purchaseOrder.supplier_commitment_date
          ? [{ label: "Fecha compromiso proveedor", value: formatDate(purchaseOrder.supplier_commitment_date) }]
          : []),
        ...(purchaseOrder.estimated_reception_date
          ? [{ label: "Fecha estimada de recepción", value: formatDate(purchaseOrder.estimated_reception_date) }]
          : []),
      ],
      columns: [
        { key: "reference", label: "Referencia/modelo proveedor" },
        { key: "description", label: "Descripción" },
        { key: "unit", label: "Unidad" },
        { key: "quantity", label: "Cantidad", align: "right" },
      ],
      rows: items.map((item) => ({
        reference: item.supplier_sku_snapshot ?? item.supplier_model_snapshot ?? "—",
        description: item.supplier_description_snapshot ?? item.description ?? item.model,
        unit: item.supplier_uom_snapshot ?? item.unit ?? "—",
        quantity: String(item.quantity_ordered),
      })),
      totals: null,
      notes: purchaseOrder.notes,
      isTest: purchaseOrder.is_test,
      disclaimer: null,
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return { spec, filename: buildPdfFilename([purchaseOrder.folio]) };
  },
};
