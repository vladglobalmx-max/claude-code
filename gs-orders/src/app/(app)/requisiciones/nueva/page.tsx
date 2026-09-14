import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseRequisitionLinesForm } from "@/components/purchase-requisitions/purchase-requisition-lines-form";
import type { CandidateLine } from "@/components/purchase-requisitions/purchase-requisition-lines-form";
import { createPurchaseRequisition } from "../actions";
import type { SalesOrder, SalesOrderItem } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Requiere ?sales_order_id=<uuid> — el único punto de entrada es el botón
 * "Crear requisición de compra" en el detalle de una Sales Order liberada
 * (ver sales-order-financial-panel.tsx). La elegibilidad REAL
 * (status <> draft, fulfillment_release_status released/partially_released)
 * la impone trg_purchase_requisitions_eligible (0069) al guardar — esta
 * página solo evita mostrar un formulario que fallaría, con el mismo
 * criterio que /cotizaciones/[id]/editar.
 */
export default async function NuevaRequisicionPage({ searchParams }: { searchParams: { sales_order_id?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canPrepare = canPreparePurchaseOrders(profile, capabilities);

  if (!canPrepare) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva requisición de compra" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes autoridad de Compras"
            description="Solo un administrador o un usuario con autoridad de preparación de Compras puede crear requisiciones."
          />
        </Card>
      </div>
    );
  }

  const salesOrderId = searchParams.sales_order_id;
  if (!salesOrderId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva requisición de compra" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Falta la Sales Order de origen"
            description="Crea una requisición desde el detalle de una Sales Order liberada."
          />
        </Card>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: soData }, { data: itemsData }] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", salesOrderId).maybeSingle(),
    supabase.from("sales_order_items").select("*").eq("sales_order_id", salesOrderId).order("position"),
  ]);

  if (!soData) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva requisición de compra" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Sales Order no encontrada" description="No se encontró o no es visible para tu usuario." />
        </Card>
      </div>
    );
  }

  const salesOrder = soData as SalesOrder;

  if (salesOrder.status === "draft" || !["released", "partially_released"].includes(salesOrder.fulfillment_release_status)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva requisición de compra" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Esta Sales Order no puede originar una requisición"
            description="Solo una Sales Order confirmada y financieramente liberada (released o partially_released) puede generar una requisición de compra."
            action={
              <Link href={`/ordenes-venta/${salesOrder.id}`} className="text-sm text-accent hover:underline">
                Volver a la Sales Order
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const items = (itemsData ?? []) as SalesOrderItem[];
  const itemIds = items.map((i) => i.id);

  const [{ data: customerData }, { data: existingItemsData }] = await Promise.all([
    supabase.from("customers").select("name").eq("id", salesOrder.customer_id).maybeSingle(),
    itemIds.length
      ? supabase
          .from("purchase_requisition_items")
          .select("sales_order_item_id, quantity_required, purchase_requisitions(status)")
          .in("sales_order_item_id", itemIds)
      : Promise.resolve({ data: [] }),
  ]);

  interface RequisitionJoinRow {
    sales_order_item_id: string;
    quantity_required: number;
    purchase_requisitions: { status: string } | { status: string }[] | null;
  }
  const alreadyRequisitionedByItem = new Map<string, number>();
  for (const row of (existingItemsData ?? []) as unknown as RequisitionJoinRow[]) {
    const parent = Array.isArray(row.purchase_requisitions) ? row.purchase_requisitions[0] : row.purchase_requisitions;
    if (parent?.status === "cancelled") continue;
    const current = alreadyRequisitionedByItem.get(row.sales_order_item_id) ?? 0;
    alreadyRequisitionedByItem.set(row.sales_order_item_id, current + row.quantity_required);
  }

  // Sugerencia de proveedor por línea — mismo criterio que el RPC
  // (referencia ACTIVA + PREFERRED), solo informativo aquí: el RPC vuelve
  // a resolverla server-side al guardar, esto es preview.
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
    const alreadyRequisitioned = alreadyRequisitionedByItem.get(item.id) ?? 0;
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

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva requisición de compra</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Sales Order {salesOrder.order_number} · {customerData?.name ?? "—"}
        </p>
      </div>
      <PurchaseRequisitionLinesForm
        mode="create"
        salesOrderId={salesOrder.id}
        candidates={candidates}
        onSubmit={createPurchaseRequisition}
      />
    </div>
  );
}
