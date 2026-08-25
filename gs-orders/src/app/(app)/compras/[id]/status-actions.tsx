"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { PURCHASE_ORDER_MANUAL_STATUSES, PURCHASE_ORDER_STATUS_LABELS } from "@/types/domain";
import type { PurchaseOrderStatus } from "@/types/domain";
import { updatePurchaseOrderStatus } from "../actions";

/**
 * THÖREN Fase 6L — transición manual de estado. Solo se ofrecen los
 * PURCHASE_ORDER_MANUAL_STATUSES ('recibida'/'recibida_parcial' los
 * asigna automáticamente la recepción, ver rpc_receive_purchase_order_item)
 * — si la PO ya está en uno de esos dos, se muestra de solo lectura para
 * no invitar un cambio que la RPC igual rechazaría.
 */
export function PurchaseOrderStatusActions({ purchaseOrderId, status }: { purchaseOrderId: string; status: PurchaseOrderStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status === "recibida" || status === "recibida_parcial") {
    return <span className="text-sm text-ink-soft">{PURCHASE_ORDER_STATUS_LABELS[status]} (automático, según recepción)</span>;
  }

  if (status === "cancelada") {
    return <span className="text-sm text-ink-soft">Cancelada (sin más cambios posibles)</span>;
  }

  function handleChange(newStatus: PurchaseOrderStatus) {
    if (newStatus === status) return;
    startTransition(async () => {
      const result = await updatePurchaseOrderStatus(purchaseOrderId, newStatus);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estado actualizado a ${PURCHASE_ORDER_STATUS_LABELS[newStatus]}`);
      router.refresh();
    });
  }

  return (
    <Select
      className="w-auto"
      disabled={isPending}
      value={status}
      onChange={(e) => handleChange(e.target.value as PurchaseOrderStatus)}
    >
      {PURCHASE_ORDER_MANUAL_STATUSES.map((value) => (
        <option key={value} value={value}>
          {PURCHASE_ORDER_STATUS_LABELS[value]}
        </option>
      ))}
    </Select>
  );
}
