"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/**
 * Barra de filtros reutilizable — generaliza el patrón de
 * pedidos/order-filters.tsx (búsqueda + selects en una fila que envuelve).
 * Incluye debounce en la búsqueda (order-filters.tsx hoy dispara en cada
 * tecla; esta versión corrige eso para quien la adopte). No se retroalimenta
 * a order-filters.tsx todavía — THÖREN Experience 1A es solo fundación.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar…",
  debounceMs = 300,
  children,
  className,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  debounceMs?: number;
  children?: ReactNode;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(searchValue ?? "");

  useEffect(() => {
    setLocalValue(searchValue ?? "");
  }, [searchValue]);

  useEffect(() => {
    if (!onSearchChange) return;
    const handle = setTimeout(() => {
      if (localValue !== (searchValue ?? "")) onSearchChange(localValue);
    }, debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, debounceMs]);

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
      {onSearchChange && (
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
      )}
      {children}
    </div>
  );
}
