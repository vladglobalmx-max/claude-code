import Link from "next/link";
import { ChevronRight, PackageCheck } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateShort } from "@/lib/utils/format";
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "@/types/domain";
import type { DeliveryStatus, DeliveryType } from "@/types/domain";
import type { UpcomingDeliveryRow } from "@/components/dashboard/get-dashboard-data";

/**
 * THÖREN Fase 6Q — bloque compacto "Entregas próximas" (programada/
 * en_proceso, ver get-dashboard-data.ts). Resumen, no listado — máximo 3
 * filas, sin filtros; para el detalle completo está /entregas.
 */
export function UpcomingDeliveries({ rows, totalCount }: { rows: UpcomingDeliveryRow[]; totalCount: number }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Entregas próximas</CardTitle>
        <Link href="/entregas" className="text-xs font-medium text-accent hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Sin entregas programadas" description="Las próximas entregas e instalaciones aparecerán aquí." />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/entregas/${row.id}`}
              className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium text-accent">{row.label}</p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {row.clientName} · {DELIVERY_TYPE_LABELS[row.deliveryType as DeliveryType] ?? row.deliveryType}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge
                    status={row.status as DeliveryStatus}
                    labels={DELIVERY_STATUS_LABELS}
                    variants={DELIVERY_STATUS_BADGE}
                  />
                  <p className="text-xs text-ink-faint">{row.scheduledDate ? formatDateShort(row.scheduledDate) : "Sin fecha"}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
          {totalCount > rows.length && (
            <p className="px-5 py-2 text-xs text-ink-faint">+{totalCount - rows.length} más en /entregas</p>
          )}
        </div>
      )}
    </Card>
  );
}
