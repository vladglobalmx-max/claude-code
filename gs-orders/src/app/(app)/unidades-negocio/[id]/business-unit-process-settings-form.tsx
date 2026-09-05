"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateBusinessUnitProcessSettings } from "./actions";

/**
 * THÖREN 8D (gap final) — requisitos CORE de esta Business Unit antes de
 * "Pedido" (0062_business_unit_process_settings.sql). Hoy solo Proveedor;
 * diseñado para agregar más checkboxes CORE aquí sin rediseñar la pantalla.
 */
export function BusinessUnitProcessSettingsForm({
  businessUnitId,
  initialRequireSupplierBeforeOrder,
  canEdit,
}: {
  businessUnitId: string;
  initialRequireSupplierBeforeOrder: boolean;
  canEdit: boolean;
}) {
  const [requireSupplier, setRequireSupplier] = useState(initialRequireSupplierBeforeOrder);
  const [isPending, startTransition] = useTransition();

  const dirty = requireSupplier !== initialRequireSupplierBeforeOrder;

  function handleSave() {
    startTransition(async () => {
      const result = await updateBusinessUnitProcessSettings(businessUnitId, {
        requireSupplierBeforeOrder: requireSupplier,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados");
    });
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-ink">
        {initialRequireSupplierBeforeOrder
          ? "Requiere Proveedor antes de convertir a Pedido."
          : "No requiere Proveedor antes de convertir a Pedido."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={requireSupplier}
          onChange={(e) => setRequireSupplier(e.target.checked)}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        />
        Requerir proveedor antes de convertir a Pedido
      </label>
      <Button type="button" size="sm" loading={isPending} disabled={isPending || !dirty} onClick={handleSave}>
        Guardar cambios
      </Button>
    </div>
  );
}
