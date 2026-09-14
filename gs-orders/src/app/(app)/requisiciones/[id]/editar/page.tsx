import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { PurchaseRequisitionLinesForm } from "@/components/purchase-requisitions/purchase-requisition-lines-form";
import type { CandidateLine } from "@/components/purchase-requisitions/purchase-requisition-lines-form";
import { updatePurchaseRequisition } from "../../actions";
import type { PurchaseRequisition, PurchaseRequisitionItem, SalesOrder, SalesOrderItem } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Edición de una Purchase Requisition — BORRADOR-only (mismo criterio que
 * /cotizaciones/[id]/editar): fuera de "draft",
 * trg_purchase_requisition_item_freeze (0069) congela las líneas en DB —
 * redirige antes de renderizar un formulario que fallaría al guardar.
 *
 * DECISIÓN — "Requisicionado por otras" para calcular `remaining` EXCLUYE
 * las líneas de ESTA MISMA requisición (a diferencia de /requisiciones/nueva):
 * estamos reemplazando su contenido, no sumándolo — si no se excluyera,
 * cada línea ya guardada se contaría dos veces y el remaining bajaría
 * artificialmente.
 */
export default async function EditarRequisicionPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canPrepare = canPreparePurchaseOrders(profile, capabilities);

  const supabase = createSupabaseServerClient();
  const { data: reqData } = await supabase.from("purchase_requisitions").select("*").eq("id", params.id).maybeSingle();
  if (!reqData) notFound();
  const requisition = reqData as PurchaseRequisition;

  if (requisition.status !== "draft") {
    redirect(`/requisiciones/${requisition.id}`);
  }
  if (!canPrepare) {
    redirect(`/requisiciones/${requisition.id}`);
  }

  const [{ data: soData }, { data: currentItemsData }] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", requisition.sales_order_id).maybeSingle(),
    supabase.from("purchase_requisition_items").select("*").eq("purchase_requisition_id", requisition.id),
  ]);
  if (!soData) notFound();
  const salesOrder = soData as SalesOrder;
  const currentItems = (currentItemsData ?? []) as PurchaseRequisitionItem[];

  const { data: itemsData } = await supabase.from("sales_order_items").select("*").eq("sales_order_id", salesOrder.id).order("position");
  const items = (itemsData ?? []) as SalesOrderItem[];
  const itemIds = items.map((i) => i.id);

  const { data: otherItemsData } = itemIds.length
    ? await supabase
        .from("purchase_requisition_items")
        .select("sales_order_item_id, quantity_required, purchase_requisition_id, purchase_requisitions(status)")
        .in("sales_order_item_id", itemIds)
        .neq("purchase_requisition_id", requisition.id)
    : { data: [] };

  interface RequisitionJoinRow {
    sales_order_item_id: string;
    quantity_required: number;
    purchase_requisitions: { status: string } | { status: string }[] | null;
  }
  const alreadyRequisitionedByOthers = new Map<string, number>();
  for (const row of (otherItemsData ?? []) as unknown as RequisitionJoinRow[]) {
    const parent = Array.isArray(row.purchase_requisitions) ? row.purchase_requisitions[0] : row.purchase_requisitions;
    if (parent?.status === "cancelled") continue;
    const current = alreadyRequisitionedByOthers.get(row.sales_order_item_id) ?? 0;
    alreadyRequisitionedByOthers.set(row.sales_order_item_id, current + row.quantity_required);
  }

  const catalogProductIds = Array.from(new Set(items.map((i) => i.catalog_product_id).filter((id): id is string => !!id)));
  const { data: referencesData } = catalogProductIds.length
    ? await supabase
        .from("supplier_product_references")
        .select("catalog_product_id, suppliers(name)")
        .in("catalog_product_id", catalogProductIds)
        .eq("active", true)
        .eq("preferred", true)
    : { data: [] };

  interface SupplierJoinRow {
    catalog_product_id: string;
    suppliers: { name: string } | { name: string }[] | null;
  }
  const suggestedSupplierByProduct = new Map<string, string>();
  for (const row of (referencesData ?? []) as unknown as SupplierJoinRow[]) {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    if (supplier?.name) suggestedSupplierByProduct.set(row.catalog_product_id, supplier.name);
  }

  const candidates: CandidateLine[] = items.map((item) => {
    // "Requisicionado por otras" EXCLUYE esta requisición (ver DECISIÓN
    // arriba) — lo disponible para esta línea es simplemente lo que le
    // queda a la Sales Order fuera de otras requisiciones activas.
    const alreadyRequisitioned = alreadyRequisitionedByOthers.get(item.id) ?? 0;
    return {
      salesOrderItemId: item.id,
      skuSnapshot: item.sku_snapshot,
      descriptionSnapshot: item.description_snapshot,
      uomSnapshot: item.uom_snapshot,
      quantity: item.quantity,
      alreadyRequisitioned,
      remaining: Math.max(0, item.quantity - alreadyRequisitioned),
      suggestedSupplierName: item.catalog_product_id ? (suggestedSupplierByProduct.get(item.catalog_product_id) ?? null) : null,
    };
  });

  const initialSelection = Object.fromEntries(currentItems.map((i) => [i.sales_order_item_id, { quantity: i.quantity_required }]));

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar requisición de compra</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {requisition.requisition_number} · Sales Order {salesOrder.order_number}
        </p>
      </div>
      <PurchaseRequisitionLinesForm
        mode="edit"
        salesOrderId={salesOrder.id}
        requisitionId={requisition.id}
        candidates={candidates}
        initialNotes={requisition.notes ?? ""}
        initialSelection={initialSelection}
        onSubmit={updatePurchaseRequisition.bind(null, requisition.id)}
      />
    </div>
  );
}
