"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { ORDER_STATUS_LABELS } from "@/types/domain";
import type { Order, OrderStatus } from "@/types/domain";
import { setOrderStatus } from "../actions";

export function OrderStatusQuickActions({ order }: { order: Order }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(status: OrderStatus) {
    if (status === order.status) return;
    startTransition(async () => {
      const result = await setOrderStatus(order.id, status);
      if (result?.error) {
        toast.error(result.error, {
          description: result.missingFields?.join(", "),
        });
        return;
      }
      toast.success(`Estado actualizado a ${ORDER_STATUS_LABELS[status]}`);
      router.refresh();
    });
  }

  return (
    <Select
      className="w-auto"
      disabled={isPending}
      value={order.status}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
    >
      {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
