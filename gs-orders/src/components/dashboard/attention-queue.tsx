import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AttentionLevelIndicator } from "@/components/ui/attention-level-indicator";
import { DueDateStatusIndicator } from "@/components/ui/due-date-status-indicator";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { ATTENTION_LEVEL_LABELS, formatDaysInStatus } from "@/lib/dashboard/attention-queue";
import { ORDER_OPERATIONAL_STATUS_BADGE, ORDER_OPERATIONAL_STATUS_LABELS } from "@/types/domain";
import type { AttentionLevel } from "@/lib/dashboard/attention-queue";
import type { AttentionQueueRow } from "@/components/dashboard/get-dashboard-data";

/**
 * THÖREN Fase 6Q.2 — variante del Badge (Design System existente) para el
 * rótulo de nivel en el modo `compact` (lista ejecutiva): mismo mapeo
 * semántico que ATTENTION_LEVEL_DOT_COLOR (lib/dashboard/attention-queue.ts)
 * — ningún nivel/umbral nuevo, es la MISMA clasificación, solo cambia de
 * "punto + texto" a badge (referencia visual aportada por el usuario).
 */
const LEVEL_BADGE_VARIANT: Record<AttentionLevel, BadgeProps["variant"]> = {
  normal: "neutral",
  atencion: "warning",
  critico: "danger",
};

/**
 * THÖREN Fase 6I/6J — pedidos activos (fuera de completado/cancelado)
 * ordenados por prioridad de atención (crítico -> atención -> normal;
 * dentro de cada nivel, más días primero — ver buildAttentionQueue) — la
 * lista de "qué revisar hoy". Mobile: tarjetas; desktop: tabla — mismo
 * patrón responsive que /pedidos (page.tsx, `sm:hidden` / `hidden sm:block`).
 */
export function AttentionQueue({
  rows,
  title = "Requieren atención",
  compact = false,
  className,
}: {
  rows: AttentionQueueRow[];
  /** Fase 6Q — Command Center reutiliza este mismo componente/lógica bajo el encabezado "Atención ejecutiva"; el título por default se conserva para no romper otros usos futuros. */
  title?: string;
  /**
   * Fase 6Q.1 — "lista ejecutiva de excepciones": abandona la tabla de
   * columnas (incluso la versión de 7 columnas de 6Q) por una lista de
   * filas escaneables en 2 segundos (nivel + folio/cliente + seguimiento ·
   * días + vencimiento), igual en cualquier ancho — mismos datos/orden que
   * produce buildAttentionQueue, cero lógica nueva. El modo tabla original
   * se conserva intacto para `compact=false`.
   */
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
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
      ) : compact ? (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/pedidos/${row.id}`}
              className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-2/60"
            >
              <Badge variant={LEVEL_BADGE_VARIANT[row.attentionLevel]} className="w-[84px] shrink-0 justify-center">
                {ATTENTION_LEVEL_LABELS[row.attentionLevel]}
              </Badge>
              <div className="min-w-[160px] max-w-full flex-1 overflow-hidden">
                <p className="truncate font-mono text-sm font-medium text-accent">{row.folio}</p>
                <p className="truncate text-sm text-ink">{row.clientName}</p>
              </div>
              <div className="min-w-[160px] max-w-full flex-1 overflow-hidden text-sm">
                <p className="truncate text-ink-soft">{ORDER_OPERATIONAL_STATUS_LABELS[row.operationalStatus]}</p>
                <p className="text-xs text-ink-faint">{formatDaysInStatus(row.daysInStatus)}</p>
              </div>
              <div className="shrink-0">
                {row.dueDateStatus ? (
                  <DueDateStatusIndicator status={row.dueDateStatus} />
                ) : (
                  <span className="text-xs text-ink-faint">—</span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
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
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <AttentionLevelIndicator level={row.attentionLevel} />
                  <p className="text-xs text-ink-faint">
                    Desde {formatDateShort(row.lastChangedAt)} · {formatDaysInStatus(row.daysInStatus)}
                  </p>
                </div>
                {row.dueDateStatus && (
                  <div className="mt-1">
                    <DueDateStatusIndicator status={row.dueDateStatus} />
                  </div>
                )}
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
                  <Th>Nivel</Th>
                  <Th>Vencimiento</Th>
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
                    <Td className="tabular-nums text-ink-soft">{formatDaysInStatus(row.daysInStatus)}</Td>
                    <Td>
                      <AttentionLevelIndicator level={row.attentionLevel} />
                    </Td>
                    <Td>{row.dueDateStatus ? <DueDateStatusIndicator status={row.dueDateStatus} /> : "—"}</Td>
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
