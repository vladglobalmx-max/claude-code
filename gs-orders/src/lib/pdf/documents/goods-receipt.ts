import "server-only";
import { GOODS_RECEIPT_STATUS_LABELS } from "@/types/domain";
import type { GoodsReceipt, GoodsReceiptItem } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * Mismo criterio que src/app/(app)/recepciones/[id]/page.tsx: select por
 * id, RLS (goods_receipts_select) es la única puerta. is_test se resuelve
 * vía purchase_orders.is_test (snapshot, 1 salto — mismo JOIN que ya usa
 * esa página). Formato de evidencia de recepción (ticket 0078): sin
 * totales monetarios (no aplica a este documento).
 */
export const goodsReceiptPdfAdapter: PdfDocumentAdapter = {
  docType: "goods-receipt",
  async build({ supabase, id }) {
    const { data } = await supabase.from("goods_receipts").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const goodsReceipt = data as GoodsReceipt;

    const [{ data: poData }, { data: warehouse }, { data: itemsData }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("folio, supplier_id, is_test, suppliers(name)")
        .eq("id", goodsReceipt.purchase_order_id)
        .maybeSingle(),
      supabase.from("warehouses").select("name").eq("id", goodsReceipt.warehouse_id).maybeSingle(),
      supabase.from("goods_receipt_items").select("*").eq("goods_receipt_id", id).order("created_at"),
    ]);
    const items = (itemsData ?? []) as GoodsReceiptItem[];
    const supplierRelation = poData?.suppliers as { name: string } | { name: string }[] | null | undefined;
    const supplierName = Array.isArray(supplierRelation) ? (supplierRelation[0]?.name ?? null) : (supplierRelation?.name ?? null);

    const branding = await resolveBranding(supabase, goodsReceipt.organization_id, null);

    const spec: PdfDocumentSpec = {
      documentTypeLabel: "Goods Receipt",
      folio: goodsReceipt.receipt_number,
      statusLabel: GOODS_RECEIPT_STATUS_LABELS[goodsReceipt.status] ?? goodsReceipt.status,
      dateLabel: `Recibida: ${formatDate(goodsReceipt.received_at)}`,
      relatedData: [
        { label: "Purchase Order", value: poData?.folio ?? "—" },
        { label: "Proveedor", value: supplierName ?? "—" },
        { label: "Almacén", value: warehouse?.name ?? "—" },
        { label: "Documento de proveedor", value: goodsReceipt.supplier_document_number ?? "—" },
      ],
      columns: [
        { key: "description", label: "Descripción" },
        { key: "uom", label: "Unidad" },
        { key: "quantity", label: "Cant. recibida", align: "right" },
      ],
      rows: items.map((item) => ({
        description: item.description_snapshot,
        uom: item.uom_snapshot ?? "—",
        quantity: String(item.quantity_received),
      })),
      totals: null,
      notes: goodsReceipt.notes,
      isTest: poData?.is_test ?? false,
      disclaimer: null,
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return { spec, filename: buildPdfFilename([goodsReceipt.receipt_number]) };
  },
};
