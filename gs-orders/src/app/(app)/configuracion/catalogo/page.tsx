import Link from "next/link";
import { Package, Plus, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { ProductCatalogItem } from "@/types/domain";
import { formatMoneyMxn, formatMoneyUsd } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface CatalogRow extends ProductCatalogItem {
  product_business_units: { business_unit_id: string }[] | null;
}

function formatSuggestedPrice(product: ProductCatalogItem) {
  const parts: string[] = [];
  if (product.default_price_mxn != null) parts.push(formatMoneyMxn(product.default_price_mxn));
  if (product.default_price_usd != null) parts.push(formatMoneyUsd(product.default_price_usd));
  return parts.length > 0 ? parts.join(" / ") : "—";
}

export default async function CatalogoPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("product_catalog")
    .select("*, product_business_units(business_unit_id)")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const products = (data ?? []) as unknown as CatalogRow[];
  const imagePaths = products.map((p) => p.image_path).filter((p): p is string => !!p);
  const imageUrls = await getSignedUrls("order-media", imagePaths);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Catálogo de productos</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Productos disponibles para seleccionar al crear un pedido. Desactivar un producto no afecta pedidos ya
            creados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/configuracion/catalogo/importar">
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Importar Excel
            </Button>
          </Link>
          <Link href="/configuracion/catalogo/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Producto
            </Button>
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Package}
            title="Todavía no hay productos en el catálogo"
            description="Agrega el primer producto para poder seleccionarlo al crear pedidos."
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <Thead>
              <Tr>
                <Th />
                <Th>Categoría</Th>
                <Th>Modelo / SKU</Th>
                <Th>Nombre</Th>
                <Th>Color</Th>
                <Th>Precio sugerido</Th>
                <Th>Business Units</Th>
                <Th>Estado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {products.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    {p.image_path && imageUrls[p.image_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrls[p.image_path]} alt={p.name} className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-surface-2" />
                    )}
                  </Td>
                  <Td className="text-ink-soft">{p.category}</Td>
                  <Td className="font-mono text-ink-soft">{p.sku}</Td>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="text-ink-soft">{p.color ?? "—"}</Td>
                  <Td className="text-ink-soft">{formatSuggestedPrice(p)}</Td>
                  <Td className="text-ink-soft">
                    {(p.product_business_units ?? []).length === 0
                      ? "Todas"
                      : `${(p.product_business_units ?? []).length} unidad${(p.product_business_units ?? []).length === 1 ? "" : "es"}`}
                  </Td>
                  <Td>
                    <Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Activo" : "Inactivo"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/configuracion/catalogo/${p.id}/editar`} className="text-sm text-accent hover:underline">
                      Editar
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
