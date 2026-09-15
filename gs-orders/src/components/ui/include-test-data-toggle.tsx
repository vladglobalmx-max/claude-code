"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * THÖREN 0077 — Test Data / Purga de operaciones de prueba. Checkbox
 * "Incluir pruebas" reutilizable en cada listado (Órdenes de Venta,
 * Requisiciones, Compras, Recepciones, Surtidos, Facturas, Comisiones):
 * por defecto oculta operaciones de prueba (?incluir_pruebas ausente), lo
 * que cada page.tsx lee de `searchParams.incluir_pruebas` para filtrar
 * (columna propia is_test cuando existe — sales_orders/purchase_orders —
 * o el is_test heredado de la Sales Order relacionada en los demás).
 * Mismo patrón de URL params que PurchaseOrderFilters (compras/
 * purchase-order-filters.tsx).
 */
export function IncludeTestDataToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const includeTest = searchParams.get("incluir_pruebas") === "1";

  function toggle(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("incluir_pruebas", "1");
    else params.delete("incluir_pruebas");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        checked={includeTest}
        onChange={(e) => toggle(e.target.checked)}
      />
      Incluir pruebas
    </label>
  );
}
