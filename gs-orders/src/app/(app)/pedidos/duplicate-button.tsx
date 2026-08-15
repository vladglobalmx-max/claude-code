"use client";

import { useTransition, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { duplicateOrder } from "./actions";

export function DuplicateButton({
  orderId,
  className,
  children,
  ...rest
}: {
  orderId: string;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "onClick" | "type" | "disabled">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className={className}
      {...rest}
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
      {children ?? (isPending ? "Duplicando…" : "Duplicar")}
    </button>
  );
}
