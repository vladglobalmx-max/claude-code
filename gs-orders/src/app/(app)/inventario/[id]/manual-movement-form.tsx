"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { INVENTORY_MANUAL_MOVEMENT_TYPES, INVENTORY_MOVEMENT_TYPE_LABELS } from "@/types/domain";
import type { InventoryMovementType, Warehouse } from "@/types/domain";
import { createInventoryMovement } from "../actions";

/**
 * THÖREN Fase 6M §5 — Entrada/Salida manual y Ajustes +/-. Solo se
 * renderiza para ADMIN (gateado en la página). Toda operación genera un
 * movimiento (rpc_create_inventory_movement); una salida/ajuste negativo
 * que dejaría On Hand negativo se rechaza server-side.
 */
export function ManualMovementForm({ productId, warehouses }: { productId: string; warehouses: Warehouse[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState("");
  const [movementType, setMovementType] = useState<InventoryMovementType>("entrada_manual");
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!warehouseId) {
      toast.error("Selecciona un almacén");
      return;
    }
    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }
    startTransition(async () => {
      const result = await createInventoryMovement(crypto.randomUUID(), {
        product_id: productId,
        warehouse_id: warehouseId,
        movement_type: movementType,
        quantity,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Movimiento registrado");
      setReference("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="warehouse">Almacén</Label>
        <Select id="warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Selecciona un almacén…</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="movement_type">Tipo de movimiento</Label>
        <Select id="movement_type" value={movementType} onChange={(e) => setMovementType(e.target.value as InventoryMovementType)}>
          {INVENTORY_MANUAL_MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {INVENTORY_MOVEMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="quantity">Cantidad</Label>
        <Input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
      <div>
        <Label htmlFor="reference">Referencia (opcional)</Label>
        <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Conteo físico, traspaso…" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          Registrar movimiento
        </Button>
      </div>
    </div>
  );
}
