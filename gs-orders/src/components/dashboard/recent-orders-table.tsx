import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from "@/types/domain";
import type { RecentOrderRow } from "@/components/dashboard/get-dashboard-data";

/**
 * Pedidos recientes — folio/cliente/vendedor/estado/fecha. Sin columna de
 * monto: GS Orders no tiene ningún campo de precio en orders/order_items
 * hoy (ver reporte de THÖREN Experience 1B). No duplica /pedidos — solo
 * los últimos 8, sin filtros ni acciones, con link al detalle real.
 */
export function RecentOrdersTable({ orders }: { orders: RecentOrderRow[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Actividad reciente</CardTitle>
        <Link href="/pedidos" className="text-xs font-medium text-accent hover:underline">
          Ver todos los pedidos
        </Link>
      </CardHeader>
      {orders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin actividad reciente"
          description="Los últimos pedidos creados aparecerán aquí."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Folio</Th>
              <Th>Cliente</Th>
              <Th>Vendedor</Th>
              <Th>Estado</Th>
              <Th>Fecha</Th>
            </Tr>
          </Thead>
          <Tbody>
            {orders.map((order) => (
              <Tr key={order.id}>
                <Td>
                  <Link href={`/pedidos/${order.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                    {order.folio}
                  </Link>
                </Td>
                <Td>{order.client_name}</Td>
                <Td className="text-ink-soft">{order.salespersonName}</Td>
                <Td>
                  <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} variants={ORDER_STATUS_BADGE} />
                </Td>
                <Td className="text-ink-soft">{formatDateShort(order.order_date)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  );
}
