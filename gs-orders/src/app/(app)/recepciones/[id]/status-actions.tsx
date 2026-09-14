"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GoodsReceiptStatus } from "@/types/domain";
import { postGoodsReceipt, cancelGoodsReceipt } from "../actions";

type ActionKind = "post" | "cancel";

const COPY: Record<ActionKind, { title: (n: string) => string; description: string; confirmVariant: ButtonProps["variant"] }> = {
  post: {
    title: (n) => `¿Postear la recepción ${n}?`,
    description:
      "Genera los movimientos de inventario, actualiza el saldo recibido de la Purchase Order y queda inmutable — ya no podrá editarse ni cancelarse.",
    confirmVariant: "primary",
  },
  cancel: {
    title: (n) => `¿Cancelar la recepción ${n}?`,
    description: "Es un estado terminal: la recepción no admite más cambios. Solo se puede cancelar mientras sigue en borrador.",
    confirmVariant: "danger",
  },
};

/**
 * draft -> posted / cancelled — mismo patrón de diálogo de confirmación
 * que PurchaseRequisitionStatusActions (0069). posted/cancelled son
 * terminales: sin acciones (una recepción posted es inmutable, decisión
 * MVP de 0070 — no se ofrece "revertir"). La autoridad real
 * (can_receive_inventory o admin) la valida el RPC — aquí solo decide qué
 * botones ofrecer.
 */
export function GoodsReceiptStatusActions({
  goodsReceiptId,
  receiptNumber,
  status,
  canReceive,
}: {
  goodsReceiptId: string;
  receiptNumber: string;
  status: GoodsReceiptStatus;
  canReceive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<ActionKind | null>(null);

  if (!canReceive || status !== "draft") {
    return null;
  }

  const actions: { kind: ActionKind; label: string; variant: ButtonProps["variant"] }[] = [
    { kind: "post", label: "Postear recepción", variant: "primary" },
    { kind: "cancel", label: "Cancelar", variant: "danger" },
  ];

  function handleConfirm() {
    if (!pending) return;
    startTransition(async () => {
      const action = pending === "post" ? postGoodsReceipt : cancelGoodsReceipt;
      const result = await action(goodsReceiptId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPending(null);
      toast.success(pending === "post" ? "Recepción posteada" : "Recepción cancelada");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.kind}
            type="button"
            variant={action.variant}
            size="sm"
            disabled={isPending}
            onClick={() => setPending(action.kind)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setPending(null);
        }}
      >
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[pending].title(receiptNumber)}</DialogTitle>
                <DialogDescription>{COPY[pending].description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => setPending(null)}>
                  Volver
                </Button>
                <Button type="button" variant={COPY[pending].confirmVariant} loading={isPending} disabled={isPending} onClick={handleConfirm}>
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
