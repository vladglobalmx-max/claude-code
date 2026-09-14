import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canManageSalesFulfillment } from "@/lib/auth/logistics";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SalesFulfillmentLinesForm } from "@/components/sales-fulfillments/sales-fulfillment-lines-form";
import type { CandidateLine } from "@/components/sales-fulfillments/sales-fulfillment-lines-form";
import { createSalesFulfillment } from "../actions";
import type { SalesOrder, SalesOrderItem, Warehouse } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Requiere ?sales_order_id=<uuid> — el único punto de entrada es el botón
 * "Crear surtido" en el detalle de una Sales Order liberada (ver
 * ordenes-venta/[id]/page.tsx). La elegibilidad REAL (status <> draft/
 * cancelled, fulfillment_release_status released/partially_released) la
 * impone trg_check_sales_fulfillment_eligible (0071) al guardar — esta
 * página solo evita mostrar un formulario que fallaría, mismo criterio que
 * /requisiciones/nueva.
 */
export default async function NuevoSurtidoPage({ searchParams }: { searchParams: { sales_order_id?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageSalesFulfillment(profile, capabilities);

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nuevo surtido" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes autoridad de surtido"
            description="Solo un administrador o un usuario con autoridad de surtido puede crear surtidos de Sales Orders."
          />
        </Card>
      </div>
    );
  }

  const salesOrderId = searchParams.sales_order_id;
  if (!salesOrderId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nuevo surtido" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Falta la Sales Order de origen" description="Crea un surtido desde el detalle de una Sales Order liberada." />
        </Card>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: soData }, { data: itemsData }, { data: warehousesData }] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", salesOrderId).maybeSingle(),
    supabase.from("sales_order_items").select("*").eq("sales_order_id", salesOrderId).order("position"),
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
  ]);

  if (!soData) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nuevo surtido" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Sales Order no encontrada" description="No se encontró o no es visible para tu usuario." />
        </Card>
      </div>
    );
  }

  const salesOrder = soData as SalesOrder;

  if (salesOrder.status === "draft" || salesOrder.status === "cancelled" || !["released", "partially_released"].includes(salesOrder.fulfillment_release_status)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nuevo surtido" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Esta Sales Order no puede generar un surtido"
            description="Solo una Sales Order confirmada y financieramente liberada (released o partially_released) puede generar un surtido."
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
  const warehouses = (warehousesData ?? []) as Warehouse[];

  const { data: existingItemsData } = itemIds.length
    ? await supabase
        .from("sales_fulfillment_items")
        .select("sales_order_item_id, quantity_requested, sales_fulfillments(status)")
        .in("sales_order_item_id", itemIds)
    : { data: [] };

  interface FulfillmentJoinRow {
    sales_order_item_id: string;
    quantity_requested: number;
    sales_fulfillments: { status: string } | { status: string }[] | null;
  }
  const alreadyCommittedByItem = new Map<string, number>();
  for (const row of (existingItemsData ?? []) as unknown as FulfillmentJoinRow[]) {
    const parent = Array.isArray(row.sales_fulfillments) ? row.sales_fulfillments[0] : row.sales_fulfillments;
    if (parent?.status === "cancelled") continue;
    const current = alreadyCommittedByItem.get(row.sales_order_item_id) ?? 0;
    alreadyCommittedByItem.set(row.sales_order_item_id, current + row.quantity_requested);
  }

  const candidates: CandidateLine[] = items.map((item) => {
    const alreadyCommitted = alreadyCommittedByItem.get(item.id) ?? 0;
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

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nuevo surtido</h1>
        <p className="mt-1 text-sm text-ink-faint">Sales Order {salesOrder.order_number}</p>
      </div>
      <SalesFulfillmentLinesForm
        mode="create"
        salesOrderId={salesOrder.id}
        candidates={candidates}
        warehouses={warehouses}
        onSubmit={createSalesFulfillment}
      />
    </div>
  );
}
