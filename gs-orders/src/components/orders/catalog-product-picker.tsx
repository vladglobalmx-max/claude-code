"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CatalogProductOption } from "./types";

/**
 * Buscador de productos del catálogo por categoría + modelo/nombre, para
 * precargar un producto en Nuevo Pedido/Editar. Diseñado para escalar a
 * muchas categorías (Blue Spot, Red Spot, Warning Lights, Sensores,
 * Barreras…) sin volverse un select gigante: filtra en memoria sobre la
 * lista de catálogo activo ya cargada por la página (sin más llamadas de
 * red), y solo muestra hasta 20 resultados a la vez.
 */
export function CatalogProductPicker({
  products,
  onSelect,
}: {
  products: CatalogProductOption[];
  onSelect: (product: CatalogProductOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => (q ? p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) : true))
      .slice(0, 20);
  }, [products, category, query]);

  if (products.length === 0) return null;

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
                      {p.sku} · {p.category}
                      {p.color ? ` · ${p.color}` : ""}
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
