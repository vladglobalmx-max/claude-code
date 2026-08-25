"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PurchaseOrder } from "@/types/domain";
import { updatePurchaseOrderDetails } from "../actions";

/**
 * THÖREN Fase 6L — edita solo los campos operativos de cabecera
 * (fechas/referencia/notas). folio/proveedor/Pedido origen son inmutables
 * (no se editan aquí); el estado se cambia con PurchaseOrderStatusActions.
 */
export function PurchaseOrderDetailsForm({ purchaseOrderId, purchaseOrder }: { purchaseOrderId: string; purchaseOrder: PurchaseOrder }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isCancelled = purchaseOrder.status === "cancelada";
  const [supplierCommitmentDate, setSupplierCommitmentDate] = useState(purchaseOrder.supplier_commitment_date ?? "");
  const [estimatedReceptionDate, setEstimatedReceptionDate] = useState(purchaseOrder.estimated_reception_date ?? "");
  const [supplierReference, setSupplierReference] = useState(purchaseOrder.supplier_reference ?? "");
  const [notes, setNotes] = useState(purchaseOrder.notes ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updatePurchaseOrderDetails(purchaseOrderId, {
        supplier_commitment_date: supplierCommitmentDate || undefined,
        estimated_reception_date: estimatedReceptionDate || undefined,
        supplier_reference: supplierReference || undefined,
        notes: notes || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="supplier_commitment_date">Fecha compromiso proveedor</Label>
          <Input
            id="supplier_commitment_date"
            type="date"
            disabled={isCancelled}
            value={supplierCommitmentDate}
            onChange={(e) => setSupplierCommitmentDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="estimated_reception_date">Fecha estimada de recepción</Label>
          <Input
            id="estimated_reception_date"
            type="date"
            disabled={isCancelled}
            value={estimatedReceptionDate}
            onChange={(e) => setEstimatedReceptionDate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="supplier_reference">Referencia/PO del proveedor</Label>
          <Input id="supplier_reference" disabled={isCancelled} value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} disabled={isCancelled} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {!isCancelled && (
        <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleSave}>
          Guardar cambios
        </Button>
      )}
    </div>
  );
}
