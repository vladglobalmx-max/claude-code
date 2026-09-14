import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageSalesFulfillment } from "@/lib/auth/logistics";
import { SalesFulfillmentLinesForm } from "@/components/sales-fulfillments/sales-fulfillment-lines-form";
import type { CandidateLine } from "@/components/sales-fulfillments/sales-fulfillment-lines-form";
import { updateSalesFulfillment } from "../../actions";
import type { SalesFulfillment, SalesFulfillmentItem, SalesOrder, SalesOrderItem, Warehouse } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Edición de un surtido — BORRADOR-only (mismo criterio que
 * /requisiciones/[id]/editar): fuera de "draft",
 * trg_sales_fulfillment_item_freeze (0071) congela las líneas en DB —
 * redirige antes de renderizar un formulario que fallaría al guardar.
 *
 * DECISIÓN — "comprometido en otros surtidos" para calcular `remaining`
 * EXCLUYE las líneas de ESTE MISMO surtido (mismo criterio que
 * /requisiciones/[id]/editar): estamos reemplazando su contenido, no
 * sumándolo.
 */
export default async function EditarSurtidoPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageSalesFulfillment(profile, capabilities);

  const supabase = createSupabaseServerClient();
  const { data: sfData } = await supabase.from("sales_fulfillments").select("*").eq("id", params.id).maybeSingle();
  if (!sfData) notFound();
  const fulfillment = sfData as SalesFulfillment;

  if (fulfillment.status !== "draft") {
    redirect(`/surtidos/${fulfillment.id}`);
  }
  if (!canManage) {
    redirect(`/surtidos/${fulfillment.id}`);
  }

  const [{ data: soData }, { data: currentItemsData }] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", fulfillment.sales_order_id).maybeSingle(),
    supabase.from("sales_fulfillment_items").select("*").eq("sales_fulfillment_id", fulfillment.id),
  ]);
  if (!soData) notFound();
  const salesOrder = soData as SalesOrder;
  const currentItems = (currentItemsData ?? []) as SalesFulfillmentItem[];

  const [{ data: itemsData }, { data: warehousesData }] = await Promise.all([
    supabase.from("sales_order_items").select("*").eq("sales_order_id", salesOrder.id).order("position"),
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
  ]);
  const items = (itemsData ?? []) as SalesOrderItem[];
  const itemIds = items.map((i) => i.id);
  const warehouses = (warehousesData ?? []) as Warehouse[];

  const { data: otherItemsData } = itemIds.length
    ? await supabase
        .from("sales_fulfillment_items")
        .select("sales_order_item_id, quantity_requested, sales_fulfillment_id, sales_fulfillments(status)")
        .in("sales_order_item_id", itemIds)
        .neq("sales_fulfillment_id", fulfillment.id)
    : { data: [] };

  interface FulfillmentJoinRow {
    sales_order_item_id: string;
    quantity_requested: number;
    sales_fulfillments: { status: string } | { status: string }[] | null;
  }
  const alreadyCommittedByOthers = new Map<string, number>();
  for (const row of (otherItemsData ?? []) as unknown as FulfillmentJoinRow[]) {
    const parent = Array.isArray(row.sales_fulfillments) ? row.sales_fulfillments[0] : row.sales_fulfillments;
    if (parent?.status === "cancelled") continue;
    const current = alreadyCommittedByOthers.get(row.sales_order_item_id) ?? 0;
    alreadyCommittedByOthers.set(row.sales_order_item_id, current + row.quantity_requested);
  }

  const candidates: CandidateLine[] = items.map((item) => {
    const alreadyCommitted = alreadyCommittedByOthers.get(item.id) ?? 0;
    return {
      salesOrderItemId: item.id,
      skuSnapshot: item.sku_snapshot,
      descriptionSnapshot: item.description_snapshot,
      uomSnapshot: item.uom_snapshot,
      quantity: item.quantity,
      alreadyCommitted,
      remaining: Math.max(0, item.quantity - alreadyCommitted),
    };
  });

  const initialSelection = Object.fromEntries(currentItems.map((i) => [i.sales_order_item_id, { quantity: i.quantity_requested }]));

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar surtido</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {fulfillment.fulfillment_number} · Sales Order {salesOrder.order_number}
        </p>
      </div>
      <SalesFulfillmentLinesForm
        mode="edit"
        salesOrderId={salesOrder.id}
        fulfillmentId={fulfillment.id}
        candidates={candidates}
        warehouses={warehouses}
        initialWarehouseId={fulfillment.warehouse_id}
        initialDeliveryContact={fulfillment.delivery_contact ?? ""}
        initialDeliveryNotes={fulfillment.delivery_notes ?? ""}
        initialSelection={initialSelection}
        onSubmit={updateSalesFulfillment.bind(null, fulfillment.id)}
      />
    </div>
  );
}
