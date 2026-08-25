import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getBusinessToday } from "@/lib/business-date";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Supplier } from "@/types/domain";
import { NewPurchaseOrderForm } from "./new-purchase-order-form";

/**
 * THÖREN Fase 6L — solo ADMIN puede crear una Purchase Order (ver
 * DECISIÓN de permisos, 0035_purchases_suppliers.sql). Redirige antes de
 * renderizar el formulario, igual que /clientes/[id]/editar.
 */
export default async function NuevaCompraPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
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
