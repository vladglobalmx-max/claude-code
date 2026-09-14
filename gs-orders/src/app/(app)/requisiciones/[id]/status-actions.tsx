"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PurchaseRequisitionStatus } from "@/types/domain";
import { submitPurchaseRequisition, cancelPurchaseRequisition } from "../actions";

type ActionKind = "submit" | "cancel";

const COPY: Record<ActionKind, { title: (n: string) => string; description: string; confirmVariant: ButtonProps["variant"] }> = {
  submit: {
    title: (n) => `¿Enviar la requisición ${n}?`,
    description: "Deja de ser editable en borrador. Podrá convertirse en Purchase Order a partir de este momento.",
    confirmVariant: "primary",
  },
  cancel: {
    title: (n) => `¿Cancelar la requisición ${n}?`,
    description: "Es un estado terminal: la requisición no admite más cambios ni conversión a Purchase Order.",
    confirmVariant: "danger",
  },
};

/**
 * draft -> submitted / cancelled y submitted|partially_ordered -> cancelled
 * — mismo patrón de diálogo de confirmación que PurchaseOrderStatusActions
 * (compras/[id]/status-actions.tsx). ordered/cancelled son terminales: sin
 * acciones. La autoridad real (can_prepare_purchase_orders o admin) la
 * valida el RPC — aquí solo decide qué botones ofrecer.
 */
export function PurchaseRequisitionStatusActions({
  requisitionId,
  requisitionNumber,
  status,
  canPrepare,
}: {
  requisitionId: string;
  requisitionNumber: string;
  status: PurchaseRequisitionStatus;
  canPrepare: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<ActionKind | null>(null);

  if (!canPrepare || status === "ordered" || status === "cancelled") {
    return null;
  }

  const actions: { kind: ActionKind; label: string; variant: ButtonProps["variant"] }[] = [];
  if (status === "draft") {
    actions.push({ kind: "submit", label: "Enviar requisición", variant: "primary" });
  }
  actions.push({ kind: "cancel", label: "Cancelar", variant: "danger" });

  function handleConfirm() {
    if (!pending) return;
    startTransition(async () => {
      const action = pending === "submit" ? submitPurchaseRequisition : cancelPurchaseRequisition;
      const result = await action(requisitionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPending(null);
      toast.success(pending === "submit" ? "Requisición enviada" : "Requisición cancelada");
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
                <DialogTitle>{COPY[pending].title(requisitionNumber)}</DialogTitle>
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
