"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OrderItem, Supplier } from "@/types/domain";
import type { PurchaseOrderPayload } from "@/lib/validations/purchase-order";
import { createPurchaseOrder } from "../../../compras/actions";

interface SelectedItem {
  selected: boolean;
  quantity: number;
}

/**
 * THÖREN Fase 6L — selecciona una o varias partidas del Pedido origen para
 * repartirlas a un proveedor. Un mismo Pedido puede generar varias
 * Purchase Orders (§3: "no asumir un proveedor único por Pedido") —
 * repetir este flujo con otras partidas crea otra PO independiente.
 */
export function NewPurchaseOrderForm({
  purchaseOrderId,
  orderId,
  orderFolio,
  items,
  suppliers,
  defaultDate,
}: {
  purchaseOrderId: string;
  orderId: string;
  orderFolio: string;
  items: OrderItem[];
  suppliers: Supplier[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [poDate, setPoDate] = useState(defaultDate);
  const [supplierCommitmentDate, setSupplierCommitmentDate] = useState("");
  const [estimatedReceptionDate, setEstimatedReceptionDate] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState<Record<string, SelectedItem>>(() =>
    Object.fromEntries(items.map((item) => [item.id, { selected: false, quantity: item.quantity }]))
  );

  function toggleItem(itemId: string, selected: boolean) {
    setSelection((prev) => ({ ...prev, [itemId]: { selected, quantity: prev[itemId]?.quantity ?? 1 } }));
  }

  function setQuantity(itemId: string, quantity: number) {
    setSelection((prev) => ({ ...prev, [itemId]: { selected: prev[itemId]?.selected ?? false, quantity } }));
  }

  function handleSubmit() {
    if (!supplierId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    const selectedItems = items.filter((item) => selection[item.id]?.selected);
    if (selectedItems.length === 0) {
      toast.error("Selecciona al menos una partida");
      return;
    }
    if (selectedItems.some((item) => !((selection[item.id]?.quantity ?? 0) > 0))) {
      toast.error("La cantidad ordenada de cada partida debe ser mayor a cero");
      return;
    }

    const payload: PurchaseOrderPayload = {
      order_id: orderId,
      supplier_id: supplierId,
      po_date: poDate,
      supplier_commitment_date: supplierCommitmentDate || undefined,
      estimated_reception_date: estimatedReceptionDate || undefined,
      supplier_reference: supplierReference || undefined,
      notes: notes || undefined,
      items: selectedItems.map((item) => ({
        order_item_id: item.id,
        quantity_ordered: selection[item.id]?.quantity ?? 0,
      })),
    };

    startTransition(async () => {
      const result = await createPurchaseOrder(purchaseOrderId, payload);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.push(`/pedidos/${orderId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="supplier">Proveedor</Label>
        <Select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Selecciona un proveedor…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="po_date">Fecha de orden</Label>
          <Input id="po_date" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="supplier_reference">Referencia/PO del proveedor (opcional)</Label>
          <Input id="supplier_reference" value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="supplier_commitment_date">Fecha compromiso proveedor (opcional)</Label>
          <Input
            id="supplier_commitment_date"
            type="date"
            value={supplierCommitmentDate}
            onChange={(e) => setSupplierCommitmentDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="estimated_reception_date">Fecha estimada de recepción (opcional)</Label>
          <Input
            id="estimated_reception_date"
            type="date"
            value={estimatedReceptionDate}
            onChange={(e) => setEstimatedReceptionDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div>
        <Label>Partidas del Pedido {orderFolio}</Label>
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                checked={selection[item.id]?.selected ?? false}
                onChange={(e) => toggleItem(item.id, e.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{item.model}</p>
                {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                <p className="text-xs text-ink-faint">
                  Cantidad en el Pedido: {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </p>
              </div>
              <div className="w-24 shrink-0">
                <Label htmlFor={`qty-${item.id}`} className="text-xs">
                  A ordenar
                </Label>
                <Input
                  id={`qty-${item.id}`}
                  type="number"
                  min={1}
                  value={selection[item.id]?.quantity ?? item.quantity}
                  disabled={!selection[item.id]?.selected}
                  onChange={(e) => setQuantity(item.id, Number(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          Crear Purchase Order
        </Button>
      </div>
    </div>
  );
}
