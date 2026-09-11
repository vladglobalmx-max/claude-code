import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { groupCatalogByBusinessUnit, type CatalogProductForGrouping } from "@/lib/products/unclassified";
import { UnclassifiedProductsTool } from "./unclassified-tool";

export const dynamic = "force-dynamic";

const CATALOG_PAGE_SIZE = 1000;

interface CatalogRow {
  id: string;
  sku: string;
  model: string | null;
  name: string;
  description: string | null;
  created_at: string;
  product_type_id: string | null;
  product_business_units: { business_unit_id: string }[] | null;
}

/**
 * THÖREN — Catálogo UX (Organization → Business Unit → Product Type →
 * Products), herramienta de limpieza de legado. Lista el catálogo ACTIVO
 * agrupado por Business Unit (mismo criterio de paginación completa que
 * /configuracion/catalogo, ver DECISIÓN de fetchAllPages ahí) con sus
 * contadores (Productos totales / Sin clasificar) y permite seleccionar
 * varios productos sin Tipo de Producto para asignárselo en una sola
 * acción (bulkAssignProductType, actions.ts) — NUNCA clasificación
 * automática por SKU/nombre, siempre elegido a mano.
 */
export default async function ProductosSinClasificarPage() {
  const supabase = createSupabaseServerClient();
  const [productsResult, { data: ptData }] = await Promise.all([
    fetchAllPages<CatalogRow>(
      async (from, to) =>
        await supabase
          .from("product_catalog")
          .select("id, sku, model, name, description, created_at, product_type_id, product_business_units(business_unit_id)")
          .eq("active", true)
          .order("sku", { ascending: true })
          .range(from, to),
      CATALOG_PAGE_SIZE
    ),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
  ]);

  const activeProducts: CatalogProductForGrouping[] = ("error" in productsResult ? [] : productsResult.rows).map((p) => ({
    id: p.id,
    sku: p.sku,
    model: p.model,
    name: p.name,
    description: p.description,
    created_at: p.created_at,
    product_type_id: p.product_type_id,
    businessUnitIds: (p.product_business_units ?? []).map((r) => r.business_unit_id),
  }));

  // Business Units realmente presentes entre los productos activos (no la
  // lista completa de business_units): mismo criterio que catalog-filters,
  // pero aquí basta con las que agrupan al menos un producto — el bucket
  // "Todas las Business Units" ya lo agrega groupCatalogByBusinessUnit.
  const { data: buData } = await supabase.from("business_units").select("id, name").eq("active", true).order("name");
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];

  const groups = groupCatalogByBusinessUnit(activeProducts, businessUnits);
  const totalUnclassified = groups.reduce((sum, g) => sum + g.unclassifiedProducts.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/configuracion/catalogo" className="mb-4 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Catálogo
      </Link>
      <PageHeader
        title="Productos sin clasificar"
        description="Productos activos sin Tipo de Producto asignado, agrupados por Business Unit. Selecciona varios y asígnales un Tipo de Producto en una sola acción — nunca se clasifican automáticamente por SKU o nombre."
      />

      {totalUnclassified === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-ink-faint">
          Todo el catálogo activo ya tiene un Tipo de Producto asignado.
        </div>
      ) : (
        <UnclassifiedProductsTool groups={groups} productTypes={productTypes} />
      )}
    </div>
  );
}
