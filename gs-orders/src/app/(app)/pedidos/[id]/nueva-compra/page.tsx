import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { getBusinessToday } from "@/lib/business-date";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier } from "@/types/domain";
import { NewPurchaseOrderForm } from "./new-purchase-order-form";

/**
 * THÖREN 6R.1B-3B — admin OR can_prepare_purchase_orders puede crear una
 * Purchase Order (ver src/lib/auth/purchase-orders.ts, 0045). Redirige
 * antes de renderizar el formulario, igual que /clientes/[id]/editar.
 * Deliberadamente NO usa canWriteRecord del Pedido — preparar una OC
 * desde un Pedido ajeno es válido para Karla/Rodolfo, y la capability de
 * preparación nunca abre edición comercial del Pedido en sí.
 */
export default async function NuevaCompraPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  if (!canPreparePurchaseOrders(profile, capabilities)) {
    redirect(`/pedidos/${params.id}`);
  }

  const detail = await getOrderDetail(params.id);
  const supabase = createSupabaseServerClient();
  const { data: suppliersData } = await supabase.from("suppliers").select("*").eq("active", true).order("name");
  const suppliers = (suppliersData ?? []) as Supplier[];

  const purchaseOrderId = randomUUID();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader title="Nueva Purchase Order" description={`Desde el Pedido ${detail.order.folio}`} />
      <Card>
        <CardHeader>
          <CardTitle>Datos de la orden de compra</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPurchaseOrderForm
            purchaseOrderId={purchaseOrderId}
            orderId={detail.order.id}
            orderFolio={detail.order.folio}
            items={detail.items}
            suppliers={suppliers}
            defaultDate={getBusinessToday()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
