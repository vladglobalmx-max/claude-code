"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteSalesperson } from "./actions";

/**
 * Ajuste de cierre — eliminación definitiva de vendedores (limpieza
 * inicial). Este componente es puramente presentacional: rpc_delete_salesperson
 * (0079) es la autoridad real y decide si el vendedor puede eliminarse; si
 * tiene referencias reales (Pedidos, Cotizaciones, folio de Cotizaciones,
 * Órdenes de venta, Comisiones, o un usuario "vendedor" ligado) el RPC
 * rechaza la operación con un mensaje que se muestra tal cual.
 */
export function DeleteSalespersonButton({ salespersonId, salespersonName }: { salespersonId: string; salespersonName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteSalesperson(salespersonId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Vendedor ${salespersonName} eliminado.`);
      router.push("/vendedores");
    });
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Eliminar vendedor
      </Button>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar definitivamente este vendedor?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
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
