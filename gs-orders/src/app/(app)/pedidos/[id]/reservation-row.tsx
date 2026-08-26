"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatNumber } from "@/lib/utils/format";
import { reserveInventory, adjustInventoryReservation, releaseInventoryReservation } from "./reservation-actions";
import type { ReservationRowData } from "./reservations-section";

/**
 * THÖREN Fase 6N — fila de reserva para UN producto de catálogo del
 * Pedido. Sin reserva activa: formulario "Reservar" (almacén + cantidad).
 * Con reserva activa: cantidad editable ("Actualizar") + "Liberar". El
 * disponible mostrado por almacén ya es el AVAILABLE real (server-side se
 * revalida siempre en la RPC, esto es solo una guía en la UI).
 *
 * AJUSTE FINAL — `row.isOrphaned` (el producto ya no está entre las
 * partidas actuales del Pedido, pero la reserva sigue activa) solo agrega
 * una alerta visual: Actualizar/Liberar siguen funcionando exactamente
 * igual que en una reserva normal (nunca se libera sola).
 */
export function ReservationRow({ orderId, row }: { orderId: string; row: ReservationRowData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(row.availability[0]?.warehouseId ?? "");
  const [newQuantity, setNewQuantity] = useState(1);
  const [adjustQuantity, setAdjustQuantity] = useState(row.reservation?.quantity ?? 1);

  const selectedAvailability = row.availability.find((a) => a.warehouseId === warehouseId);
  const ownWarehouseAvailability = row.reservation
    ? row.availability.find((a) => a.warehouseId === row.reservation!.warehouse_id)
    : undefined;

  function handleReserve() {
    if (!warehouseId) {
      toast.error("Selecciona un almacén");
      return;
    }
    if (newQuantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }
    startTransition(async () => {
      const result = await reserveInventory(crypto.randomUUID(), {
        order_id: orderId,
        product_id: row.productId,
        warehouse_id: warehouseId,
        quantity: newQuantity,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Inventario reservado");
      router.refresh();
    });
  }

  function handleAdjust() {
    if (!row.reservation) return;
    if (adjustQuantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }
    startTransition(async () => {
      const result = await adjustInventoryReservation(orderId, row.productId, row.reservation!.id, adjustQuantity);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reserva actualizada");
      router.refresh();
    });
  }

  function handleRelease() {
    if (!row.reservation) return;
    startTransition(async () => {
      const result = await releaseInventoryReservation(orderId, row.productId, row.reservation!.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Reserva liberada");
      router.refresh();
    });
  }

  return (
    <div className={`rounded-lg border p-4 ${row.isOrphaned ? "border-warning/40 bg-warning/5" : "border-border"}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">{row.name}</p>
          <p className="font-mono text-xs text-ink-faint">
            {row.sku}
            {row.unit ? ` · ${row.unit}` : ""}
          </p>
        </div>
        {row.reservation && (
          <p className="text-xs text-ink-faint">
            Reservado: <span className="font-medium text-ink">{formatNumber(row.reservation.quantity)}</span> en{" "}
            {row.reservationWarehouseName ?? "—"}
          </p>
        )}
      </div>

      {row.isOrphaned && (
        <Badge variant="warning" className="mb-3">
          <AlertTriangle className="h-3 w-3" />
          Reserva sin partida activa — el producto ya no está en las partidas de este Pedido
        </Badge>
      )}

      {row.reservation ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor={`adjust-${row.productId}`}>Cantidad reservada</Label>
            <Input
              id={`adjust-${row.productId}`}
              type="number"
              min={1}
              className="w-28"
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(Number(e.target.value))}
            />
          </div>
          {ownWarehouseAvailability && (
            <p className="pb-2 text-xs text-ink-faint">Disponible en {row.reservationWarehouseName}: {formatNumber(ownWarehouseAvailability.available)}</p>
          )}
          <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleAdjust}>
            Actualizar
          </Button>
          <Button type="button" size="sm" variant="danger" loading={isPending} disabled={isPending} onClick={handleRelease}>
            Liberar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor={`warehouse-${row.productId}`}>Almacén</Label>
            <Select
              id={`warehouse-${row.productId}`}
              className="w-56"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              {row.availability.map((a) => (
                <option key={a.warehouseId} value={a.warehouseId}>
                  {a.warehouseName} — disponible: {formatNumber(a.available)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`quantity-${row.productId}`}>Cantidad</Label>
            <Input
              id={`quantity-${row.productId}`}
              type="number"
              min={1}
              max={selectedAvailability?.available}
              className="w-28"
              value={newQuantity}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
            />
          </div>
          <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleReserve}>
            Reservar stock
          </Button>
        </div>
      )}
    </div>
  );
}
