import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canPreparePurchaseOrders } from "@/lib/auth/purchase-orders";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { buildBusinessUnitIdsByProduct, type ProductBusinessUnitRow } from "@/lib/products/business-unit-map";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DirectPurchaseOrderForm } from "./direct-purchase-order-form";
import { createDirectPurchaseOrder } from "../actions";

export const dynamic = "force-dynamic";

/** Tamaño de página para traer product_catalog/product_business_units completos — ver DECISIÓN en paginated-fetch.ts (max_rows de PostgREST). */
const PRODUCT_CATALOG_PAGE_SIZE = 1000;

interface CatalogRow {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  model: string | null;
  brand: string | null;
}

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
  const [{ data: businessUnitsData }, { data: suppliersData }, { data: warehousesData }, catalogResult, catalogBuResult] =
    await Promise.all([
      supabase.from("business_units").select("id, name").eq("active", true).order("name"),
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
      supabase.from("warehouses").select("id, name").eq("active", true).order("name"),
      // BUG — el selector de producto no mostraba todo el catálogo: sin
      // .range(), PostgREST corta silenciosamente en max_rows=1,000
      // (supabase/config.toml) — mismo problema ya resuelto en
      // pedidos/nuevo y cotizaciones/nueva vía fetchAllPages.
      fetchAllPages<CatalogRow>(
        async (from, to) =>
          await supabase
            .from("product_catalog")
            .select("id, sku, name, unit, model, brand")
            .eq("active", true)
            .order("name")
            .range(from, to),
        PRODUCT_CATALOG_PAGE_SIZE
      ),
      fetchAllPages<ProductBusinessUnitRow>(
        async (from, to) =>
          await supabase
            .from("product_business_units")
            .select("product_id, business_unit_id")
            .order("product_id")
            .order("business_unit_id")
            .range(from, to),
        PRODUCT_CATALOG_PAGE_SIZE
      ),
    ]);

  if ("error" in catalogResult || "error" in catalogBuResult) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <p className="text-sm font-medium text-ink">No se pudo cargar el catálogo completo</p>
          <p className="max-w-sm text-sm text-ink-faint">
            Ocurrió un error leyendo los productos. Intenta recargar la página en unos momentos.
          </p>
        </div>
      </div>
    );
  }

  const businessUnitIdsByProduct = buildBusinessUnitIdsByProduct(catalogBuResult.rows);
  const catalogProducts = catalogResult.rows.map((p) => ({
    ...p,
    businessUnitIds: businessUnitIdsByProduct.get(p.id) ?? [],
  }));

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nueva Orden de Compra</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Compra directa — sin Orden de Trabajo, sin Sales Order ni Requisición de origen (stock, compra interna, muestras,
          refacciones/mantenimiento, equipo, proyecto especial).
        </p>
      </div>
      <DirectPurchaseOrderForm
        businessUnits={businessUnitsData ?? []}
        suppliers={suppliersData ?? []}
        warehouses={warehousesData ?? []}
        catalogProducts={catalogProducts}
        onSubmit={createDirectPurchaseOrder}
      />
    </div>
  );
}
