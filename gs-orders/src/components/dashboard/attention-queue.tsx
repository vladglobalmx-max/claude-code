import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatNumber } from "@/lib/utils/format";
import { ORDER_OPERATIONAL_STATUS_BADGE, ORDER_OPERATIONAL_STATUS_LABELS } from "@/types/domain";
import type { AttentionQueueRow } from "@/components/dashboard/get-dashboard-data";

function daysLabel(days: number): string {
  return days === 1 ? "1 día" : `${formatNumber(days)} días`;
}

/**
 * THÖREN Fase 6I — pedidos activos (fuera de completado/cancelado) más
 * antiguos en su estado actual primero — la lista de "qué revisar hoy".
 * Mobile: tarjetas; desktop: tabla — mismo patrón responsive que /pedidos
 * (page.tsx, `sm:hidden` / `hidden sm:block`).
 */
export function AttentionQueue({ rows }: { rows: AttentionQueueRow[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Requieren atención</CardTitle>
        <Link href="/pedidos" className="text-xs font-medium text-accent hover:underline">
          Ver todos los pedidos
        </Link>
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Sin pendientes"
          description="No hay pedidos activos esperando avanzar de estado."
        />
      ) : (
        <>
          {/* Mobile: tarjetas. */}
          <div className="space-y-3 p-4 sm:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/pedidos/${row.id}`}
                className="block rounded-lg border border-border p-3 hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-accent">{row.folio}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">{row.clientName}</p>
                  </div>
                  <StatusBadge
                    status={row.operationalStatus}
                    labels={ORDER_OPERATIONAL_STATUS_LABELS}
                    variants={ORDER_OPERATIONAL_STATUS_BADGE}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {row.businessUnitName} · {row.salespersonName}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Desde {formatDateShort(row.lastChangedAt)} · {daysLabel(row.daysInStatus)} en este estado
                </p>
              </Link>
            ))}
          </div>

          {/* Desktop/tablet: tabla. */}
          <div className="hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Folio</Th>
                  <Th>Cliente</Th>
                  <Th>Business Unit</Th>
                  <Th>Vendedor</Th>
                  <Th>Seguimiento</Th>
                  <Th>Último cambio</Th>
                  <Th>Días en el estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link href={`/pedidos/${row.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                        {row.folio}
                      </Link>
                    </Td>
                    <Td>{row.clientName}</Td>
                    <Td className="text-ink-soft">{row.businessUnitName}</Td>
                    <Td className="text-ink-soft">{row.salespersonName}</Td>
                    <Td>
                      <StatusBadge
                        status={row.operationalStatus}
                        labels={ORDER_OPERATIONAL_STATUS_LABELS}
                        variants={ORDER_OPERATIONAL_STATUS_BADGE}
                      />
                    </Td>
                    <Td className="text-ink-soft">{formatDateShort(row.lastChangedAt)}</Td>
                    <Td className="tabular-nums text-ink-soft">{daysLabel(row.daysInStatus)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
