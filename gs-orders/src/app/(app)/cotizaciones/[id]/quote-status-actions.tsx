"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QUOTE_STATUS_LABELS } from "@/types/domain";
import type { Quote, QuoteStatus } from "@/types/domain";
import { setQuoteStatus } from "../actions";

/**
 * Espejo de las transiciones válidas de trg_quote_status_transition
 * (0020_core_quotes.sql): borrador→enviada|cancelada;
 * enviada→aceptada|rechazada|cancelada; el resto son terminales. No
 * reimplementa la regla como autoridad — solo ofrece los botones
 * correctos; el trigger en DB sigue siendo quien realmente la impone.
 */
const NEXT_STATUSES: Record<QuoteStatus, QuoteStatus[]> = {
  borrador: ["enviada", "cancelada"],
  enviada: ["aceptada", "rechazada", "cancelada"],
  aceptada: [],
  rechazada: [],
  cancelada: [],
};

const CONFIRM_COPY: Record<
  Exclude<QuoteStatus, "borrador">,
  { title: (folio: string) => string; description: string; confirmLabel: string; confirmVariant: ButtonProps["variant"] }
> = {
  enviada: {
    title: (folio) => `¿Marcar ${folio} como enviada?`,
    description:
      "A partir de este momento la cotización se considera notificada al cliente. Después podrás marcarla como aceptada, rechazada o cancelarla.",
    confirmLabel: "Marcar como enviada",
    confirmVariant: "primary",
  },
  aceptada: {
    title: (folio) => `¿Marcar ${folio} como aceptada?`,
    description:
      "Es un estado terminal: la cotización quedará de solo lectura y ya no podrá volver a editarse ni cambiar de estado.",
    confirmLabel: "Marcar como aceptada",
    confirmVariant: "primary",
  },
  rechazada: {
    title: (folio) => `¿Marcar ${folio} como rechazada?`,
    description:
      "Es un estado terminal: la cotización quedará de solo lectura y ya no podrá volver a editarse ni cambiar de estado.",
    confirmLabel: "Marcar como rechazada",
    confirmVariant: "primary",
  },
  cancelada: {
    title: (folio) => `¿Cancelar la cotización ${folio}?`,
    description:
      "Es un estado terminal: la cotización quedará de solo lectura. El folio no se libera ni se reutiliza — sigue existiendo en el historial.",
    confirmLabel: "Cancelar cotización",
    confirmVariant: "danger",
  },
};

export function QuoteStatusActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<QuoteStatus | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Exclude<QuoteStatus, "borrador"> | null>(null);

  const nextStatuses = NEXT_STATUSES[quote.status];
  if (nextStatuses.length === 0) return null;

  function handleConfirm() {
    if (!confirmTarget) return;
    const status = confirmTarget;
    setPendingStatus(status);
    startTransition(async () => {
      const result = await setQuoteStatus(quote.id, status);
      setPendingStatus(null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setConfirmTarget(null);
      toast.success(`Estado actualizado a ${QUOTE_STATUS_LABELS[status]}`);
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
            onClick={() => setConfirmTarget(status as Exclude<QuoteStatus, "borrador">)}
          >
            {status === "cancelada" ? "Cancelar cotización" : `Marcar como ${QUOTE_STATUS_LABELS[status].toLowerCase()}`}
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
                <DialogTitle>{CONFIRM_COPY[confirmTarget].title(quote.folio)}</DialogTitle>
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
