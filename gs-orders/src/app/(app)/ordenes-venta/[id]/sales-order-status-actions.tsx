"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SALES_ORDER_STATUS_LABELS } from "@/types/domain";
import type { SalesOrder, SalesOrderStatus } from "@/types/domain";
import { setSalesOrderStatus } from "../actions";

/**
 * Espejo de las transiciones válidas de trg_sales_order_status_transition
 * (0067_sales_orders_mvp.sql): draft→confirmed|cancelled;
 * confirmed→in_progress|cancelled; in_progress→fulfilled|cancelled;
 * fulfilled→closed; closed/cancelled son terminales. No reimplementa la
 * regla como autoridad — solo ofrece los botones correctos; el trigger en
 * DB sigue siendo quien realmente la impone.
 */
const NEXT_STATUSES: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["fulfilled", "cancelled"],
  fulfilled: ["closed"],
  closed: [],
  cancelled: [],
};

const CONFIRM_COPY: Record<
  Exclude<SalesOrderStatus, "draft">,
  { title: (orderNumber: string) => string; description: string; confirmLabel: string; confirmVariant: ButtonProps["variant"] }
> = {
  confirmed: {
    title: (orderNumber) => `¿Confirmar ${orderNumber}?`,
    description:
      "El contenido comercial y las líneas quedarán congelados a partir de este momento — una edición posterior del catálogo nunca alterará lo ya guardado.",
    confirmLabel: "Confirmar Sales Order",
    confirmVariant: "primary",
  },
  in_progress: {
    title: (orderNumber) => `¿Marcar ${orderNumber} como en proceso?`,
    description: "Indica que la Sales Order ya está siendo atendida operativamente.",
    confirmLabel: "Marcar como en proceso",
    confirmVariant: "primary",
  },
  fulfilled: {
    title: (orderNumber) => `¿Marcar ${orderNumber} como surtida?`,
    description: "Indica que todas las líneas ya fueron surtidas al cliente.",
    confirmLabel: "Marcar como surtida",
    confirmVariant: "primary",
  },
  closed: {
    title: (orderNumber) => `¿Cerrar la Sales Order ${orderNumber}?`,
    description: "Es un estado terminal: la Sales Order quedará de solo lectura.",
    confirmLabel: "Cerrar Sales Order",
    confirmVariant: "primary",
  },
  cancelled: {
    title: (orderNumber) => `¿Cancelar la Sales Order ${orderNumber}?`,
    description:
      "Es un estado terminal: la Sales Order quedará de solo lectura. El número no se libera ni se reutiliza — sigue existiendo en el historial.",
    confirmLabel: "Cancelar Sales Order",
    confirmVariant: "danger",
  },
};

export function SalesOrderStatusActions({ salesOrder }: { salesOrder: SalesOrder }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<SalesOrderStatus | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Exclude<SalesOrderStatus, "draft"> | null>(null);

  const nextStatuses = NEXT_STATUSES[salesOrder.status];
  if (nextStatuses.length === 0) return null;

  function handleConfirm() {
    if (!confirmTarget) return;
    const status = confirmTarget;
    setPendingStatus(status);
    startTransition(async () => {
      const result = await setSalesOrderStatus(salesOrder.id, status);
      setPendingStatus(null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setConfirmTarget(null);
      toast.success(`Estado actualizado a ${SALES_ORDER_STATUS_LABELS[status]}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {nextStatuses.map((status) => (
          <Button
            key={status}
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setConfirmTarget(status as Exclude<SalesOrderStatus, "draft">)}
          >
            {status === "cancelled" ? "Cancelar Sales Order" : `Marcar como ${SALES_ORDER_STATUS_LABELS[status].toLowerCase()}`}
          </Button>
        ))}
      </div>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setConfirmTarget(null);
        }}
      >
        <DialogContent>
          {confirmTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{CONFIRM_COPY[confirmTarget].title(salesOrder.order_number)}</DialogTitle>
                <DialogDescription>{CONFIRM_COPY[confirmTarget].description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirmTarget(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant={CONFIRM_COPY[confirmTarget].confirmVariant}
                  loading={isPending && pendingStatus === confirmTarget}
                  disabled={isPending}
                  onClick={handleConfirm}
                >
                  {CONFIRM_COPY[confirmTarget].confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
