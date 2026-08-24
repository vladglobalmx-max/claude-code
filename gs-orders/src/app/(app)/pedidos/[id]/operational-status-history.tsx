import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils/format";
import { ORDER_OPERATIONAL_STATUS_BADGE, ORDER_OPERATIONAL_STATUS_LABELS } from "@/types/domain";
import type { OrderOperationalStatusHistoryEntry } from "@/types/domain";

/**
 * Historial de seguimiento operativo (THÖREN Fase 6H) — orden más reciente
 * primero (mismo criterio que la consulta que arma este arreglo,
 * .order("changed_at", { ascending: false })). Cada fila es INSERT-only,
 * escrita por un trigger — nunca se borra ni se edita, así que esta lista
 * siempre refleja el historial completo desde que existe el pedido.
 */
export function OrderOperationalStatusHistory({ entries }: { entries: OrderOperationalStatusHistoryEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <StatusBadge
                status={entry.new_status}
                labels={ORDER_OPERATIONAL_STATUS_LABELS}
                variants={ORDER_OPERATIONAL_STATUS_BADGE}
              />
              {entry.previous_status && (
                <span className="text-xs text-ink-faint">
                  (antes: {ORDER_OPERATIONAL_STATUS_LABELS[entry.previous_status]})
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-faint">{entry.changed_by_name ?? "—"}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-ink-faint">{formatDateTime(entry.changed_at)}</span>
        </div>
      ))}
    </div>
  );
}
