import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { getBusinessToday } from "@/lib/business-date";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentOrganizationId, getCurrentOrganizationTimezone } from "@/lib/auth/organization";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { buildBusinessUnitIdsByProduct, type ProductBusinessUnitRow } from "@/lib/products/business-unit-map";
import { getCustomFieldDefinitions } from "@/lib/custom-fields/data";
import { getRequireSupplierBeforeOrderByBusinessUnit } from "@/lib/orders/process-settings";
import { OrderForm } from "@/components/orders/order-form";
import { emptyOrderForm, type CatalogProductOption } from "@/components/orders/types";
import { createOrder } from "../actions";
import type { ProductCatalogItem, ProductTypeItem, Salesperson } from "@/types/domain";

/** Tamaño de página para traer product_catalog/product_business_units completos — ver DECISIÓN en paginated-fetch.ts (max_rows de PostgREST). */
const PRODUCT_CATALOG_PAGE_SIZE = 1000;

type CatalogRow = ProductCatalogItem & { product_types: { name: string } | null };

export default async function NuevoPedidoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) redirect("/login");

  const supabase = createSupabaseServerClient();
  // Para VENDEDOR, RLS (0011) ya limita esta consulta a su propia fila sin
  // importar el filtro .eq("active", true) que sigue aquí para el caso
  // ADMIN (lista completa de vendedores activos para elegir).
  //
  // Fase 6F — catálogo homologado con el Quote Builder (Fase 6D): se
  // agrega el join a product_types (nombre legible) y a
  // product_business_units (elegibilidad por BU); un pedido nuevo solo
  // puede seleccionar catálogo ACTIVO — el histórico inactivo solo aplica
  // a un Order ya existente (ver pedidos/[id]/editar/page.tsx).
  const [{ data }, catalogResult, catalogBuResult, { data: productTypesData }, { data: businessUnitsData }] =
    await Promise.all([
      supabase.from("salespeople").select("*").eq("active", true).order("name", { ascending: true }),
      // DECISIÓN — fix "FIX SISTÉMICO DE PAGINACIÓN DE PRODUCT CATALOG": sin
      // .range() esto quedaba silenciosamente limitado a max_rows=1,000
      // (PostgREST). fetchAllPages trae TODO el catálogo activo.
      fetchAllPages<CatalogRow>(
        async (from, to) =>
          await supabase
            .from("product_catalog")
            .select("*, product_types(name)")
            .eq("active", true)
            .order("category", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        PRODUCT_CATALOG_PAGE_SIZE
      ),
      fetchAllPages<ProductBusinessUnitRow>(
        async (from, to) =>
          await supabase
            .from("product_business_units")
            .select("product_id, business_unit_id")
            .order("product_id", { ascending: true })
            .order("business_unit_id", { ascending: true })
            .range(from, to),
        PRODUCT_CATALOG_PAGE_SIZE
      ),
      supabase.from("product_types").select("*").eq("active", true).order("name", { ascending: true }),
      supabase.from("business_units").select("id, name").eq("active", true).order("name", { ascending: true }),
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

  const salespeople = (data ?? []) as Salesperson[];
  const productTypes = (productTypesData ?? []) as ProductTypeItem[];
  const businessUnits = (businessUnitsData ?? []) as { id: string; name: string }[];

  const businessUnitNamesById = new Map(businessUnits.map((bu) => [bu.id, bu.name]));
  const businessUnitIdsByProduct = buildBusinessUnitIdsByProduct(catalogBuResult.rows);

  const catalogRows = catalogResult.rows;
  const catalogImagePaths = catalogRows.map((p) => p.image_path).filter((p): p is string => !!p);
  const catalogImageUrls = await getSignedUrls("order-media", catalogImagePaths);
  const catalogProducts: CatalogProductOption[] = catalogRows.map((p) => {
    const businessUnitIds = businessUnitIdsByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      category: p.category ?? "",
      sku: p.sku,
      name: p.name,
      description: p.description,
      model: p.model,
      brand: p.brand,
      unit: p.unit,
      productTypeName: p.product_types?.name ?? null,
      power: p.power,
      color: p.color,
      technicalNotes: p.technical_notes,
      active: p.active,
      businessUnitIds,
      businessUnitNames: businessUnitIds.map((id) => businessUnitNamesById.get(id) ?? "—"),
      imagePath: p.image_path,
      imagePreviewUrl: p.image_path ? catalogImageUrls[p.image_path] ?? null : null,
    };
  });

  const orderId = randomUUID();
  const timezone = await getCurrentOrganizationTimezone();
  const today = getBusinessToday(timezone);
  const initialState = emptyOrderForm(today);

  // THÖREN 8B — todas las definiciones de order_item de la organización
  // (cualquier BU); ProductosSection filtra por la BU vigente en el
  // cliente, ver DECISIÓN en ese componente.
  const organizationId = await getCurrentOrganizationId();
  const customFieldDefinitions = organizationId
    ? await getCustomFieldDefinitions(supabase, { organizationId, entityType: "order_item" })
    : [];
  // THÖREN 8D (gap final) — requisito CORE de Proveedor, configurable por
  // Business Unit (0062), nunca hardcodeado por código de BU.
  const requireSupplierBeforeOrderByBusinessUnit = organizationId
    ? await getRequireSupplierBeforeOrderByBusinessUnit(supabase, organizationId)
    : {};
  // El vendedor nunca elige a nombre de quién se crea el pedido — se
  // prellena con su propio salesperson_id, y el RPC (0011) lo vuelve a
  // forzar server-side sin importar lo que llegue en el payload.
  if (profile.role === "vendedor" && profile.salespersonId) {
    initialState.salespersonId = profile.salespersonId;
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nuevo pedido</h1>
        <p className="mt-0.5 text-sm text-ink-faint">
          El folio se genera automáticamente al guardar.
        </p>
      </div>
      <OrderForm
        orderId={orderId}
        salespeople={salespeople}
        businessUnits={businessUnits}
        catalogProducts={catalogProducts}
        productTypes={productTypes}
        customFieldDefinitions={customFieldDefinitions}
        requireSupplierBeforeOrderByBusinessUnit={requireSupplierBeforeOrderByBusinessUnit}
        initialState={initialState}
        canChooseSalesperson={profile.role === "admin"}
        onSubmit={createOrder}
      />
    </div>
  );
}
