"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteOrder } from "./actions";

export function DeleteButton({ orderId, folio, className }: { orderId: string; folio: string; className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className={className}
      onClick={() => {
        const confirmed = window.confirm(
          `¿Eliminar el pedido ${folio}? Esta acción no se puede deshacer: se eliminarán también sus productos, fotos y archivos adjuntos.`
        );
        if (!confirmed) return;

        startTransition(async () => {
          const result = await deleteOrder(orderId);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`Pedido ${folio} eliminado`);
          router.refresh();
        });
      }}
    >
      {isPending ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
