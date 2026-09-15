import "server-only";
import { SALES_FULFILLMENT_STATUS_LABELS } from "@/types/domain";
import type { SalesFulfillment, SalesFulfillmentItem } from "@/types/domain";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { resolveBranding } from "../branding";
import { buildPdfFilename } from "../filename";
import type { PdfDocumentSpec } from "../types";
import type { PdfDocumentAdapter } from "./types";

/**
 * Mismo criterio que src/app/(app)/surtidos/[id]/page.tsx: select por id,
 * RLS (sales_fulfillments_select) es la única puerta. is_test se resuelve
 * vía sales_orders.is_test (1 salto, FK directa — mismo JOIN que ya usa
 * esa página). Formato de evidencia de entrega (ticket 0078): dirección y
 * contacto vienen de los snapshots ya congelados en la Sales Order
 * (shipping_address_snapshot/customer_contact_snapshot), nunca de
 * customers/customer_contacts en vivo.
 */
export const fulfillmentPdfAdapter: PdfDocumentAdapter = {
  docType: "fulfillment",
  async build({ supabase, id }) {
    const { data } = await supabase.from("sales_fulfillments").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const fulfillment = data as SalesFulfillment;

    const [{ data: soData }, { data: warehouse }, { data: itemsData }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("order_number, customer_id, shipping_address_snapshot, customer_contact_snapshot, is_test")
        .eq("id", fulfillment.sales_order_id)
        .maybeSingle(),
      supabase.from("warehouses").select("name").eq("id", fulfillment.warehouse_id).maybeSingle(),
      supabase.from("sales_fulfillment_items").select("*").eq("sales_fulfillment_id", id).order("created_at"),
    ]);
    const items = (itemsData ?? []) as SalesFulfillmentItem[];

    const { data: customer } = soData
      ? await supabase.from("customers").select("name").eq("id", soData.customer_id).maybeSingle()
      : { data: null };

    const branding = await resolveBranding(supabase, fulfillment.organization_id, null);

    const spec: PdfDocumentSpec = {
      documentTypeLabel: "Sales Fulfillment",
      folio: fulfillment.fulfillment_number,
      statusLabel: SALES_FULFILLMENT_STATUS_LABELS[fulfillment.status] ?? fulfillment.status,
      dateLabel: fulfillment.shipped_at
        ? `Salida: ${formatDate(fulfillment.shipped_at)}`
        : `Creado: ${formatDate(fulfillment.created_at)}`,
      relatedData: [
        { label: "Sales Order", value: soData?.order_number ?? "—" },
        { label: "Cliente", value: customer?.name ?? "—" },
        { label: "Dirección de entrega", value: soData?.shipping_address_snapshot ?? "—" },
        { label: "Contacto", value: soData?.customer_contact_snapshot ?? fulfillment.delivery_contact ?? "—" },
        { label: "Almacén", value: warehouse?.name ?? "—" },
        ...(fulfillment.shipped_at ? [{ label: "Fecha de salida", value: formatDate(fulfillment.shipped_at) }] : []),
        ...(fulfillment.delivered_at ? [{ label: "Fecha de entrega", value: formatDate(fulfillment.delivered_at) }] : []),
      ],
      columns: [
        { key: "description", label: "Producto" },
        { key: "uom", label: "Unidad" },
        { key: "quantity", label: "Cantidad", align: "right" },
      ],
      rows: items.map((item) => ({
        description: item.description_snapshot,
        uom: item.uom_snapshot ?? "—",
        quantity: String(item.quantity_requested),
      })),
      totals: null,
      notes: fulfillment.delivery_notes,
      isTest: soData?.is_test ?? false,
      disclaimer: null,
      branding,
      generatedAtLabel: formatDateTime(new Date().toISOString()),
    };

    return { spec, filename: buildPdfFilename([fulfillment.fulfillment_number]) };
  },
};
