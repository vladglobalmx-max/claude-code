import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, ListChecks, Package, Plus, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { fetchAllPages } from "@/lib/products/paginated-fetch";
import { filterCatalogRows } from "@/lib/products/catalog-search";
import { CATALOG_PAGE_SIZE, catalogPageCount, catalogPageRange, needsSlowCatalogPath, resolveCatalogPageNumber } from "@/lib/products/catalog-pagination";
import { CatalogFilters } from "./catalog-filters";
import { CatalogSelectionTable, type CatalogRow } from "./catalog-selection-table";

export const dynamic = "force-dynamic";

interface CatalogoSearchParams {
  q?: string;
  bu?: string;
  tipo?: string;
  estado?: string;
  page?: string;
}

/**
 * Catálogo de Productos (Fase 6C — THÖREN Catálogo Maestro).
 *
 * Fix de performance (bloqueador de cierre — Configuración lenta con
 * miles de productos): esta página traía TODO product_catalog en cada
 * carga (fetchAllPages), filtraba/buscaba en JS, y firmaba imágenes de
 * TODOS los productos visibles — con miles de SKUs, eso era el costo
 * dominante de TTFB. Ahora hay dos rutas (ver DECISIÓN completa en
 * catalog-pagination.ts):
 *   - Sin búsqueda (`q`) ni filtro de Business Unit (`bu`) — el caso
 *     reportado como lento y, con diferencia, el más común (abrir/navegar
 *     Catálogo): pagina de verdad en SQL (`.range()`, CATALOG_PAGE_SIZE
 *     filas) y filtra estado/tipo directo en la base — nunca trae más
 *     filas que las de la página actual.
 *   - Con `q` y/o `bu`: sigue trayendo todo y filtrando en JS
 *     (filterCatalogRows/fetchAllPages, comportamiento sin cambios,
 *     incluida la regla "Business Unit sin fila propia = compartido con
 *     todas") — pero AHORA solo firma imágenes de la página actual del
 *     resultado ya filtrado, no de todo el resultado.
 * En ambas rutas, "Seleccionar todos los visibles" (CatalogSelectionTable)
 * sigue significando exactamente lo que recibe como `products` — con
 * paginación real, eso ahora es literalmente la página actual, nunca el
 * catálogo completo ni todo el resultado del filtro.
 */
export default async function CatalogoPage({ searchParams }: { searchParams: CatalogoSearchParams }) {
  const supabase = createSupabaseServerClient();
  const page = resolveCatalogPageNumber(searchParams.page);

  const [{ data: buData }, { data: ptData }, totalCountResult, unclassifiedCountResult] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
    supabase.from("product_catalog").select("id", { count: "exact", head: true }),
    supabase.from("product_catalog").select("id", { count: "exact", head: true }).eq("active", true).is("product_type_id", null),
  ]);

  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];
  const totalCatalogCount = totalCountResult.count ?? 0;
  const unclassifiedCount = unclassifiedCountResult.count ?? 0;

  let products: CatalogRow[];
  let totalMatching: number;

  if (needsSlowCatalogPath(searchParams)) {
    // Ruta "lenta" — búsqueda de texto y/o filtro de Business Unit: ver
    // DECISIÓN arriba sobre por qué esto sigue en JS.
    const productsResult = await fetchAllPages<CatalogRow>(
      async (from, to) =>
        await supabase
          .from("product_catalog")
          .select("*, product_types(name), product_business_units(business_unit_id)")
          .order("sku", { ascending: true })
          .range(from, to),
      1000
    );

    if ("error" in productsResult) {
      return <CatalogLoadError />;
    }

    const filtered = filterCatalogRows(productsResult.rows, searchParams);
    totalMatching = filtered.length;
    const { from, to } = catalogPageRange(page);
    products = filtered.slice(from, to + 1);
  } else {
    // Ruta "rápida" (default) — pagina y filtra estado/tipo en SQL.
    let query = supabase
      .from("product_catalog")
      .select("*, product_types(name), product_business_units(business_unit_id)", { count: "exact" })
      .order("sku", { ascending: true });

    const estado = searchParams.estado || "activo";
    if (estado === "activo") query = query.eq("active", true);
    else if (estado === "inactivo") query = query.eq("active", false);
    // estado === "todos": sin filtro adicional.
    if (searchParams.tipo) query = query.eq("product_type_id", searchParams.tipo);

    const { from, to } = catalogPageRange(page);
    const { data, count, error } = await query.range(from, to);

    if (error) {
      return <CatalogLoadError />;
    }

    products = (data ?? []) as CatalogRow[];
    totalMatching = count ?? 0;
  }

  const pageCount = catalogPageCount(totalMatching);

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

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.bu) params.set("bu", searchParams.bu);
    if (searchParams.tipo) params.set("tipo", searchParams.tipo);
    if (searchParams.estado) params.set("estado", searchParams.estado);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/configuracion/catalogo?${qs}` : "/configuracion/catalogo";
  }

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

      {totalCatalogCount === 0 ? (
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
        <>
          <CatalogSelectionTable products={products} businessUnits={businessUnits} imageUrls={imageUrls} />

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
              <span>
                Página {page} de {pageCount} · {totalMatching} producto{totalMatching === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-surface-2">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-ink-faint/50">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </span>
                )}
                {page < pageCount ? (
                  <Link href={pageHref(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-surface-2">
                    Siguiente
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-ink-faint/50">
                    Siguiente
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CatalogLoadError() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Catálogo de productos" description="Productos y servicios disponibles para Cotizaciones y Pedidos." />
      <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" />
        <p className="text-sm font-medium text-ink">No se pudo cargar el catálogo</p>
        <p className="max-w-sm text-sm text-ink-faint">
          Ocurrió un error leyendo los productos. Intenta recargar la página en unos momentos.
        </p>
      </div>
    </div>
  );
}
