"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { SalesOrderItem } from "@/types/domain";
import { syncSalesOrderProcurement, type SalesOrderShortageRow } from "../actions";

interface Props {
  salesOrderId: string;
  items: SalesOrderItem[];
  initialShortage: Record<string, SalesOrderShortageRow>;
  canSync: boolean;
  isBlocked: boolean;
}

/**
 * THÖREN Ticket C1 (0091) / E1 — panel simple de abastecimiento por
 * partida: cantidad, surtido, disponible/reservado, faltante. Deriva
 * "surtido" como quantity - pending_qty (fn_sales_order_item_shortage ya
 * resta lo despachado vía sales_fulfillment_items) — no se persiste ningún
 * estado nuevo aquí, todo viene de los RPCs de C1. Líneas libres (sin
 * catalog_product_id) no tienen fila de shortage (la función las omite a
 * propósito, igual que en orders) — se muestran sin faltante calculable.
 * "Sincronizar abastecimiento" invoca rpc_sync_sales_order_procurement tal
 * cual — si la Sales Order está bloqueada por pago, el propio backend
 * responde sin filas (no-op), reflejado aquí sin inventar ningún mensaje
 * de error.
 */
export function SalesOrderShortagePanel({ salesOrderId, items, initialShortage, canSync, isBlocked }: Props) {
  const [shortageByItem, setShortageByItem] = useState(initialShortage);
  const [isPending, startTransition] = useTransition();

  const catalogItems = items.filter((item) => item.catalog_product_id !== null);
  if (catalogItems.length === 0) return null;

  function handleSync() {
    startTransition(async () => {
      const result = await syncSalesOrderProcurement(salesOrderId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const next: Record<string, SalesOrderShortageRow> = {};
      for (const row of result.rows ?? []) {
        next[row.sales_order_item_id] = row;
      }
      setShortageByItem(next);
      if (!result.rows || result.rows.length === 0) {
        toast.info("No hay nada que sincronizar todavía — la Sales Order no está liberada financieramente.");
      } else {
        toast.success("Abastecimiento sincronizado.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Abastecimiento por partida</CardTitle>
        {canSync && (
          <Button type="button" variant="outline" size="sm" loading={isPending} disabled={isPending} onClick={handleSync}>
            <RefreshCw className="h-3.5 w-3.5" />
            Sincronizar abastecimiento
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isBlocked && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              Esta Sales Order está bloqueada por pago — el abastecimiento (reservas/requisición) no se libera hasta que se
              confirme el pago o crédito.
            </p>
          </div>
        )}

        <div className="space-y-2 sm:hidden">
          {catalogItems.map((item) => {
            const s = shortageByItem[item.id];
            const fulfilled = s ? item.quantity - s.pending_qty : 0;
            return (
              <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium text-ink">{item.sku_snapshot}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {item.quantity} solicitadas · {fulfilled} surtidas
                </p>
                {s ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    Reservado {s.reserved_qty} · Disponible {Math.max(s.available_qty, 0)} ·{" "}
                    <span className={s.shortage_qty > 0 ? "font-medium text-danger" : "text-success"}>
                      {s.shortage_qty > 0 ? `Faltan ${s.shortage_qty}` : "Sin faltante"}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-faint">Sin sincronizar todavía</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden sm:block">
          <Table>
            <Thead>
              <Tr>
                <Th>Partida</Th>
                <Th>Cantidad</Th>
                <Th>Surtido</Th>
                <Th>Reservado</Th>
                <Th>Disponible</Th>
                <Th>Faltante</Th>
              </Tr>
            </Thead>
            <Tbody>
              {catalogItems.map((item) => {
                const s = shortageByItem[item.id];
                const fulfilled = s ? item.quantity - s.pending_qty : 0;
                return (
                  <Tr key={item.id}>
                    <Td>
                      <p className="font-medium text-ink">{item.sku_snapshot}</p>
                    </Td>
                    <Td className="text-ink-soft">{item.quantity}</Td>
                    <Td className="text-ink-soft">{s ? fulfilled : "—"}</Td>
                    <Td className="text-ink-soft">{s ? s.reserved_qty : "—"}</Td>
                    <Td className="text-ink-soft">{s ? Math.max(s.available_qty, 0) : "—"}</Td>
                    <Td>
                      {s ? (
                        <span className={s.shortage_qty > 0 ? "font-medium text-danger" : "text-success"}>
                          {s.shortage_qty > 0 ? s.shortage_qty : "0"}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>

        {!canSync && (
          <p className="text-xs text-ink-faint">
            No tienes permiso para sincronizar el abastecimiento de esta Sales Order.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
