import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils/format";
import { ORDER_OPERATIONAL_STATUS_LABELS, type OrderOperationalStatus } from "@/types/domain";

const STATUS_ORDER: OrderOperationalStatus[] = [
  "pedido",
  "en_proceso",
  "ordenado_a_proveedor",
  "en_transito",
  "recibido",
  "programado_entrega_instalacion",
  "completado",
  "cancelado",
];

/** Mismo color por estado que ORDER_OPERATIONAL_STATUS_BADGE (types/domain.ts), como relleno sólido de barra en vez de badge. */
const STATUS_BAR_COLOR: Record<OrderOperationalStatus, string> = {
  pedido: "bg-ink-faint",
  en_proceso: "bg-accent",
  ordenado_a_proveedor: "bg-accent",
  en_transito: "bg-warning",
  recibido: "bg-accent",
  programado_entrega_instalacion: "bg-warning",
  completado: "bg-success",
  cancelado: "bg-danger",
};

/**
 * THÖREN Fase 6I — snapshot ACTUAL (no acotado al mes, a diferencia de
 * StatusDistribution que sigue mostrando `status` legacy por separado) de
 * todos los pedidos por operational_status (0033). Cada fila es un link a
 * /pedidos?seguimiento={estado} — clickeable, lleva al listado ya filtrado
 * (requisito explícito de la fase).
 */
export function OperationalStatusDistribution({ breakdown }: { breakdown: Record<OrderOperationalStatus, number> }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + breakdown[status], 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos por seguimiento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-ink-faint">Sin pedidos todavía.</p>
        ) : (
          STATUS_ORDER.map((status) => {
            const count = breakdown[status];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <Link
                key={status}
                href={`/pedidos?seguimiento=${status}`}
                className="block rounded-md transition-opacity hover:opacity-80"
              >
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{ORDER_OPERATIONAL_STATUS_LABELS[status]}</span>
                  <span className="tabular-nums text-ink">{formatNumber(count)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${STATUS_BAR_COLOR[status]}`} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
