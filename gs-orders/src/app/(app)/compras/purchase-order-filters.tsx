"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { Supplier } from "@/types/domain";

export function PurchaseOrderFilters({
  suppliers,
  businessUnits,
}: {
  suppliers: Supplier[];
  /** THÖREN Fase 6L — derivada del Pedido origen de cada PO, nunca una columna propia (ver 0035). */
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
      searchPlaceholder="Buscar por folio, proveedor o Pedido…"
    >
      <Select
        className="w-auto"
        defaultValue={searchParams.get("estado") ?? ""}
        onChange={(e) => updateParam("estado", e.target.value)}
      >
        <option value="">Todos los estados</option>
        {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <Select
        className="w-auto"
        defaultValue={searchParams.get("proveedor") ?? ""}
        onChange={(e) => updateParam("proveedor", e.target.value)}
      >
        <option value="">Todos los proveedores</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

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
    </FilterBar>
  );
}
