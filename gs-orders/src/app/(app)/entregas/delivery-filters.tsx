"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DELIVERY_STATUS_LABELS } from "@/types/domain";

export function DeliveryFilters({ businessUnits }: { businessUnits: { id: string; name: string }[] }) {
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
      searchPlaceholder="Buscar por Pedido, cliente o producto…"
    >
      <Select
        className="w-auto"
        defaultValue={searchParams.get("estado") ?? ""}
        onChange={(e) => updateParam("estado", e.target.value)}
      >
        <option value="">Todos los estados</option>
        {Object.entries(DELIVERY_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
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

      <div>
        <Label htmlFor="responsable-filter" className="sr-only">
          Responsable
        </Label>
        <Input
          id="responsable-filter"
          className="w-auto"
          placeholder="Responsable…"
          defaultValue={searchParams.get("responsable") ?? ""}
          onBlur={(e) => updateParam("responsable", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParam("responsable", e.currentTarget.value);
          }}
        />
      </div>
    </FilterBar>
  );
}
