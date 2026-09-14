"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PurchaseRequisitionActionResult, PurchaseRequisitionWriteItemPayload, PurchaseRequisitionWritePayload } from "@/app/(app)/requisiciones/actions";

export interface CandidateLine {
  salesOrderItemId: string;
  skuSnapshot: string;
  descriptionSnapshot: string | null;
  uomSnapshot: string | null;
  quantity: number;
  /** Ya requisicionado por OTRAS requisiciones activas (nunca incluye las líneas de esta misma requisición en modo "edit" — ver DECISIÓN en editar/page.tsx). */
  alreadyRequisitioned: number;
  remaining: number;
  suggestedSupplierName: string | null;
}

interface SelectedLine {
  selected: boolean;
  quantity: number;
}

/**
 * Selección de líneas de la Sales Order — mismo patrón (checkbox +
 * cantidad) que NewPurchaseOrderForm (/pedidos/[id]/nueva-compra), el
 * flujo análogo ya existente para Pedido → Purchase Order. El proveedor
 * sugerido es solo informativo aquí (preview) —
 * rpc_create_purchase_requisition/rpc_update_purchase_requisition lo
 * vuelven a resolver server-side al guardar, nunca confían en este preview.
 * Reutilizado por /requisiciones/nueva (mode="create") y
 * /requisiciones/[id]/editar (mode="edit").
 */
export function PurchaseRequisitionLinesForm({
  mode,
  salesOrderId,
  requisitionId,
  candidates,
  initialNotes = "",
  initialSelection,
  onSubmit,
}: {
  mode: "create" | "edit";
  salesOrderId: string;
  requisitionId?: string;
  candidates: CandidateLine[];
  initialNotes?: string;
  initialSelection?: Record<string, { quantity: number }>;
  onSubmit: (payload: PurchaseRequisitionWritePayload) => Promise<PurchaseRequisitionActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
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
    const selectedLines = candidates.filter((c) => selection[c.salesOrderItemId]?.selected);
    if (selectedLines.length === 0) {
      toast.error("Selecciona al menos una línea");
      return;
    }
    if (selectedLines.some((c) => !((selection[c.salesOrderItemId]?.quantity ?? 0) > 0))) {
      toast.error("La cantidad requerida de cada línea debe ser mayor a cero");
      return;
    }

    const items: PurchaseRequisitionWriteItemPayload[] = selectedLines.map((c) => ({
      sales_order_item_id: c.salesOrderItemId,
      quantity_required: selection[c.salesOrderItemId]?.quantity ?? 0,
    }));

    startTransition(async () => {
      const result = await onSubmit({ sales_order_id: salesOrderId, notes: notes || undefined, items });
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                    Cantidad en la Sales Order: {c.quantity}
                    {c.uomSnapshot ? ` ${c.uomSnapshot}` : ""} · Requisicionado por otras: {c.alreadyRequisitioned} · Disponible: {c.remaining}
                  </p>
                  {c.suggestedSupplierName && <p className="text-xs text-accent">Proveedor sugerido: {c.suggestedSupplierName}</p>}
                  {exhausted && <p className="text-xs text-warning">Ya está completamente requisicionada.</p>}
                </div>
                <div className="w-24 shrink-0">
                  <Label htmlFor={`qty-${c.salesOrderItemId}`} className="text-xs">
                    A comprar
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
          {mode === "create" ? "Crear requisición de compra" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
