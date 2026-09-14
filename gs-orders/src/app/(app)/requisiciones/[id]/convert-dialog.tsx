"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/types/domain";
import { convertPurchaseRequisitionToPurchaseOrder } from "../actions";

export interface ConvertibleLine {
  id: string;
  skuSnapshot: string;
  descriptionSnapshot: string;
  uomSnapshot: string | null;
  remaining: number;
  suggestedSupplierId: string | null;
}

/**
 * rpc_convert_requisition_to_purchase_order (0069) convierte SIEMPRE la
 * cantidad remanente completa de cada línea seleccionada — no admite
 * cantidad parcial por línea (ver convertRequisitionToPurchaseOrderSchema:
 * solo un array de ids). Por eso aquí solo hay checkboxes, sin input de
 * cantidad — a diferencia de PurchaseRequisitionLinesForm.
 */
export function ConvertToPurchaseOrderDialog({
  requisitionId,
  lines,
  suppliers,
}: {
  requisitionId: string;
  lines: ConvertibleLine[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [supplierCommitmentDate, setSupplierCommitmentDate] = useState("");
  const [estimatedReceptionDate, setEstimatedReceptionDate] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setSupplierId("");
    setSelected({});
    setSupplierCommitmentDate("");
    setEstimatedReceptionDate("");
    setSupplierReference("");
    setNotes("");
  }

  function handleSubmit() {
    if (!supplierId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    const requisitionItemIds = lines.filter((l) => selected[l.id]).map((l) => l.id);
    if (requisitionItemIds.length === 0) {
      toast.error("Selecciona al menos una línea para convertir");
      return;
    }

    startTransition(async () => {
      const result = await convertPurchaseRequisitionToPurchaseOrder(requisitionId, {
        supplier_id: supplierId,
        requisition_item_ids: requisitionItemIds,
        supplier_commitment_date: supplierCommitmentDate || undefined,
        estimated_reception_date: estimatedReceptionDate || undefined,
        supplier_reference: supplierReference || undefined,
        notes: notes || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      reset();
      toast.success("Purchase Order creada");
      router.refresh();
    });
  }

  if (lines.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Convertir a Purchase Order
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !isPending) setOpen(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convertir a Purchase Order</DialogTitle>
            <DialogDescription>
              Las líneas seleccionadas se ordenan por su cantidad remanente completa hacia el proveedor elegido. Puedes repetir
              esta acción con otro proveedor para las líneas restantes.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto">
            <div>
              <Label htmlFor="convert-supplier">Proveedor</Label>
              <Select id="convert-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Selecciona un proveedor…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Líneas a convertir</Label>
              <div className="mt-2 space-y-2">
                {lines.map((line) => (
                  <div key={line.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                      checked={selected[line.id] ?? false}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [line.id]: e.target.checked }))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{line.skuSnapshot}</p>
                      <p className="text-xs text-ink-faint">{line.descriptionSnapshot}</p>
                      <p className="text-xs text-ink-faint">
                        A ordenar: {line.remaining}
                        {line.uomSnapshot ? ` ${line.uomSnapshot}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="convert-commitment-date">Fecha compromiso proveedor (opcional)</Label>
                <Input
                  id="convert-commitment-date"
                  type="date"
                  value={supplierCommitmentDate}
                  onChange={(e) => setSupplierCommitmentDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="convert-reception-date">Fecha estimada de recepción (opcional)</Label>
                <Input
                  id="convert-reception-date"
                  type="date"
                  value={estimatedReceptionDate}
                  onChange={(e) => setEstimatedReceptionDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="convert-reference">Referencia/PO del proveedor (opcional)</Label>
                <Input id="convert-reference" value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="convert-notes">Notas (opcional)</Label>
                <Textarea id="convert-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" loading={isPending} disabled={isPending} onClick={handleSubmit}>
              Crear Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
