"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";

export interface FilterOption {
  id: string;
  name: string;
}

export function CatalogFilters({
  businessUnits,
  productTypes,
}: {
  businessUnits: FilterOption[];
  productTypes: FilterOption[];
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
      searchPlaceholder="Buscar por SKU, nombre o modelo…"
    >
      <Select
        className="w-auto"
        defaultValue={searchParams.get("bu") ?? ""}
        onChange={(e) => updateParam("bu", e.target.value)}
      >
        <option value="">Todas las Business Units</option>
        {businessUnits.map((bu) => (
          <option key={bu.id} value={bu.id}>
            {bu.name}
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
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>

      <Select
        className="w-auto"
        defaultValue={searchParams.get("estado") ?? ""}
        onChange={(e) => updateParam("estado", e.target.value)}
      >
        <option value="">Todos los estados</option>
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
      </Select>
    </FilterBar>
  );
}
