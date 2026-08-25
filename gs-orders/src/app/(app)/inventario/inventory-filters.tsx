"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import type { Warehouse } from "@/types/domain";

export function InventoryFilters({
  warehouses,
  businessUnits,
}: {
  warehouses: Warehouse[];
  businessUnits: { id: string; name: string }[];
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
      searchPlaceholder="Buscar por producto o SKU…"
    >
      <Select
        className="w-auto"
        defaultValue={searchParams.get("almacen") ?? ""}
        onChange={(e) => updateParam("almacen", e.target.value)}
      >
        <option value="">Todos los almacenes</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </Select>

      <Select className="w-auto" defaultValue={searchParams.get("bu") ?? ""} onChange={(e) => updateParam("bu", e.target.value)}>
        <option value="">Todas las Business Units</option>
        {businessUnits.map((bu) => (
          <option key={bu.id} value={bu.id}>
            {bu.name}
          </option>
        ))}
      </Select>
    </FilterBar>
  );
}
