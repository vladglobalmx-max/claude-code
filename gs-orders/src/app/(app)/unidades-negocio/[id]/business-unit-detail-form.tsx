"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBusinessUnitDetails } from "./actions";

/**
 * Nombre + Activo — únicos campos editables de una Business Unit (THÖREN
 * Business Unit Branding, 0024). code nunca se pasa como input: es
 * inmutable (RLS + trigger trg_business_units_prevent_org_code_change) y
 * se muestra aparte, en la página, como texto plano.
 */
export function BusinessUnitDetailForm({
  businessUnitId,
  initialName,
  code,
  initialActive,
  canEdit,
}: {
  businessUnitId: string;
  initialName: string;
  code: string;
  initialActive: boolean;
  canEdit: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [active, setActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();

  const dirty = name !== initialName || active !== initialActive;

  function handleSave() {
    startTransition(async () => {
      const result = await updateBusinessUnitDetails(businessUnitId, { name, active });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados");
    });
  }

  if (!canEdit) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Nombre</p>
          <p className="mt-1 text-sm text-ink">{initialName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Código</p>
          <p className="mt-1 font-mono text-sm text-ink">{code}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint">Estado</p>
          <p className="mt-1 text-sm text-ink">{initialActive ? "Activo" : "Inactivo"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="bu-name">Nombre</Label>
          <Input id="bu-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Código</Label>
          <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm text-ink-soft">
            {code}
          </p>
        </div>
        <div>
          <Label htmlFor="bu-active">Estado</Label>
          <label className="flex h-9 items-center gap-2 text-sm text-ink-soft">
            <input
              id="bu-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
            />
            Activo
          </label>
        </div>
      </div>
      <p className="text-xs text-ink-faint">El código interno no se puede cambiar.</p>
      <Button type="button" size="sm" loading={isPending} disabled={isPending || !dirty} onClick={handleSave}>
        Guardar cambios
      </Button>
    </div>
  );
}
