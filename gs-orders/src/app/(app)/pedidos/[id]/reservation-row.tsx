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
import {
  reserveInventory,
  adjustInventoryReservation,
  releaseInventoryReservation,
  fulfillInventoryReservation,
} from "./reservation-actions";
import type { ReservationRowData } from "./reservations-section";

/**
 * THÖREN Fase 6N — fila de reserva para UN producto de catálogo del
 * Pedido. Sin reserva activa: formulario "Reservar" (almacén + cantidad).
 * Con reserva activa: cantidad editable ("Actualizar") + "Liberar" +
 * "Surtir" (Fase 6O). El disponible mostrado por almacén ya es el
 * AVAILABLE real (server-side se revalida siempre en la RPC, esto es solo
 * una guía en la UI).
 *
 * AJUSTE FINAL (6N) — `row.isOrphaned` (el producto ya no está entre las
 * partidas actuales del Pedido, pero la reserva sigue activa) agrega una
 * alerta visual: Actualizar/Liberar siguen funcionando exactamente igual
 * que en una reserva normal (nunca se libera sola). Fase 6O (requisito
 * #8): el formulario de Surtir NO se muestra para una reserva huérfana —
 * server-side la RPC la rechazaría de todas formas, esto solo evita
 * ofrecer una acción que sabemos que va a fallar.
 *
 * El campo "Surtir" pide la cantidad INCREMENTAL a surtir AHORA (no el
 * acumulado) — internamente se traduce al valor absoluto que espera
 * rpc_fulfill_inventory_reservation (fulfilled_quantity + incremento),
 * igual que "Actualizar" ya usa el total absoluto para `quantity`.
 */
export function ReservationRow({ orderId, row }: { orderId: string; row: ReservationRowData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(row.availability[0]?.warehouseId ?? "");
  const [newQuantity, setNewQuantity] = useState(1);
  const [adjustQuantity, setAdjustQuantity] = useState(row.reservation?.quantity ?? 1);
  const [fulfillIncrement, setFulfillIncrement] = useState(1);

  const selectedAvailability = row.availability.find((a) => a.warehouseId === warehouseId);
  const ownWarehouseAvailability = row.reservation
    ? row.availability.find((a) => a.warehouseId === row.reservation!.warehouse_id)
    : undefined;

  const pendingToFulfill = row.reservation ? row.reservation.quantity - row.reservation.fulfilled_quantity : 0;
  const maxFulfillNow = Math.min(pendingToFulfill, ownWarehouseAvailability?.onHand ?? 0);

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

  function handleFulfill() {
    if (!row.reservation) return;
    if (fulfillIncrement <= 0) {
      toast.error("La cantidad a surtir debe ser mayor a cero");
      return;
    }
    if (fulfillIncrement > pendingToFulfill) {
      toast.error(`No puedes surtir más de lo pendiente (${pendingToFulfill})`);
      return;
    }
    startTransition(async () => {
      const result = await fulfillInventoryReservation(
        orderId,
        row.productId,
        row.reservation!.id,
        row.reservation!.fulfilled_quantity + fulfillIncrement
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Surtido registrado");
      setFulfillIncrement(1);
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
            Reservado: <span className="font-medium text-ink">{formatNumber(row.reservation.quantity)}</span> · Surtido:{" "}
            <span className="font-medium text-ink">{formatNumber(row.reservation.fulfilled_quantity)}</span> · Pendiente de surtir:{" "}
            <span className="font-medium text-ink">{formatNumber(pendingToFulfill)}</span> en {row.reservationWarehouseName ?? "—"}
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
      ) : null}

      {row.reservation && !row.isOrphaned && pendingToFulfill > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div>
            <Label htmlFor={`fulfill-${row.productId}`}>Surtir ahora</Label>
            <Input
              id={`fulfill-${row.productId}`}
              type="number"
              min={1}
              max={maxFulfillNow}
              className="w-28"
              value={fulfillIncrement}
              onChange={(e) => setFulfillIncrement(Number(e.target.value))}
            />
          </div>
          <p className="pb-2 text-xs text-ink-faint">
            Máximo ahora: {formatNumber(maxFulfillNow)} (pendiente {formatNumber(pendingToFulfill)}, ON HAND en{" "}
            {row.reservationWarehouseName}: {formatNumber(ownWarehouseAvailability?.onHand ?? 0)})
          </p>
          <Button type="button" size="sm" variant="primary" loading={isPending} disabled={isPending} onClick={handleFulfill}>
            Surtir
          </Button>
        </div>
      )}

      {row.reservation ? null : (
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
