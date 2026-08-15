import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Header de página reutilizable — extrae el patrón repetido en
 * Pedidos/Vendedores/Usuarios (título + subtítulo + acción a la derecha).
 * No se retroalimenta a esas páginas todavía (THÖREN Experience 1A es solo
 * fundación); queda lista para que 1B/1C/1D la adopten.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-ink-faint">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
