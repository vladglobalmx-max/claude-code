"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PURCHASE_ORDER_RECEIVABLE_STATUSES } from "@/types/domain";
import type { PurchaseOrderStatus, Warehouse } from "@/types/domain";
import { receivePurchaseOrderItem } from "../actions";

/**
 * THÖREN Fase 6L §4 / Fase 6M — registra la cantidad recibida ACUMULADA
 * (no un delta) de una partida. Deshabilitado en 'borrador' (aún no se
 * ordenó al proveedor) y en 'cancelada' (terminal) — mismo guard que
 * rpc_receive_purchase_order_item, para no ofrecer una acción que la RPC
 * igual rechazaría.
 *
 * Fase 6M: una partida ligada a Product Catalog exige almacén destino —
 * genera un movimiento de inventario (ver rpc_receive_purchase_order_item).
 * `lockedWarehouseId` viene de inventory_movements ya registrados para
 * esta partida (no se duplica en purchase_order_items): una vez que
 * empieza a recibirse, el almacén queda fijo. Partidas sin
 * catalog_product_id (línea manual) no tienen producto que rastrear en
 * Inventory, así que no piden almacén.
 */
export function ReceiveItemForm({
  purchaseOrderId,
  purchaseOrderItemId,
  quantityOrdered,
  quantityReceived,
  status,
  hasCatalogProduct,
  warehouses,
  lockedWarehouseId,
}: {
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  status: PurchaseOrderStatus;
  hasCatalogProduct: boolean;
  warehouses: Warehouse[];
  lockedWarehouseId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(quantityReceived);
  const [warehouseId, setWarehouseId] = useState(lockedWarehouseId ?? "");
  const canReceive = PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(status);

  if (!canReceive) {
    return <span className="text-xs text-ink-faint">—</span>;
  }

  function handleSave() {
    if (value < 0 || value > quantityOrdered) {
      toast.error(`La cantidad recibida debe estar entre 0 y ${quantityOrdered}`);
      return;
    }
    if (hasCatalogProduct && !warehouseId) {
      toast.error("Selecciona un almacén destino");
      return;
    }
    startTransition(async () => {
      const result = await receivePurchaseOrderItem(
        purchaseOrderItemId,
        purchaseOrderId,
        value,
        hasCatalogProduct ? warehouseId : null
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recepción registrada");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        min={0}
        max={quantityOrdered}
        className="h-8 w-20"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      {hasCatalogProduct && (
        <Select
          className="h-8 w-auto"
          value={warehouseId}
          disabled={lockedWarehouseId !== null}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          <option value="">Almacén…</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      )}
      <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleSave}>
        Registrar
      </Button>
    </div>
  );
}
