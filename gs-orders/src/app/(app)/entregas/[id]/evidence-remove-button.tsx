"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeDeliveryFile } from "../actions";

export function EvidenceRemoveButton({ fileId, deliveryId, orderId }: { fileId: string; deliveryId: string; orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeDeliveryFile(fileId, deliveryId, orderId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleRemove}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-danger/10 hover:text-danger disabled:opacity-60"
      aria-label="Eliminar evidencia"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
