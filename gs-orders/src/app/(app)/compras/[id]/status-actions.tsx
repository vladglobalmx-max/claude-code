"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrderStatus } from "@/types/domain";
import { updatePurchaseOrderStatus } from "../actions";

/**
 * THÖREN 6R.1B-3B — reemplaza el <select> plano de las 5 opciones
 * (Fase 6L/2A) por acciones explícitas que separan PREPARACIÓN (cancelar
 * un borrador) de AUTORIZACIÓN (sacarla de borrador y administrar el
 * ciclo posterior) — mismas dos autoridades de 0045
 * (can_prepare_purchase_orders / can_approve_purchase_orders, ver
 * src/lib/auth/purchase-orders.ts). El backend
 * (rpc_update_purchase_order_status) sigue siendo la autoridad final;
 * esto solo decide qué botones OFRECER.
 *
 * Preferencia de flujo (enunciado 3B §6): desde borrador solo se ofrece
 * "Autorizar y ordenar" (-> 'ordenada'), nunca confirmada/en_transito
 * directo — esos se administran DESPUÉS, secuencialmente
 * (ordenada -> confirmada -> en_transito). 'borrador' nunca es un destino
 * ofrecido (0045 lo prohíbe para siempre); 'recibida'/'recibida_parcial'
 * son automáticos (recepción) y aquí se tratan como terminales para
 * acciones manuales — revertir una PO ya recibida necesitaría lógica de
 * reversión de inventario que no existe, fuera de alcance de 3B.
 */
const ADVANCE_SEQUENCE: Partial<Record<PurchaseOrderStatus, { next: PurchaseOrderStatus; label: string }>> = {
  ordenada: { next: "confirmada", label: "Marcar como confirmada" },
  confirmada: { next: "en_transito", label: "Marcar en tránsito" },
};

type ActionKind = "authorize" | "advance" | "cancel";

interface PendingAction {
  kind: ActionKind;
  target: PurchaseOrderStatus;
}

const COPY: Record<
  ActionKind,
  { title: (folio: string) => string; description: string; confirmVariant: ButtonProps["variant"] }
> = {
  authorize: {
    title: (folio) => `¿Autorizar y ordenar ${folio}?`,
    description:
      "La Purchase Order sale de preparación y se considera comprometida con el proveedor. A partir de aquí, solo quien tenga autoridad de aprobación podrá administrar su estado — quien la preparó ya no podrá editarla ni cancelarla.",
    confirmVariant: "primary",
  },
  advance: {
    title: (folio) => `¿Actualizar el estado de ${folio}?`,
    description: "Refleja el avance real de la orden con el proveedor.",
    confirmVariant: "primary",
  },
  cancel: {
    title: (folio) => `¿Cancelar la Purchase Order ${folio}?`,
    description: "Es un estado terminal: la Purchase Order no admite más cambios.",
    confirmVariant: "danger",
  },
};

export function PurchaseOrderStatusActions({
  purchaseOrderId,
  folio,
  status,
  canPrepare,
  canApprove,
}: {
  purchaseOrderId: string;
  folio: string;
  status: PurchaseOrderStatus;
  canPrepare: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<PendingAction | null>(null);

  if (status === "cancelada" || status === "recibida" || status === "recibida_parcial") {
    return null;
  }

  const canCancel = status === "borrador" ? canPrepare || canApprove : canApprove;
  const advance = ADVANCE_SEQUENCE[status];

  const actions: { kind: ActionKind; target: PurchaseOrderStatus; label: string; variant: ButtonProps["variant"] }[] = [];

  if (status === "borrador" && canApprove) {
    actions.push({ kind: "authorize", target: "ordenada", label: "Autorizar y ordenar", variant: "primary" });
  }
  if (advance && canApprove) {
    actions.push({ kind: "advance", target: advance.next, label: advance.label, variant: "outline" });
  }
  if (canCancel) {
    actions.push({ kind: "cancel", target: "cancelada", label: "Cancelar", variant: "danger" });
  }

  if (actions.length === 0) return null;

  function handleConfirm() {
    if (!pending) return;
    const { target } = pending;
    startTransition(async () => {
      const result = await updatePurchaseOrderStatus(purchaseOrderId, target);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setPending(null);
      toast.success(`Estado actualizado a ${PURCHASE_ORDER_STATUS_LABELS[target]}`);
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
            onClick={() => setPending({ kind: action.kind, target: action.target })}
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
                <DialogTitle>{COPY[pending.kind].title(folio)}</DialogTitle>
                <DialogDescription>{COPY[pending.kind].description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => setPending(null)}>
                  Volver
                </Button>
                <Button
                  type="button"
                  variant={COPY[pending.kind].confirmVariant}
                  loading={isPending}
                  disabled={isPending}
                  onClick={handleConfirm}
                >
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
