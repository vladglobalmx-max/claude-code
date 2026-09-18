"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deletePurchaseOrder } from "../actions";

/**
 * THÖREN — Eliminación segura de Orden de Compra (0082). Botón visible
 * solo cuando la página ya decidió mostrarlo (status borrador/cancelada +
 * autoridad, ver compras/[id]/page.tsx) — la autoridad real y las 3
 * validaciones de negocio (sin goods_receipts/quantity_received/
 * inventory_movements) las decide rpc_delete_purchase_order; este botón
 * solo evita ofrecer una acción que fallaría, igual que el resto de
 * acciones de esta página. Confirmación explícita obligatoria (mismo
 * patrón que PurchaseOrderStatusActions) — nunca borra de un solo clic.
 */
export function DeletePurchaseOrderButton({ purchaseOrderId, folio }: { purchaseOrderId: string; folio: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deletePurchaseOrder(purchaseOrderId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      // Sin error: deletePurchaseOrder ya redirige a /compras server-side.
    });
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar Orden de Compra
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isPending) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar la Orden de Compra {folio}?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán el encabezado y todas sus partidas de forma permanente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={handleConfirm}>
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
