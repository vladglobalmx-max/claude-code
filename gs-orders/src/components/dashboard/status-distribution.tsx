import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/types/domain";

const STATUS_ORDER: OrderStatus[] = ["borrador", "pedido", "cerrado", "cancelado"];

/** Mismo color por estado que ORDER_STATUS_BADGE (types/domain.ts), como relleno sólido de barra en vez de badge. */
const STATUS_BAR_COLOR: Record<OrderStatus, string> = {
  borrador: "bg-ink-faint",
  pedido: "bg-accent",
  cerrado: "bg-success",
  cancelado: "bg-danger",
};

export function StatusDistribution({ breakdown }: { breakdown: Record<OrderStatus, number> }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + breakdown[status], 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos por estado — este mes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-ink-faint">Sin pedidos este mes todavía.</p>
        ) : (
          STATUS_ORDER.map((status) => {
            const count = breakdown[status];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{ORDER_STATUS_LABELS[status]}</span>
                  <span className="tabular-nums text-ink">{formatNumber(count)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${STATUS_BAR_COLOR[status]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
