"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function QuoteStatusActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const nextStatuses = NEXT_STATUSES[quote.status];
  if (nextStatuses.length === 0) return null;

  function handleChange(status: QuoteStatus) {
    startTransition(async () => {
      const result = await setQuoteStatus(quote.id, status);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estado actualizado a ${QUOTE_STATUS_LABELS[status]}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStatuses.map((status) => (
        <Button
          key={status}
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleChange(status)}
        >
          Marcar como {QUOTE_STATUS_LABELS[status].toLowerCase()}
        </Button>
      ))}
    </div>
  );
}
