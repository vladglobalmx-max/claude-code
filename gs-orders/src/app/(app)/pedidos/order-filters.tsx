"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ORDER_STATUS_LABELS } from "@/types/domain";
import type { ProductTypeItem, Salesperson } from "@/types/domain";

export function OrderFilters({
  salespeople,
  productTypes,
  showSalespersonFilter = true,
}: {
  salespeople: Salesperson[];
  productTypes: ProductTypeItem[];
  /** false para VENDEDOR: solo ve sus propios pedidos, el filtro por vendedor no aporta nada. */
  showSalespersonFilter?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => updateParam("q", e.target.value)}
          placeholder="Buscar por folio, cliente o vendedor…"
          className="pl-9"
        />
      </div>

      {showSalespersonFilter && (
        <Select
          className="w-auto"
          defaultValue={searchParams.get("vendedor") ?? ""}
          onChange={(e) => updateParam("vendedor", e.target.value)}
        >
          <option value="">Todos los vendedores</option>
          {salespeople.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </Select>
      )}

      <Select
        className="w-auto"
        defaultValue={searchParams.get("estado") ?? ""}
        onChange={(e) => updateParam("estado", e.target.value)}
      >
        <option value="">Todos los estados</option>
        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <Select
        className="w-auto"
        defaultValue={searchParams.get("tipo") ?? ""}
        onChange={(e) => updateParam("tipo", e.target.value)}
      >
        <option value="">Todos los tipos</option>
        {productTypes.map((t) => (
          <option key={t.id} value={t.code}>
            {t.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
