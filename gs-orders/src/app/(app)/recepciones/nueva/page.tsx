import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canReceiveInventory } from "@/lib/auth/logistics";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { GoodsReceiptLinesForm } from "@/components/goods-receipts/goods-receipt-lines-form";
import type { CandidateLine } from "@/components/goods-receipts/goods-receipt-lines-form";
import { createGoodsReceipt } from "../actions";
import { PURCHASE_ORDER_RECEIVABLE_STATUSES } from "@/types/domain";
import type { PurchaseOrder, PurchaseOrderItem, Warehouse } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Requiere ?purchase_order_id=<uuid> — el único punto de entrada es el
 * botón "Recibir mercancía" en el detalle de una Purchase Order recibible
 * (ver compras/[id]/page.tsx). La elegibilidad REAL (status en
 * PURCHASE_ORDER_RECEIVABLE_STATUSES) la impone
 * trg_check_goods_receipt_eligible (0070) al guardar — esta página solo
 * evita mostrar un formulario que fallaría, con el mismo criterio que
 * /requisiciones/nueva.
 */
export default async function NuevaRecepcionPage({ searchParams }: { searchParams: { purchase_order_id?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canReceive = canReceiveInventory(profile, capabilities);

  if (!canReceive) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva recepción de mercancía" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes autoridad de recepción de inventario"
            description="Solo un administrador o un usuario con autoridad de recepción de inventario puede crear recepciones de mercancía."
          />
        </Card>
      </div>
    );
  }

  const purchaseOrderId = searchParams.purchase_order_id;
  if (!purchaseOrderId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva recepción de mercancía" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Falta la Purchase Order de origen"
            description="Crea una recepción desde el detalle de una Purchase Order."
          />
        </Card>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: poData }, { data: itemsData }, { data: warehousesData }] = await Promise.all([
    supabase.from("purchase_orders").select("*, suppliers(name)").eq("id", purchaseOrderId).maybeSingle(),
    supabase.from("purchase_order_items").select("*").eq("purchase_order_id", purchaseOrderId).order("position"),
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
  ]);

  if (!poData) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva recepción de mercancía" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Purchase Order no encontrada" description="No se encontró o no es visible para tu usuario." />
        </Card>
      </div>
    );
  }

  const purchaseOrder = poData as unknown as PurchaseOrder & { suppliers: { name: string } | { name: string }[] | null };
  const supplierName = Array.isArray(purchaseOrder.suppliers) ? purchaseOrder.suppliers[0]?.name : purchaseOrder.suppliers?.name;

  if (!PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(purchaseOrder.status)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva recepción de mercancía" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Esta Purchase Order no puede recibir mercancía"
            description="Solo una Purchase Order fuera de borrador y no cancelada puede recibir mercancía."
            action={
              <Link href={`/compras/${purchaseOrder.id}`} className="text-sm text-accent hover:underline">
                Volver a la Purchase Order
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

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

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva recepción de mercancía</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Purchase Order {purchaseOrder.folio} · {supplierName ?? "—"}
        </p>
      </div>
      <GoodsReceiptLinesForm
        mode="create"
        purchaseOrderId={purchaseOrder.id}
        candidates={candidates}
        warehouses={warehouses}
        onSubmit={createGoodsReceipt}
      />
    </div>
  );
}
