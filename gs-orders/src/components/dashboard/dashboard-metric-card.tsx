import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { DashboardCard } from "./get-role-dashboard-data";

/**
 * Tarjeta de métrica reutilizable del dashboard de Inicio (0084/0085) —
 * número grande + label + ícono + link al módulo. `compact` (0085) reduce
 * padding/tipografía para vivir dentro de un bloque (Comercial/Compras/
 * Operación) sin competir visualmente con los 3 KPIs del hero.
 */
export function DashboardMetricCard({ label, count, href, icon: Icon, compact = false }: DashboardCard & { compact?: boolean }) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          "border-border/60 transition-colors hover:border-accent/40 hover:shadow-sm",
          compact ? "p-3" : "p-4"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-bold tabular-nums text-ink", compact ? "text-xl" : "text-2xl")}>{count}</p>
            <p className={cn("mt-0.5 truncate text-ink-faint", compact ? "text-xs" : "text-sm")}>{label}</p>
          </div>
          <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent", compact ? "h-7 w-7" : "h-9 w-9")}>
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
