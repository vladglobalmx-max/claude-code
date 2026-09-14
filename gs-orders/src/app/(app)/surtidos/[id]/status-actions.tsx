"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { SalesFulfillmentStatus } from "@/types/domain";
import { markSalesFulfillmentReady, dispatchSalesFulfillment, markSalesFulfillmentDelivered, cancelSalesFulfillment } from "../actions";

type ActionKind = "ready" | "dispatch" | "deliver" | "cancel";

const COPY: Record<ActionKind, { title: (n: string) => string; description: string; confirmVariant: ButtonProps["variant"] }> = {
  ready: {
    title: (n) => `¿Marcar ${n} como lista para despachar?`,
    description: "Confirma que el picking/packing de este surtido está completo. Todavía NO afecta inventario.",
    confirmVariant: "primary",
  },
  dispatch: {
    title: (n) => `¿Despachar ${n}?`,
    description:
      "Genera la salida física de inventario (movimientos OUT), valida existencia disponible y actualiza el surtido de la Sales Order. Queda inmutable salvo notas — ya no podrá editarse ni cancelarse.",
    confirmVariant: "primary",
  },
  deliver: {
    title: (n) => `¿Marcar ${n} como entregado?`,
    description: "Registra la entrega al cliente (fecha, usuario y notas). Es el paso final del surtido.",
    confirmVariant: "primary",
  },
  cancel: {
    title: (n) => `¿Cancelar el surtido ${n}?`,
    description: "Es un estado terminal: el surtido no admite más cambios. Solo se puede cancelar mientras sigue en borrador.",
    confirmVariant: "danger",
  },
};

/**
 * draft -> ready -> shipped -> delivered, con cancelar SOLO desde draft
 * (ver DECISIÓN en 0071_sales_fulfillment_mvp.sql). La autoridad real
 * (can_manage_sales_fulfillment o admin) la valida el RPC — aquí solo
 * decide qué botones ofrecer.
 */
export function SalesFulfillmentStatusActions({
  fulfillmentId,
  fulfillmentNumber,
  status,
  canManage,
}: {
  fulfillmentId: string;
  fulfillmentNumber: string;
  status: SalesFulfillmentStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  if (!canManage || status === "delivered" || status === "cancelled") {
    return null;
  }

  const actions: { kind: ActionKind; label: string; variant: ButtonProps["variant"] }[] = [];
  if (status === "draft") {
    actions.push({ kind: "ready", label: "Marcar lista para despachar", variant: "primary" });
    actions.push({ kind: "cancel", label: "Cancelar", variant: "danger" });
  } else if (status === "ready") {
    actions.push({ kind: "dispatch", label: "Despachar", variant: "primary" });
  } else if (status === "shipped") {
    actions.push({ kind: "deliver", label: "Marcar como entregado", variant: "primary" });
  }

  if (actions.length === 0) return null;

  function handleConfirm() {
    if (!pending) return;
    startTransition(async () => {
      let result;
      if (pending === "ready") result = await markSalesFulfillmentReady(fulfillmentId);
      else if (pending === "dispatch") result = await dispatchSalesFulfillment(fulfillmentId);
      else if (pending === "deliver") result = await markSalesFulfillmentDelivered(fulfillmentId, deliveryNotes || undefined);
      else result = await cancelSalesFulfillment(fulfillmentId);

      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPending(null);
      setDeliveryNotes("");
      toast.success("Surtido actualizado");
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
          if (!open && !isPending) {
            setPending(null);
            setDeliveryNotes("");
          }
        }}
      >
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[pending].title(fulfillmentNumber)}</DialogTitle>
                <DialogDescription>{COPY[pending].description}</DialogDescription>
              </DialogHeader>
              {pending === "deliver" && (
                <div>
                  <Label htmlFor="delivery-evidence-notes">Notas / evidencia de entrega (opcional)</Label>
                  <Textarea
                    id="delivery-evidence-notes"
                    rows={3}
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Quién recibió, observaciones, etc."
                  />
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setPending(null);
                    setDeliveryNotes("");
                  }}
                >
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
