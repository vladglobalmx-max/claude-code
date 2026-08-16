"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { QUOTE_STATUS_LABELS } from "@/types/domain";
import type { Salesperson } from "@/types/domain";

export function QuoteFilters({
  salespeople,
  showSalespersonFilter = true,
}: {
  salespeople: Salesperson[];
  /** false para VENDEDOR: RLS ya lo limita a sus propias Quotes, el filtro no aporta nada. */
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
    <FilterBar
      searchValue={searchParams.get("q") ?? ""}
      onSearchChange={(value) => updateParam("q", value)}
      searchPlaceholder="Buscar por folio, cliente o vendedor…"
    >
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
        {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </FilterBar>
  );
}
