import Link from "next/link";
import { AlertTriangle, Download, ListChecks, Package, Plus, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { filterCatalogRows } from "@/lib/products/catalog-search";
import { countUnclassified } from "@/lib/products/unclassified";
import { CatalogFilters } from "./catalog-filters";
import { CatalogSelectionTable, type CatalogRow } from "./catalog-selection-table";

export const dynamic = "force-dynamic";

/** Tamaño de página para traer product_catalog completo — mismo criterio/utilidad que getProductImportCandidates (ver paginated-fetch.ts). */
const CATALOG_PAGE_SIZE = 1000;

/**
 * Catálogo de Productos (Fase 6C — THÖREN Catálogo Maestro). Filtra/busca
 * TODO server-side en JS (no vía query PostgREST embebida): la relación
 * Business Unit es N:M (product_business_units, 0 filas = compartido con
 * todas) y necesita tratar ese caso especial ("Todas" siempre visible
 * bajo cualquier filtro de BU) — más simple y correcto en JS que
 * expresarlo como filtro embebido de PostgREST.
 *
 * DECISIÓN — paginación explícita de product_catalog (fix "FIX CATÁLOGO
 * >1,000 PRODUCTOS"): un `select` sin `.range()` queda silenciosamente
 * limitado a `max_rows` (1,000, supabase/config.toml) por PostgREST — sin
 * error, HTTP 200 normal. Con organizaciones de más de 1,000 SKUs (ver
 * auditoría "PRODUCTO EXISTE PARA IMPORTADOR PERO NO APARECE EN
 * CATÁLOGO"), los productos fuera de esa ventana eran invisibles para
 * listado, búsqueda Y filtro de Business Unit por igual — los tres operan
 * en memoria sobre el mismo `allProducts` truncado. `fetchAllPages`
 * (paginated-fetch.ts — misma utilidad ya usada y probada en
 * getProductImportCandidates, commit 35d0460) trae TODO el catálogo en
 * páginas de CATALOG_PAGE_SIZE. El filtrado/búsqueda siguen en JS sobre
 * el array ya completo — sin cambios de UI/lógica de matching en esta
 * fase (optimizar a búsqueda server-side es una fase futura aparte).
 */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: { q?: string; bu?: string; tipo?: string; estado?: string };
}) {
  const supabase = createSupabaseServerClient();
  const [productsResult, { data: buData }, { data: ptData }] = await Promise.all([
    fetchAllPages<CatalogRow>(
      async (from, to) =>
        await supabase
          .from("product_catalog")
          .select("*, product_types(name), product_business_units(business_unit_id)")
          .order("sku", { ascending: true })
          .range(from, to),
      CATALOG_PAGE_SIZE
    ),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
  ]);

  if ("error" in productsResult) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader title="Catálogo de productos" description="Productos y servicios disponibles para Cotizaciones y Pedidos." />
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

  const allProducts = productsResult.rows;
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];

  const products = filterCatalogRows(allProducts, searchParams);
  const unclassifiedCount = countUnclassified(allProducts.filter((p) => p.active));

  const imagePaths = products.map((p) => p.image_path).filter((p): p is string => !!p);
  const imageUrls = await getSignedUrls("order-media", imagePaths);

  // THÖREN — Catálogo UX (Organization → BU → Product Type → Products):
  // el contexto de filtros vigente (BU/Tipo) viaja a "Nuevo producto" e
  // "Importar Excel" — entrar desde un filtro ya aplicado preselecciona
  // ese contexto en vez de obligar a elegirlo de nuevo (ver nuevo/page.tsx).
  const contextParams = new URLSearchParams();
  if (searchParams.bu) contextParams.set("bu", searchParams.bu);
  if (searchParams.tipo) contextParams.set("tipo", searchParams.tipo);
  const contextQuery = contextParams.toString() ? `?${contextParams.toString()}` : "";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Catálogo de productos" description="Productos y servicios disponibles para Cotizaciones y Pedidos." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CatalogFilters businessUnits={businessUnits} productTypes={productTypes} />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/configuracion/catalogo/sin-clasificar">
            <Button variant="outline">
              <ListChecks className="h-4 w-4" />
              Sin clasificar
              {unclassifiedCount > 0 && <Badge variant="warning">{unclassifiedCount}</Badge>}
            </Button>
          </Link>
          <Link href={`/configuracion/catalogo/nuevo${contextQuery}`}>
            <Button>
              <Plus className="h-4 w-4" />
              Producto
            </Button>
          </Link>
          <Link href={`/configuracion/catalogo/importar${contextQuery}`}>
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Importar Excel
            </Button>
          </Link>
          <a href="/configuracion/catalogo/exportar">
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </a>
        </div>
      </div>

      {allProducts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Package}
            title="Todavía no hay productos en el catálogo"
            description="Agrega el primer producto para poder seleccionarlo en Cotizaciones y Pedidos."
            action={
              <Link href="/configuracion/catalogo/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Producto
                </Button>
              </Link>
            }
          />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-ink-faint">
          Ningún producto coincide con la búsqueda/filtros.
        </div>
      ) : (
        <CatalogSelectionTable products={products} businessUnits={businessUnits} imageUrls={imageUrls} />
      )}
    </div>
  );
}
