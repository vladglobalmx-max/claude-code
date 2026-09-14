"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Warehouse } from "@/types/domain";
import type {
  SalesFulfillmentActionResult,
  SalesFulfillmentWriteItemPayload,
  SalesFulfillmentWritePayload,
} from "@/app/(app)/surtidos/actions";

export interface CandidateLine {
  salesOrderItemId: string;
  skuSnapshot: string;
  descriptionSnapshot: string | null;
  uomSnapshot: string | null;
  quantity: number;
  /** Ya comprometido por OTROS surtidos activos (nunca incluye las líneas de este mismo surtido en modo "edit"). */
  alreadyCommitted: number;
  remaining: number;
}

interface SelectedLine {
  selected: boolean;
  quantity: number;
}

/**
 * Selección de líneas de la Sales Order — mismo patrón (checkbox +
 * cantidad) que PurchaseRequisitionLinesForm (0069)/GoodsReceiptLinesForm
 * (0070). rpc_create_sales_fulfillment/rpc_update_sales_fulfillment
 * vuelven a resolver el snapshot server-side al guardar. Reutilizado por
 * /surtidos/nuevo (mode="create") y /surtidos/[id]/editar (mode="edit").
 */
export function SalesFulfillmentLinesForm({
  mode,
  salesOrderId,
  fulfillmentId,
  candidates,
  warehouses,
  initialWarehouseId,
  initialDeliveryContact = "",
  initialDeliveryNotes = "",
  initialSelection,
  onSubmit,
}: {
  mode: "create" | "edit";
  salesOrderId: string;
  fulfillmentId?: string;
  candidates: CandidateLine[];
  warehouses: Warehouse[];
  initialWarehouseId?: string;
  initialDeliveryContact?: string;
  initialDeliveryNotes?: string;
  initialSelection?: Record<string, { quantity: number }>;
  onSubmit: (payload: SalesFulfillmentWritePayload) => Promise<SalesFulfillmentActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ?? "");
  const [deliveryContact, setDeliveryContact] = useState(initialDeliveryContact);
  const [deliveryNotes, setDeliveryNotes] = useState(initialDeliveryNotes);
  const [selection, setSelection] = useState<Record<string, SelectedLine>>(() =>
    Object.fromEntries(
      candidates.map((c) => {
        const initial = initialSelection?.[c.salesOrderItemId];
        return [c.salesOrderItemId, { selected: !!initial, quantity: initial?.quantity ?? c.remaining }];
      })
    )
  );

  function toggleLine(id: string, selected: boolean) {
    setSelection((prev) => ({ ...prev, [id]: { selected, quantity: prev[id]?.quantity ?? 1 } }));
  }

  function setQuantity(id: string, quantity: number) {
    setSelection((prev) => ({ ...prev, [id]: { selected: prev[id]?.selected ?? false, quantity } }));
  }

  function handleSubmit() {
    if (!warehouseId) {
      toast.error("Selecciona el almacén de surtido");
      return;
    }
    const selectedLines = candidates.filter((c) => selection[c.salesOrderItemId]?.selected);
    if (selectedLines.length === 0) {
      toast.error("Selecciona al menos una línea");
      return;
    }
    if (selectedLines.some((c) => !((selection[c.salesOrderItemId]?.quantity ?? 0) > 0))) {
      toast.error("La cantidad a surtir de cada línea debe ser mayor a cero");
      return;
    }

    const items: SalesFulfillmentWriteItemPayload[] = selectedLines.map((c) => ({
      sales_order_item_id: c.salesOrderItemId,
      quantity_requested: selection[c.salesOrderItemId]?.quantity ?? 0,
    }));

    startTransition(async () => {
      const result = await onSubmit({
        sales_order_id: salesOrderId,
        warehouse_id: warehouseId,
        delivery_contact: deliveryContact || undefined,
        delivery_notes: deliveryNotes || undefined,
        items,
      });
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
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
          <Label htmlFor="delivery_contact">Contacto de entrega (opcional)</Label>
          <Input id="delivery_contact" value={deliveryContact} onChange={(e) => setDeliveryContact(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="delivery_notes">Notas (opcional)</Label>
        <Textarea id="delivery_notes" rows={2} value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
      </div>

      <div>
        <Label>Líneas de la Sales Order</Label>
        <div className="mt-2 space-y-2">
          {candidates.map((c) => {
            const exhausted = c.remaining <= 0 && !selection[c.salesOrderItemId]?.selected;
            return (
              <div key={c.salesOrderItemId} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30 disabled:opacity-40"
                  checked={selection[c.salesOrderItemId]?.selected ?? false}
                  disabled={exhausted}
                  onChange={(e) => toggleLine(c.salesOrderItemId, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{c.skuSnapshot}</p>
                  {c.descriptionSnapshot && <p className="text-xs text-ink-faint">{c.descriptionSnapshot}</p>}
                  <p className="text-xs text-ink-faint">
                    Vendido: {c.quantity}
                    {c.uomSnapshot ? ` ${c.uomSnapshot}` : ""} · Comprometido en otros surtidos: {c.alreadyCommitted} · Pendiente: {c.remaining}
                  </p>
                  {exhausted && <p className="text-xs text-warning">Esta línea ya está completamente comprometida.</p>}
                </div>
                <div className="w-24 shrink-0">
                  <Label htmlFor={`qty-${c.salesOrderItemId}`} className="text-xs">
                    A surtir
                  </Label>
                  <Input
                    id={`qty-${c.salesOrderItemId}`}
                    type="number"
                    min={1}
                    value={selection[c.salesOrderItemId]?.quantity ?? c.remaining}
                    disabled={!selection[c.salesOrderItemId]?.selected}
                    onChange={(e) => setQuantity(c.salesOrderItemId, Number(e.target.value))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          {mode === "create" ? "Guardar surtido (borrador)" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
