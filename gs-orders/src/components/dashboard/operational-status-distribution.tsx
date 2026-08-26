import Link from "next/link";
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

/** Mismo color por estado que ORDER_OPERATIONAL_STATUS_BADGE (types/domain.ts), como línea/texto sólido en vez de badge. */
const STATUS_COLOR: Record<OrderOperationalStatus, string> = {
  pedido: "text-ink-faint",
  en_proceso: "text-accent",
  ordenado_a_proveedor: "text-accent",
  en_transito: "text-warning",
  recibido: "text-accent",
  programado_entrega_instalacion: "text-warning",
  completado: "text-success",
  cancelado: "text-danger",
};
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
 * THÖREN Fase 6I/6Q.2 — snapshot ACTUAL (no acotado al mes) de todos los
 * pedidos por operational_status (0033). Fase 6Q.2 cambia la presentación
 * de lista vertical con barras a una fila de tiles compactos (número
 * grande a color + subrayado corto) — referencia visual aportada por el
 * usuario — mismo dato/orden, mismo link a /pedidos?seguimiento={estado}
 * (requisito de 6I), menos alto ocupado en la analítica secundaria.
 */
export function OperationalStatusDistribution({ breakdown }: { breakdown: Record<OrderOperationalStatus, number> }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + breakdown[status], 0);

  return (
    <div>
      <p className="text-xs font-medium text-ink-faint">Pedidos por seguimiento</p>
      {total === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">Sin pedidos todavía.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-4">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              href={`/pedidos?seguimiento=${status}`}
              className="group min-w-[92px]"
            >
              <p className="truncate text-[11px] text-ink-faint">{ORDER_OPERATIONAL_STATUS_LABELS[status]}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${STATUS_COLOR[status]}`}>
                {formatNumber(breakdown[status])}
              </p>
              <div
                className={`mt-1.5 h-0.5 w-8 rounded-full ${STATUS_BAR_COLOR[status]} opacity-70 transition-opacity group-hover:opacity-100`}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
