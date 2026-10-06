"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertQuoteToSalesOrder } from "../actions";

/**
 * THÖREN Ticket E1 — conversión directa Cotización aceptada -> Pedido
 * oficial (sales_orders), un solo clic (sin pantalla intermedia: el RPC
 * B1 no necesita ningún dato adicional de la app). Mismo patrón que
 * DuplicateQuoteButton — sin Dialog de confirmación, rpc_create_sales_order_from_quote
 * (SECURITY INVOKER) es la única autoridad real; si falla por cualquiera
 * de sus protecciones (no aceptada, ya convertida, conflicto con order
 * legado, descuento global), el error del RPC se muestra tal cual.
 */
export function ConvertToSalesOrderButton({ quoteId }: { quoteId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await convertQuoteToSalesOrder(quoteId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="primary" size="sm" loading={isPending} disabled={isPending} onClick={handleClick}>
      Convertir a Pedido
      <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  );
}
