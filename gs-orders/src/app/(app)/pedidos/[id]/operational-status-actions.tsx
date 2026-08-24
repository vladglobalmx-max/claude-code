"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { ORDER_OPERATIONAL_STATUS_LABELS } from "@/types/domain";
import type { Order, OrderOperationalStatus } from "@/types/domain";
import { setOrderOperationalStatus } from "../actions";

/**
 * Cambia el seguimiento operativo del pedido (THÖREN Fase 6H) — mismo
 * patrón que OrderStatusQuickActions (status-quick-actions.tsx): Select
 * libre entre los 8 valores, sin diálogo de confirmación (es una
 * herramienta de seguimiento de uso frecuente, no un documento legal con
 * estados terminales como Quotes). El historial (quién/cuándo) lo registra
 * automáticamente un trigger en la base de datos — este componente no
 * escribe historial, solo cambia el valor actual.
 */
export function OrderOperationalStatusActions({ order }: { order: Order }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(status: OrderOperationalStatus) {
    if (status === order.operational_status) return;
    startTransition(async () => {
      const result = await setOrderOperationalStatus(order.id, status);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Seguimiento actualizado a ${ORDER_OPERATIONAL_STATUS_LABELS[status]}`);
      router.refresh();
    });
  }

  return (
    <Select
      className="w-auto"
      disabled={isPending}
      value={order.operational_status}
      onChange={(e) => handleChange(e.target.value as OrderOperationalStatus)}
    >
      {Object.entries(ORDER_OPERATIONAL_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
