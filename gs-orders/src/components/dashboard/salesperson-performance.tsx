import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import type { SalespersonBreakdownRow } from "@/components/dashboard/get-dashboard-data";

/**
 * Solo ADMIN — VENDEDOR ya no recibe esta prop (get-dashboard-data.ts
 * devuelve null): RLS limita sus pedidos a los propios, así que un
 * comparativo con "otros vendedores" no existe para su sesión. Esto es
 * una decisión de presentación, no un bypass de RLS — la restricción real
 * ya la impone la base de datos.
 */
export function SalespersonPerformance({ rows }: { rows: SalespersonBreakdownRow[] }) {
  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento por vendedor — este mes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-faint">Sin pedidos este mes todavía.</p>
        ) : (
          rows.map((row) => {
            const pct = maxCount > 0 ? Math.round((row.count / maxCount) * 100) : 0;
            return (
              <div key={row.salespersonId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{row.salespersonName}</span>
                  <span className="tabular-nums text-ink">{formatNumber(row.count)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
