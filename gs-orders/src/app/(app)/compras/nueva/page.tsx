import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DirectPurchaseOrderForm } from "./direct-purchase-order-form";
import { createDirectPurchaseOrder } from "../actions";

export const dynamic = "force-dynamic";

/**
 * THÖREN — Orden de Compra Directa (0081). Sin Pedido/Sales Order/
 * Requisición/cliente. Misma autoridad que el resto de Compras
 * (can_prepare_purchase_orders o admin) — RLS/RPC son la autoridad real,
 * este guard solo evita mostrar un formulario que fallaría al guardar.
 */
export default async function NuevaOrdenDeCompraPage() {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canPrepare = canPreparePurchaseOrders(profile, capabilities);

  if (!canPrepare) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHeader title="Nueva Orden de Compra" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes autoridad de Compras"
            description="Solo un administrador o un usuario con autoridad de preparación de Compras puede crear una Orden de Compra."
          />
        </Card>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: businessUnitsData }, { data: suppliersData }, { data: warehousesData }, { data: productsData }] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
    supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
    supabase.from("product_catalog").select("id, sku, name, unit").eq("active", true).order("name"),
  ]);

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva Orden de Compra</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Compra directa — sin Pedido, sin Sales Order ni Requisición de origen (stock, compra interna, muestras,
          refacciones/mantenimiento, equipo, proyecto especial).
        </p>
      </div>
      <DirectPurchaseOrderForm
        businessUnits={businessUnitsData ?? []}
        suppliers={suppliersData ?? []}
        warehouses={warehousesData ?? []}
        catalogProducts={productsData ?? []}
        onSubmit={createDirectPurchaseOrder}
      />
    </div>
  );
}
