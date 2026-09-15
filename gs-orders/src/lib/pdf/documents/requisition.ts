import "server-only";
import { PURCHASE_REQUISITION_STATUS_LABELS } from "@/types/domain";
import type { PurchaseRequisition, PurchaseRequisitionItem } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * Mismo criterio que src/app/(app)/requisiciones/[id]/page.tsx: select por
 * id, RLS (purchase_requisitions_select) es la única puerta. is_test se
 * resuelve con el mismo JOIN a sales_orders que ya usa esa página (1 salto,
 * FK directa y NOT NULL).
 */
export const requisitionPdfAdapter: PdfDocumentAdapter = {
  docType: "requisition",
  async build({ supabase, id }) {
    const { data } = await supabase.from("purchase_requisitions").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const requisition = data as PurchaseRequisition;

    const [{ data: soData }, { data: itemsData }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("order_number, customer_id, is_test")
        .eq("id", requisition.sales_order_id)
        .maybeSingle(),
      supabase.from("purchase_requisition_items").select("*").eq("purchase_requisition_id", id).order("created_at"),
    ]);
    const items = (itemsData ?? []) as PurchaseRequisitionItem[];

    const { data: customer } = soData
      ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
      : { data: null };

    const branding = await resolveBranding(supabase, requisition.organization_id, null);

    const spec: PdfDocumentSpec = {
      documentTypeLabel: "Purchase Requisition",
      folio: requisition.requisition_number,
      statusLabel: PURCHASE_REQUISITION_STATUS_LABELS[requisition.status] ?? requisition.status,
      dateLabel: `Solicitada: ${formatDate(requisition.requested_at)}`,
      relatedData: [
        { label: "Sales Order", value: soData?.order_number ?? "—" },
        { label: "Cliente", value: customer?.name ?? "—" },
      ],
      columns: [
        { key: "description", label: "Descripción" },
        { key: "uom", label: "Unidad" },
        { key: "required", label: "Cant. requerida", align: "right" },
        { key: "ordered", label: "Cant. ordenada", align: "right" },
      ],
      rows: items.map((item) => ({
        description: item.description_snapshot,
        uom: item.uom_snapshot ?? "—",
        required: String(item.quantity_required),
        ordered: String(item.quantity_ordered),
      })),
      totals: null,
      notes: requisition.notes,
      isTest: soData?.is_test ?? false,
      disclaimer: null,
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return { spec, filename: buildPdfFilename([requisition.requisition_number]) };
  },
};
