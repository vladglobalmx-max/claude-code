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
  GoodsReceiptActionResult,
  GoodsReceiptWriteItemPayload,
  GoodsReceiptWritePayload,
} from "@/app/(app)/recepciones/actions";

export interface CandidateLine {
  purchaseOrderItemId: string;
  model: string;
  description: string | null;
  unit: string | null;
  quantityOrdered: number;
  alreadyReceived: number;
  remaining: number;
}

interface SelectedLine {
  selected: boolean;
  quantity: number;
}

/**
 * Selección de partidas de la Purchase Order — mismo patrón (checkbox +
 * cantidad) que PurchaseRequisitionLinesForm (0069)/NewPurchaseOrderForm.
 * rpc_create_goods_receipt/rpc_update_goods_receipt vuelven a resolver el
 * snapshot server-side al guardar, nunca confían en este preview.
 * Reutilizado por /recepciones/nueva (mode="create") y
 * /recepciones/[id]/editar (mode="edit").
 */
export function GoodsReceiptLinesForm({
  mode,
  purchaseOrderId,
  goodsReceiptId,
  candidates,
  warehouses,
  initialWarehouseId,
  initialReceivedAt,
  initialSupplierDocumentNumber = "",
  initialNotes = "",
  initialSelection,
  onSubmit,
}: {
  mode: "create" | "edit";
  purchaseOrderId: string;
  goodsReceiptId?: string;
  candidates: CandidateLine[];
  warehouses: Warehouse[];
  initialWarehouseId?: string;
  initialReceivedAt?: string;
  initialSupplierDocumentNumber?: string;
  initialNotes?: string;
  initialSelection?: Record<string, { quantity: number }>;
  onSubmit: (payload: GoodsReceiptWritePayload) => Promise<GoodsReceiptActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ?? "");
  const [receivedAt, setReceivedAt] = useState(initialReceivedAt ?? new Date().toISOString().slice(0, 10));
  const [supplierDocumentNumber, setSupplierDocumentNumber] = useState(initialSupplierDocumentNumber);
  const [notes, setNotes] = useState(initialNotes);
  const [selection, setSelection] = useState<Record<string, SelectedLine>>(() =>
    Object.fromEntries(
      candidates.map((c) => {
        const initial = initialSelection?.[c.purchaseOrderItemId];
        return [c.purchaseOrderItemId, { selected: !!initial, quantity: initial?.quantity ?? c.remaining }];
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
      toast.error("Selecciona el almacén de recepción");
      return;
    }
    const selectedLines = candidates.filter((c) => selection[c.purchaseOrderItemId]?.selected);
    if (selectedLines.length === 0) {
      toast.error("Selecciona al menos una línea");
      return;
    }
    if (selectedLines.some((c) => !((selection[c.purchaseOrderItemId]?.quantity ?? 0) > 0))) {
      toast.error("La cantidad a recibir de cada línea debe ser mayor a cero");
      return;
    }

    const items: GoodsReceiptWriteItemPayload[] = selectedLines.map((c) => ({
      purchase_order_item_id: c.purchaseOrderItemId,
      quantity_received: selection[c.purchaseOrderItemId]?.quantity ?? 0,
    }));

    startTransition(async () => {
      const result = await onSubmit({
        purchase_order_id: purchaseOrderId,
        warehouse_id: warehouseId,
        received_at: receivedAt || undefined,
        supplier_document_number: supplierDocumentNumber || undefined,
        notes: notes || undefined,
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
          <Label htmlFor="received_at">Fecha de recepción</Label>
          <Input id="received_at" type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="supplier_document_number">Documento del proveedor (opcional)</Label>
          <Input
            id="supplier_document_number"
            value={supplierDocumentNumber}
            onChange={(e) => setSupplierDocumentNumber(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div>
        <Label>Partidas pendientes de la Purchase Order</Label>
        <div className="mt-2 space-y-2">
          {candidates.map((c) => {
            const exhausted = c.remaining <= 0 && !selection[c.purchaseOrderItemId]?.selected;
            return (
              <div key={c.purchaseOrderItemId} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30 disabled:opacity-40"
                  checked={selection[c.purchaseOrderItemId]?.selected ?? false}
                  disabled={exhausted}
                  onChange={(e) => toggleLine(c.purchaseOrderItemId, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{c.model}</p>
                  {c.description && <p className="text-xs text-ink-faint">{c.description}</p>}
                  <p className="text-xs text-ink-faint">
                    Ordenado: {c.quantityOrdered}
                    {c.unit ? ` ${c.unit}` : ""} · Recibido: {c.alreadyReceived} · Pendiente: {c.remaining}
                  </p>
                  {exhausted && <p className="text-xs text-warning">Esta partida ya está completamente recibida.</p>}
                </div>
                <div className="w-24 shrink-0">
                  <Label htmlFor={`qty-${c.purchaseOrderItemId}`} className="text-xs">
                    A recibir
                  </Label>
                  <Input
                    id={`qty-${c.purchaseOrderItemId}`}
                    type="number"
                    min={1}
                    value={selection[c.purchaseOrderItemId]?.quantity ?? c.remaining}
                    disabled={!selection[c.purchaseOrderItemId]?.selected}
                    onChange={(e) => setQuantity(c.purchaseOrderItemId, Number(e.target.value))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          {mode === "create" ? "Guardar recepción (borrador)" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
