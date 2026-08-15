"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS } from "@/components/layout/nav-config";

/**
 * Fundación de breadcrumbs: resuelve "Grupo / Página" a partir del árbol de
 * navegación (nav-config.ts) y la ruta actual. Para rutas anidadas sin
 * entrada propia en el árbol (ej. /pedidos/[id]) solo muestra hasta la
 * entrada de nivel de lista — el detalle por-registro (folio, nombre, etc.)
 * se agrega página por página en fases posteriores, no aquí.
 */
export function Breadcrumbs() {
  const pathname = usePathname();

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const matches = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
      if (!matches) continue;

      return (
        <nav className="flex items-center gap-1.5 text-sm">
          {group.label && (
            <>
              <span className="text-ink-faint">{group.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
            </>
          )}
          <span className="font-medium text-ink">{item.label}</span>
        </nav>
      );
    }
  }

  return null;
}
