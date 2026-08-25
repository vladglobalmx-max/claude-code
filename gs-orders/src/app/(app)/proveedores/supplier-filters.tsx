"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";

export function SupplierFilters() {
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
      searchPlaceholder="Buscar por nombre, contacto o email…"
    />
  );
}
