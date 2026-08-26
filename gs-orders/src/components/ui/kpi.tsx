import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Tile de indicador reutilizable (THÖREN Experience 1B). Deliberadamente
 * NO usa Card por default — es más plano/denso que una card de contenido,
 * con el número como protagonista tipográfico. `trend` es opcional: solo
 * se muestra cuando hay una base real contra la cual comparar (ver
 * formatPercentDelta en lib/utils/format.ts — null cuando no aplica).
 */
export function Kpi({
  label,
  value,
  icon: Icon,
  trend,
  helper,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { label: string; positive: boolean } | null;
  /** Contexto secundario útil (Fase 6Q — Command Center), ej. "12 unidades en camino". Independiente de `trend`: no requiere una base comparativa. */
  helper?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-5 shadow-card", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-ink-faint" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold tabular-nums text-ink">{value}</p>
        {trend && (
          <span className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-danger")}>
            {trend.label}
          </span>
        )}
      </div>
      {helper && <p className="mt-1 text-xs text-ink-faint">{helper}</p>}
    </div>
  );
}
