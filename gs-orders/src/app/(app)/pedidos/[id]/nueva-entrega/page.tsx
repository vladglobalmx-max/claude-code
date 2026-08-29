import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageDeliveries } from "@/lib/auth/logistics";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderDeliveryProgress } from "@/types/domain";
import { NewDeliveryForm } from "./new-delivery-form";

export interface DeliverableItem {
  catalogProductId: string;
  model: string;
  description: string | null;
  unit: string | null;
  ordered: number;
  fulfilled: number;
  delivered: number;
  pendingToDeliver: number;
}

/**
 * THÖREN Fase 6P — Nueva Entrega. Sin gate admin-only (a diferencia de
 * Compras): "propio o admin" ya lo resuelve rpc_create_delivery, que sigue
 * siendo la autoridad final. THÖREN 6R.1B-1 UX fix: can_view_all_sales
 * (0041) permite que getOrderDetail resuelva un Pedido ajeno, así que este
 * página además bloquea el render ANTES de mostrar el formulario (mismo
 * criterio que /pedidos/[id]/editar) — no basta con ocultar el botón
 * "Nueva entrega" en deliveries-section.tsx. THÖREN 6R.1B-2B: el guard
 * ahora acepta también autoridad logística — canManageDeliveries() ya
 * combina canWriteRecord (ownership/admin) OR can_manage_deliveries
 * (capability, 0044), así que una sola llamada cubre ambas vías. El tope
 * real por producto (pendingToDeliver) viene de rpc_order_delivery_progress
 * — NUNCA la cantidad pedida — para que el formulario nunca ofrezca
 * entregar más de lo físicamente surtido.
 */
export default async function NuevaEntregaPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  if (!canManageDeliveries(profile, capabilities, detail.order.salesperson_id)) {
    redirect(`/pedidos/${detail.order.id}`);
  }
  const supabase = createSupabaseServerClient();
  const { data: progressData } = await supabase.rpc("rpc_order_delivery_progress", { p_order_id: params.id });
  const progress = (progressData ?? []) as OrderDeliveryProgress[];
  const progressByProduct = new Map(progress.map((p) => [p.catalog_product_id, p]));

  // Un mismo producto puede repetirse en varias partidas — se deduplica
  // por catalog_product_id, igual criterio que Reservas de Inventario (6N).
  const itemsByProduct = new Map<string, DeliverableItem>();
  for (const item of detail.items) {
    if (!item.catalog_product_id) continue;
    if (itemsByProduct.has(item.catalog_product_id)) continue;
    const p = progressByProduct.get(item.catalog_product_id);
    itemsByProduct.set(item.catalog_product_id, {
      catalogProductId: item.catalog_product_id,
      model: item.model,
      description: item.description,
      unit: item.unit,
      ordered: p?.ordered ?? 0,
      fulfilled: p?.fulfilled ?? 0,
      delivered: p?.delivered ?? 0,
      pendingToDeliver: p?.pending_to_deliver ?? 0,
    });
  }

  const deliveryId = randomUUID();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader title="Nueva entrega" description={`Desde el Pedido ${detail.order.folio}`} />
      <Card>
        <CardHeader>
          <CardTitle>Datos de la entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <NewDeliveryForm deliveryId={deliveryId} orderId={detail.order.id} items={Array.from(itemsByProduct.values())} />
        </CardContent>
      </Card>
    </div>
  );
}
