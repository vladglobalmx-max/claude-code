import type { LucideIcon } from "lucide-react";
import { DashboardMetricCard } from "./dashboard-metric-card";
import type { DashboardCard } from "./get-role-dashboard-data";

/**
 * THÖREN 0085 — bloque del "Resumen operativo" (Comercial/Compras/
 * Operación, o el equivalente por persona). Encabezado con ícono + título,
 * tarjetas internas SIEMPRE compactas — nunca 9 tarjetas iguales sueltas.
 */
export function DashboardBlockSection({ title, icon: Icon, cards }: { title: string; icon: LucideIcon; cards: DashboardCard[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-faint" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <DashboardMetricCard key={card.label} {...card} compact />
        ))}
      </div>
    </section>
  );
}
