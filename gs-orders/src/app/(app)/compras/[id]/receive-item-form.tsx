"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PURCHASE_ORDER_RECEIVABLE_STATUSES } from "@/types/domain";
import type { PurchaseOrderStatus } from "@/types/domain";
import { receivePurchaseOrderItem } from "../actions";

/**
 * THÖREN Fase 6L §4 — registra la cantidad recibida ACUMULADA (no un
 * delta) de una partida. Deshabilitado en 'borrador' (aún no se ordenó al
 * proveedor) y en 'cancelada' (terminal) — mismo guard que
 * rpc_receive_purchase_order_item, para no ofrecer una acción que la RPC
 * igual rechazaría.
 */
export function ReceiveItemForm({
  purchaseOrderId,
  purchaseOrderItemId,
  quantityOrdered,
  quantityReceived,
  status,
}: {
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  status: PurchaseOrderStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(quantityReceived);
  const canReceive = PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(status);

  if (!canReceive) {
    return <span className="text-xs text-ink-faint">—</span>;
  }

  function handleSave() {
    if (value < 0 || value > quantityOrdered) {
      toast.error(`La cantidad recibida debe estar entre 0 y ${quantityOrdered}`);
      return;
    }
    startTransition(async () => {
      const result = await receivePurchaseOrderItem(purchaseOrderItemId, purchaseOrderId, value);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recepción registrada");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={quantityOrdered}
        className="h-8 w-20"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleSave}>
        Registrar
      </Button>
    </div>
  );
}
