"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { DELIVERY_STATUS_LABELS, DELIVERY_TERMINAL_STATUSES } from "@/types/domain";
import type { DeliveryStatus } from "@/types/domain";
import { updateDeliveryStatus } from "../actions";

const CHANGEABLE_STATUSES: DeliveryStatus[] = ["programada", "en_proceso", "completada", "cancelada"];

/**
 * THÖREN Fase 6P — transición manual de estado. 'completada'/'cancelada'
 * son finales: una vez alcanzados, rpc_update_delivery_status rechaza
 * cualquier cambio posterior — se muestra de solo lectura para no invitar
 * un cambio que la RPC igual rechazaría.
 */
export function DeliveryStatusActions({
  deliveryId,
  orderId,
  status,
}: {
  deliveryId: string;
  orderId: string;
  status: DeliveryStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (DELIVERY_TERMINAL_STATUSES.includes(status)) {
    return <span className="text-sm text-ink-soft">{DELIVERY_STATUS_LABELS[status]} (estado final)</span>;
  }

  function handleChange(newStatus: DeliveryStatus) {
    if (newStatus === status) return;
    startTransition(async () => {
      const result = await updateDeliveryStatus(deliveryId, orderId, newStatus);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estado actualizado a ${DELIVERY_STATUS_LABELS[newStatus]}`);
      router.refresh();
    });
  }

  return (
    <Select className="w-auto" disabled={isPending} value={status} onChange={(e) => handleChange(e.target.value as DeliveryStatus)}>
      {CHANGEABLE_STATUSES.map((value) => (
        <option key={value} value={value}>
          {DELIVERY_STATUS_LABELS[value]}
        </option>
      ))}
    </Select>
  );
}
