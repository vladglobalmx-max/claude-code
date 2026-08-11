"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { duplicateOrder } from "./actions";

export function DuplicateButton({ orderId, className }: { orderId: string; className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          try {
            const { id } = await duplicateOrder(orderId);
            toast.success("Pedido duplicado");
            router.push(`/pedidos/${id}`);
          } catch {
            toast.error("No se pudo duplicar el pedido");
          }
        })
      }
    >
      {isPending ? "Duplicando…" : "Duplicar"}
    </button>
  );
}
