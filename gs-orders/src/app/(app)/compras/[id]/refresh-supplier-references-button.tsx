"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshPurchaseOrderSupplierReferences } from "../actions";

/**
 * THÖREN 0074 — fix puntual: para una Purchase Order originada en
 * Requisición (sin "Reemplazar partidas" disponible, ver DECISIÓN en
 * page.tsx), este botón es la única vía para corregir un snapshot de
 * proveedor vacío después de agregar la referencia en Catálogo. Solo
 * toca los 4 campos de snapshot — nunca cantidades/líneas/proveedor.
 * `router.refresh()` vuelve a leer el server component: el aviso de
 * "falta referencia" desaparece solo si la referencia ahora resuelve
 * (missingReferenceCount se recalcula en el propio page.tsx).
 */
export function RefreshSupplierReferencesButton({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshPurchaseOrderSupplierReferences(purchaseOrderId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Referencias de proveedor actualizadas");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" loading={isPending} disabled={isPending} onClick={handleClick}>
      <RefreshCw className="h-3.5 w-3.5" />
      Actualizar referencias de proveedor
    </Button>
  );
}
