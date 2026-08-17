"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicateQuote } from "../actions";

/**
 * Disponible desde cualquier Quote visible (incluidas aceptada/rechazada/
 * cancelada — "cotizar de nuevo" es un caso de uso legítimo sobre una
 * histórica). RLS decide qué Quotes puede ver/duplicar cada usuario — sin
 * guard de rol adicional aquí. Sin Dialog de confirmación: crear una Quote
 * nueva no es destructivo (a diferencia de las transiciones de status en
 * QuoteStatusActions), mismo criterio que DuplicateButton de Orders.
 */
export function DuplicateQuoteButton({ quoteId }: { quoteId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await duplicateQuote(quoteId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" loading={isPending} disabled={isPending} onClick={handleClick}>
      <Copy className="h-3.5 w-3.5" />
      Duplicar
    </Button>
  );
}
