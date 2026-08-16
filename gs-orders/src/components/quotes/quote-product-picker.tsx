"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { QuoteCatalogProductOption } from "./types";

/**
 * Buscador de productos del catálogo para una línea de Quote, filtrado a la
 * Business Unit elegida en la cotización — mismo criterio que
 * product_business_units (0019_core_product_catalog_pricing.sql): 0
 * relaciones = compartido con todas las Business Units de la organización,
 * 1+ relaciones = solo esas. Diseño y patrón de filtro en memoria idénticos
 * a CatalogProductPicker (pedidos), sin duplicar esa lógica: aquí se agrega
 * únicamente el filtro por Business Unit.
 */
export function QuoteProductPicker({
  products,
  businessUnitId,
  onSelect,
}: {
  products: QuoteCatalogProductOption[];
  businessUnitId: string;
  onSelect: (product: QuoteCatalogProductOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const eligibleProducts = useMemo(
    () => products.filter((p) => p.businessUnitIds.length === 0 || p.businessUnitIds.includes(businessUnitId)),
    [products, businessUnitId]
  );

  const categories = useMemo(
    () => Array.from(new Set(eligibleProducts.map((p) => p.category))).sort(),
    [eligibleProducts]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eligibleProducts
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => (q ? p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) : true))
      .slice(0, 20);
  }, [eligibleProducts, category, query]);

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
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-56">
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por modelo o nombre…"
              className="flex-1"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-faint">Sin resultados.</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                    <p className="truncate text-xs text-ink-faint">
                      {p.sku} · {p.category}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
