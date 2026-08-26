import { formatNumber } from "@/lib/utils/format";
import type { BusinessUnitOrderCountRow } from "@/components/dashboard/get-dashboard-data";

/**
 * THÖREN Fase 6Q — Analítica (A): Pedidos del mes agrupados por Business
 * Unit real (0014). Los datos ya vienen agregados desde
 * get-dashboard-data.ts (mismas filas que monthOrderCount, cero query
 * adicional). Fase 6Q.1 — tratamiento deliberadamente ligero (sin Card/
 * borde propio): la analítica secundaria no debe competir con Flujo
 * Operativo/Atención Ejecutiva, ver DECISIÓN de jerarquía en dashboard-view.tsx.
 */
export function OrdersByBusinessUnit({ rows, monthLabel }: { rows: BusinessUnitOrderCountRow[]; monthLabel: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <p className="text-xs font-medium text-ink-faint">Pedidos por Business Unit · {monthLabel}</p>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-faint">Sin pedidos con Business Unit asignada este mes.</p>
        ) : (
          rows.map((row) => {
            const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
            return (
              <div key={row.businessUnitId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{row.name}</span>
                  <span className="tabular-nums text-ink">{formatNumber(row.count)}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
