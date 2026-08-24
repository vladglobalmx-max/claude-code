"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import { filterEligibleCatalogProducts, pickCatalogPrice, searchCatalogProducts } from "@/lib/quotes/catalog-picker";
import type { QuoteCatalogProductOption } from "./types";
import type { QuoteCurrency } from "@/types/domain";

/**
 * Buscador de productos del Catálogo Maestro para una línea de Quote,
 * filtrado a la Business Unit elegida en la cotización (THÖREN Fase 6D) —
 * mismo criterio que product_business_units (0019): 0 relaciones =
 * compartido con todas las Business Units de la organización, 1+
 * relaciones = solo esas. Búsqueda por SKU, nombre, modelo o marca (Fase
 * 6D §2) — nunca fuzzy (searchCatalogProducts, lib/quotes/catalog-picker.ts).
 * Lista filtrable con miniatura + precio en la moneda actual, no un
 * <select> gigante (Fase 6D §11).
 */
export function QuoteProductPicker({
  products,
  businessUnitId,
  currency,
  onSelect,
}: {
  products: QuoteCatalogProductOption[];
  businessUnitId: string;
  currency: QuoteCurrency;
  onSelect: (product: QuoteCatalogProductOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [query, setQuery] = useState("");

  const eligibleProducts = useMemo(
    () => filterEligibleCatalogProducts(products, businessUnitId),
    [products, businessUnitId]
  );

  const typeLabel = (p: QuoteCatalogProductOption) => p.productTypeName || p.category || "Sin tipo";

  const types = useMemo(() => Array.from(new Set(eligibleProducts.map(typeLabel))).sort(), [eligibleProducts]);

  const results = useMemo(() => {
    const byType = typeFilter ? eligibleProducts.filter((p) => typeLabel(p) === typeFilter) : eligibleProducts;
    return searchCatalogProducts(byType, query).slice(0, 20);
  }, [eligibleProducts, typeFilter, query]);

  if (!businessUnitId) return null;

  if (eligibleProducts.length === 0) {
    return <p className="text-xs text-ink-faint">No hay productos del catálogo disponibles para esta Business Unit.</p>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-medium text-ink"
      >
        <span className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-ink-faint" />
          Buscar en catálogo de productos
        </span>
        <ChevronDown className={`h-4 w-4 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-56">
              <option value="">Todos los tipos</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU, nombre, modelo o marca…"
              className="flex-1"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-faint">Sin resultados.</p>
            ) : (
              results.map((p) => {
                const price = pickCatalogPrice(p, currency);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-2"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
                      {p.imagePreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagePreviewUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                      <p className="truncate text-xs text-ink-faint">
                        {p.sku}
                        {p.model ? ` · ${p.model}` : ""}
                        {p.brand ? ` · ${p.brand}` : ""} · {typeLabel(p)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      {price != null ? (
                        <span className="font-medium text-ink">{formatMoneyByCurrency(price, currency)}</span>
                      ) : (
                        <span className="text-danger">Sin precio configurado</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
