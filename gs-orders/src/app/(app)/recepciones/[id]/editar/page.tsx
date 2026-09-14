import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canReceiveInventory } from "@/lib/auth/logistics";
import { GoodsReceiptLinesForm } from "@/components/goods-receipts/goods-receipt-lines-form";
import type { CandidateLine } from "@/components/goods-receipts/goods-receipt-lines-form";
import { updateGoodsReceipt } from "../../actions";
import type { GoodsReceipt, GoodsReceiptItem, PurchaseOrder, PurchaseOrderItem, Warehouse } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Edición de una recepción de mercancía — BORRADOR-only (mismo criterio
 * que /requisiciones/[id]/editar): fuera de "draft",
 * trg_goods_receipt_items_freeze (0070) congela las líneas en DB —
 * redirige antes de renderizar un formulario que fallaría al guardar.
 *
 * A diferencia de /requisiciones/[id]/editar, aquí NO hace falta excluir
 * "lo ya reservado por esta misma recepción" al calcular `remaining`:
 * purchase_order_items.quantity_received solo refleja recepciones YA
 * POSTED — esta recepción sigue en draft, así que sus propias líneas
 * todavía no contribuyeron nada a ese acumulado.
 */
export default async function EditarRecepcionPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canReceive = canReceiveInventory(profile, capabilities);

  const supabase = createSupabaseServerClient();
  const { data: grData } = await supabase.from("goods_receipts").select("*").eq("id", params.id).maybeSingle();
  if (!grData) notFound();
  const goodsReceipt = grData as GoodsReceipt;

  if (goodsReceipt.status !== "draft") {
    redirect(`/recepciones/${goodsReceipt.id}`);
  }
  if (!canReceive) {
    redirect(`/recepciones/${goodsReceipt.id}`);
  }

  const [{ data: poData }, { data: currentItemsData }] = await Promise.all([
    supabase.from("purchase_orders").select("*").eq("id", goodsReceipt.purchase_order_id).maybeSingle(),
    supabase.from("goods_receipt_items").select("*").eq("goods_receipt_id", goodsReceipt.id),
  ]);
  if (!poData) notFound();
  const purchaseOrder = poData as PurchaseOrder;
  const currentItems = (currentItemsData ?? []) as GoodsReceiptItem[];

  const [{ data: itemsData }, { data: warehousesData }] = await Promise.all([
    supabase.from("purchase_order_items").select("*").eq("purchase_order_id", purchaseOrder.id).order("position"),
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
  ]);
  const items = (itemsData ?? []) as PurchaseOrderItem[];
  const warehouses = (warehousesData ?? []) as Warehouse[];

  const candidates: CandidateLine[] = items.map((item) => ({
    purchaseOrderItemId: item.id,
    model: item.model,
    description: item.description,
    unit: item.unit,
    quantityOrdered: item.quantity_ordered,
    alreadyReceived: item.quantity_received,
    remaining: Math.max(0, item.quantity_ordered - item.quantity_received),
  }));

  const initialSelection = Object.fromEntries(currentItems.map((i) => [i.purchase_order_item_id, { quantity: i.quantity_received }]));

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Editar recepción de mercancía</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {goodsReceipt.receipt_number} · Purchase Order {purchaseOrder.folio}
        </p>
      </div>
      <GoodsReceiptLinesForm
        mode="edit"
        purchaseOrderId={purchaseOrder.id}
        goodsReceiptId={goodsReceipt.id}
        candidates={candidates}
        warehouses={warehouses}
        initialWarehouseId={goodsReceipt.warehouse_id}
        initialReceivedAt={goodsReceipt.received_at}
        initialSupplierDocumentNumber={goodsReceipt.supplier_document_number ?? ""}
        initialNotes={goodsReceipt.notes ?? ""}
        initialSelection={initialSelection}
        onSubmit={updateGoodsReceipt.bind(null, goodsReceipt.id)}
      />
    </div>
  );
}
