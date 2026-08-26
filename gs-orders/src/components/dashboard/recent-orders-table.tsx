import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateShort } from "@/lib/utils/format";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from "@/types/domain";
import type { RecentOrderRow } from "@/components/dashboard/get-dashboard-data";

/**
 * Pedidos recientes — folio/cliente/vendedor/estado/fecha. Sin columna de
 * monto: GS Orders no tiene ningún campo de precio en orders/order_items
 * hoy (ver reporte de THÖREN Experience 1B). No duplica /pedidos — solo
 * los últimos 3 (Fase 6Q.1: resumen compacto, no listado; para eso está
 * /pedidos), sin filtros ni acciones, con link al detalle real. Lista, no
 * tabla — mismo criterio que Entregas próximas/Órdenes de compra abiertas.
 */
export function RecentOrdersTable({ orders }: { orders: RecentOrderRow[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Pedidos recientes</CardTitle>
        <Link href="/pedidos" className="text-xs font-medium text-accent hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      {orders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin actividad reciente"
          description="Los últimos pedidos creados aparecerán aquí."
        />
      ) : (
        <div className="divide-y divide-border">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/pedidos/${order.id}`}
              className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium text-accent">{order.folio}</p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {order.client_name} · {order.salespersonName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} variants={ORDER_STATUS_BADGE} />
                  <p className="text-xs text-ink-faint">{formatDateShort(order.order_date)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
