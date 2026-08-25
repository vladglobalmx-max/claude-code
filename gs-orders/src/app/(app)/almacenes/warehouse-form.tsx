"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { Warehouse } from "@/types/domain";
import type { WarehouseFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function WarehouseForm({
  action,
  warehouse,
  submitLabel,
  showActiveToggle = false,
}: {
  action: (state: WarehouseFormState, formData: FormData) => Promise<WarehouseFormState>;
  warehouse?: Warehouse;
  submitLabel: string;
  showActiveToggle?: boolean;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={warehouse?.name} placeholder="Almacén Monterrey" />
      </div>

      <div>
        <Label htmlFor="code">Código</Label>
        <Input id="code" name="code" required defaultValue={warehouse?.code} className="font-mono uppercase" placeholder="ALM-MTY" />
      </div>

      <div>
        <Label htmlFor="location">Ubicación / dirección (opcional)</Label>
        <Input id="location" name="location" defaultValue={warehouse?.location ?? ""} />
      </div>

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={warehouse?.notes ?? ""} />
      </div>

      {showActiveToggle && (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="active"
            defaultChecked={warehouse?.active ?? true}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Activo
        </label>
      )}

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/almacenes" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
