"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoneyMxn, formatMoneyUsd } from "@/lib/utils/format";
import { bulkDeactivateAllMatchingCatalogProducts, bulkDeactivateCatalogProducts } from "./actions";

export interface CatalogRow {
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
 * Ajuste de cierre — selección múltiple + "Eliminar del catálogo"
 * (soft-delete, active=false) masivo. "Seleccionar todos" marca
 * EXCLUSIVAMENTE `products` — con la paginación real de catalog/page.tsx
 * (fix de performance), eso es literalmente la página actual (máximo
 * CATALOG_PAGE_SIZE), nunca el catálogo completo ni todo el resultado del
 * filtro/búsqueda.
 *
 * Fix de bug — la selección NUNCA debe sobrevivir a un cambio del
 * conjunto `products`: al navegar entre páginas o cambiar filtros, Next.js
 * re-renderiza esta MISMA instancia del componente con un `products` prop
 * distinto (no la desmonta), así que sin este reset `selected` se
 * arrastraba entre páginas — visto en producción acumulando cientos de
 * ids de páginas ya no visibles y provocando un Bad Request al confirmar
 * "Eliminar del catálogo" (URL de `.in("id", ids)` con miles de ids).
 * `visibleIdsKey` cambia si y solo si el CONJUNTO de ids visibles cambia
 * (nunca en cada re-render idéntico) — el único disparador real, más
 * robusto que atar esto a `page`/`estado`/`tipo`/`q` por separado. El
 * mismo reset también sale del modo `allMatchingSelected` (abajo).
 *
 * Ajuste operativo — "Seleccionar los N que coinciden con estos filtros":
 * cuando `canSelectAllMatching` (page.tsx, solo estado=Activo/default y
 * sin búsqueda `q` — ver canOfferSelectAllMatching) y ya están
 * seleccionados TODOS los visibles de la página actual, se ofrece marcar
 * el modo `allMatchingSelected` — un booleano, NUNCA una lista de
 * `totalMatching` ids en el cliente. En ese modo, "Eliminar del catálogo"
 * llama a `bulkDeactivateAllMatchingCatalogProducts(filters)`, que
 * resuelve y desactiva el conjunto completo dentro de Postgres (RPC
 * 0078) — el navegador nunca ve ni envía esos ids.
 */
export function CatalogSelectionTable({
  products,
  businessUnits,
  imageUrls,
  totalMatching,
  canSelectAllMatching,
  filters,
}: {
  products: CatalogRow[];
  businessUnits: { id: string; name: string }[];
  imageUrls: Record<string, string>;
  totalMatching: number;
  canSelectAllMatching: boolean;
  filters: { bu?: string; tipo?: string };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visibleIds = useMemo(() => products.map((p) => p.id), [products]);
  const visibleIdsKey = visibleIds.join(",");

  useEffect(() => {
    setSelected(new Set());
    setAllMatchingSelected(false);
  }, [visibleIdsKey]);

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const offerSelectAllMatching = canSelectAllMatching && !allMatchingSelected && allVisibleSelected && totalMatching > products.length;
  const selectedCount = allMatchingSelected ? totalMatching : selected.size;

  function toggle(id: string) {
    if (allMatchingSelected) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    if (allMatchingSelected) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setAllMatchingSelected(false);
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = allMatchingSelected
        ? await bulkDeactivateAllMatchingCatalogProducts(filters)
        : await bulkDeactivateCatalogProducts(Array.from(selected));

      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      clearSelection();
      toast.success(
        `${result.updatedCount} producto${result.updatedCount === 1 ? "" : "s"} eliminado${result.updatedCount === 1 ? "" : "s"} del catálogo.`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-4 py-2.5">
          <span className="text-sm font-medium text-ink">
            {selectedCount} producto{selectedCount === 1 ? "" : "s"} seleccionado{selectedCount === 1 ? "" : "s"}
          </span>
          <Button type="button" variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar del catálogo ({selectedCount})
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
            Cancelar selección
          </Button>
        </div>
      )}

      {offerSelectAllMatching && (
        <button
          type="button"
          className="text-sm text-accent hover:underline"
          onClick={() => setAllMatchingSelected(true)}
        >
          Seleccionar los {totalMatching} productos que coinciden con estos filtros
        </button>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <Thead>
            <Tr>
              <Th>
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los visibles"
                  checked={allMatchingSelected || allVisibleSelected}
                  disabled={allMatchingSelected}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                />
              </Th>
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
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${p.sku}`}
                      checked={allMatchingSelected || selected.has(p.id)}
                      disabled={allMatchingSelected}
                      onChange={() => toggle(p.id)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                    />
                  </Td>
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

      <Dialog open={confirmOpen} onOpenChange={(next) => !isPending && setConfirmOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              ¿Eliminar {selectedCount} producto{selectedCount === 1 ? "" : "s"} del catálogo?
            </DialogTitle>
            <DialogDescription>
              Dejarán de estar disponibles para nuevas cotizaciones y operaciones. Los documentos históricos no se
              modificarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={handleConfirmDelete}>
              Eliminar del catálogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
