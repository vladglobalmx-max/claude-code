"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { purgeTestSalesOrder } from "../actions";

/**
 * THÖREN 0077 — solo se renderiza cuando el llamador ya confirmó
 * salesOrder.is_test=true y canPurgeTestOperations(profile, capabilities)
 * (ver ordenes-venta/[id]/page.tsx) — este componente NO repite esas
 * comprobaciones, es puramente presentacional; rpc_purge_test_sales_order
 * es la autoridad real y las repite de todos modos en DB.
 */
export function PurgeTestSalesOrderButton({ salesOrderId, orderNumber }: { salesOrderId: string; orderNumber: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await purgeTestSalesOrder(salesOrderId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Operación de prueba ${result.orderNumber ?? orderNumber} eliminada`);
      router.push("/ordenes-venta");
    });
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Eliminar operación de prueba
      </Button>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar la operación de prueba {orderNumber}?</DialogTitle>
            <DialogDescription>
              Se eliminará PERMANENTEMENTE esta Sales Order y toda su cadena derivada: requisición de compra, Purchase
              Order, recepción de mercancía, movimientos de inventario, surtido, factura, pagos y comisión. Inventario y
              demás agregados quedarán exactamente como si esta prueba nunca hubiera existido. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={handleConfirm}>
              Eliminar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
