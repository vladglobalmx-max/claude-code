"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recalculateOrderProcurement } from "../actions";

/**
 * THÖREN Fase 9 / Block 1 (0064, aclaración GAP 2) — banner visible
 * cuando `orders.procurement_sync_status = 'failed'`. Nunca un
 * console.error silencioso: Ventas/Compras ve explícitamente que la
 * disponibilidad/reserva/necesidad de compra de este Pedido no se pudo
 * calcular, con el motivo y un botón para reintentar (idempotente —
 * puede presionarse las veces que haga falta).
 */
export function ProcurementSyncBanner({
  orderId,
  status,
  error,
}: {
  orderId: string;
  status: "ok" | "failed";
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status !== "failed") return null;

  function handleRetry() {
    startTransition(async () => {
      const result = await recalculateOrderProcurement(orderId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Abastecimiento recalculado");
      router.refresh();
    });
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          No se pudo calcular la disponibilidad/reserva de este Pedido.
          {error && <span className="block text-xs text-danger/80">{error}</span>}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleRetry}>
        Recalcular abastecimiento
      </Button>
    </div>
  );
}
