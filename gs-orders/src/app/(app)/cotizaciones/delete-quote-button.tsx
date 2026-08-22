"use client";

import { useState, useTransition, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteQuote } from "./actions";

/**
 * Confirmación de eliminación de Quote (THÖREN Eliminación de
 * Cotizaciones) — mismo patrón exacto que DeleteButton de Pedidos
 * (pedidos/delete-button.tsx): Dialog de Radix, nunca window.confirm.
 * `redirectAfterDelete` se usa desde el detalle (la página deja de
 * existir tras eliminar); desde el listado se omite y solo se refresca.
 */
export function DeleteQuoteButton({
  quoteId,
  folio,
  customerName,
  className,
  children,
  redirectAfterDelete = false,
  ...triggerProps
}: {
  quoteId: string;
  folio: string;
  customerName: string;
  className?: string;
  children?: ReactNode;
  redirectAfterDelete?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "onClick" | "type" | "disabled">) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteQuote(quoteId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Cotización ${folio} eliminada`);
      if (redirectAfterDelete) {
        router.push("/cotizaciones");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" disabled={isPending} className={className} {...triggerProps}>
          {children ?? (isPending ? "Eliminando…" : "Eliminar")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar cotización</DialogTitle>
          <DialogDescription>
            ¿Quieres eliminar permanentemente la cotización {folio} de {customerName}? Esta acción no se puede
            deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={confirmDelete}>
            Eliminar cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
