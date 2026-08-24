import Link from "next/link";
import { Download, Package, Plus, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatMoneyMxn, formatMoneyUsd } from "@/lib/utils/format";
import { canonicalize } from "@/lib/products/import-parsing";
import { CatalogFilters } from "./catalog-filters";

export const dynamic = "force-dynamic";

interface CatalogRow {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  unit: string | null;
  default_price_mxn: number | null;
  default_price_usd: number | null;
  active: boolean;
  image_path: string | null;
  product_type_id: string | null;
  product_types: { name: string } | null;
  product_business_units: { business_unit_id: string }[] | null;
}

function formatPrice(product: CatalogRow) {
  if (product.default_price_usd != null) return formatMoneyUsd(product.default_price_usd);
  if (product.default_price_mxn != null) return formatMoneyMxn(product.default_price_mxn);
  return "—";
}

function currencyLabel(product: CatalogRow) {
  if (product.default_price_usd != null) return "USD";
  if (product.default_price_mxn != null) return "MXN";
  return "—";
}

/**
 * Catálogo de Productos (Fase 6C — THÖREN Catálogo Maestro). Filtra/busca
 * TODO server-side en JS (no vía query PostgREST embebida): la relación
 * Business Unit es N:M (product_business_units, 0 filas = compartido con
 * todas) y necesita tratar ese caso especial ("Todas" siempre visible
 * bajo cualquier filtro de BU) — más simple y correcto en JS que
 * expresarlo como filtro embebido de PostgREST. El catálogo de una
 * organización real es de cientos, no millones, de filas — sin costo real
 * de traer todo y filtrar en memoria.
 */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: { q?: string; bu?: string; tipo?: string; estado?: string };
}) {
  const supabase = createSupabaseServerClient();
  const [{ data }, { data: buData }, { data: ptData }] = await Promise.all([
    supabase
      .from("product_catalog")
      .select("*, product_types(name), product_business_units(business_unit_id)")
      .order("sku", { ascending: true }),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
  ]);

  const allProducts = (data ?? []) as unknown as CatalogRow[];
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];

  const q = searchParams.q?.trim() ? canonicalize(searchParams.q.trim()) : null;
  const products = allProducts.filter((p) => {
    if (q) {
      const haystack = canonicalize([p.sku, p.name, p.model ?? ""].join(" "));
      if (!haystack.includes(q)) return false;
    }
    if (searchParams.bu) {
      const buRows = p.product_business_units ?? [];
      const matchesBu = buRows.length === 0 || buRows.some((r) => r.business_unit_id === searchParams.bu);
      if (!matchesBu) return false;
    }
    if (searchParams.tipo && p.product_type_id !== searchParams.tipo) return false;
    if (searchParams.estado === "activo" && !p.active) return false;
    if (searchParams.estado === "inactivo" && p.active) return false;
    return true;
  });

  const imagePaths = products.map((p) => p.image_path).filter((p): p is string => !!p);
  const imageUrls = await getSignedUrls("order-media", imagePaths);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Catálogo de productos" description="Productos y servicios disponibles para Cotizaciones y Pedidos." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CatalogFilters businessUnits={businessUnits} productTypes={productTypes} />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/configuracion/catalogo/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Producto
            </Button>
          </Link>
          <Link href="/configuracion/catalogo/importar">
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
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <Table>
            <Thead>
              <Tr>
                <Th />
                <Th>SKU</Th>
                <Th>Producto</Th>
                <Th>Business Unit</Th>
                <Th>Tipo</Th>
                <Th>Marca</Th>
                <Th>Modelo</Th>
                <Th>Unidad</Th>
                <Th>Moneda</Th>
                <Th>Precio base</Th>
                <Th>Estado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {products.map((p) => {
                const buRows = p.product_business_units ?? [];
                const firstBuId = buRows[0]?.business_unit_id;
                const buLabel =
                  buRows.length === 0
                    ? "Todas"
                    : buRows.length === 1
                      ? (businessUnits.find((bu) => bu.id === firstBuId)?.name ?? "1 unidad")
                      : `${buRows.length} unidades`;

                return (
                  <Tr key={p.id}>
                    <Td>
                      {p.image_path && imageUrls[p.image_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrls[p.image_path]} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-surface-2" />
                      )}
                    </Td>
                    <Td className="font-mono text-ink-soft">{p.sku}</Td>
                    <Td className="font-medium">{p.name}</Td>
                    <Td className="text-ink-soft">{buLabel}</Td>
                    <Td className="text-ink-soft">{p.product_types?.name ?? "—"}</Td>
                    <Td className="text-ink-soft">{p.brand ?? "—"}</Td>
                    <Td className="text-ink-soft">{p.model ?? "—"}</Td>
                    <Td className="text-ink-soft">{p.unit ?? "—"}</Td>
                    <Td className="text-ink-soft">{currencyLabel(p)}</Td>
                    <Td className="text-ink-soft">{formatPrice(p)}</Td>
                    <Td>
                      <Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Activo" : "Inactivo"}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Link href={`/configuracion/catalogo/${p.id}/editar`} className="text-sm text-accent hover:underline">
                        Editar
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
