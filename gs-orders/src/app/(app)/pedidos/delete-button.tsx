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
import { deleteOrder } from "./actions";

export function DeleteButton({
  orderId,
  folio,
  className,
  children,
  ...triggerProps
}: {
  orderId: string;
  folio: string;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "onClick" | "type" | "disabled">) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`Pedido ${folio} eliminado`);
      router.refresh();
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
          <DialogTitle>Eliminar pedido {folio}</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer: se eliminarán también sus productos, fotos y archivos adjuntos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={confirmDelete}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
