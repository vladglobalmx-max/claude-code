import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateShort } from "@/lib/utils/format";
import { PURCHASE_ORDER_STATUS_BADGE, PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrderStatus } from "@/types/domain";
import type { PurchaseOrderInTransitRow } from "@/components/dashboard/get-dashboard-data";

/**
 * THÖREN Fase 6Q — bloque compacto "Órdenes de compra abiertas" (POs fuera
 * de recibida/cancelada, ver get-dashboard-data.ts — mismo
 * purchaseOrdersOpenCount que el KPI del hero y THÖREN Intelligence, ver
 * hotfix semántico 6Q). Resumen, no listado — máximo 3 filas; para el
 * detalle completo está /compras.
 */
export function PurchaseOrdersInTransit({ rows, totalCount }: { rows: PurchaseOrderInTransitRow[]; totalCount: number }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Órdenes de compra abiertas</CardTitle>
        <Link href="/compras" className="text-xs font-medium text-accent hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState icon={Package} title="Sin órdenes de compra abiertas" description="Las Purchase Orders abiertas aparecerán aquí." />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/compras/${row.id}`}
              className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium text-accent">{row.folio}</p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {row.supplierName} · Pedido {row.orderFolio}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge
                    status={row.status as PurchaseOrderStatus}
                    labels={PURCHASE_ORDER_STATUS_LABELS}
                    variants={PURCHASE_ORDER_STATUS_BADGE}
                  />
                  <p className="text-xs text-ink-faint">
                    {row.estimatedReceptionDate ? formatDateShort(row.estimatedReceptionDate) : "Sin fecha estimada"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
          {totalCount > rows.length && (
            <p className="px-5 py-2 text-xs text-ink-faint">+{totalCount - rows.length} más en /compras</p>
          )}
        </div>
      )}
    </Card>
  );
}
