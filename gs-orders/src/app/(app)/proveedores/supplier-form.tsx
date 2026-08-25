"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { Supplier } from "@/types/domain";
import type { SupplierFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function SupplierForm({
  action,
  supplier,
  submitLabel,
  showActiveToggle = false,
}: {
  action: (state: SupplierFormState, formData: FormData) => Promise<SupplierFormState>;
  supplier?: Supplier;
  submitLabel: string;
  /** true solo en edición (ADMIN) — crear nunca expone el toggle, active siempre nace true. */
  showActiveToggle?: boolean;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Nombre / razón social</Label>
        <Input id="name" name="name" required defaultValue={supplier?.name} placeholder="Proveedora Industrial SA de CV" />
      </div>

      <div>
        <Label htmlFor="tax_id">RFC / Tax ID (opcional)</Label>
        <Input id="tax_id" name="tax_id" defaultValue={supplier?.tax_id ?? ""} className="font-mono uppercase" />
      </div>

      <div>
        <Label htmlFor="contact_name">Contacto (opcional)</Label>
        <Input id="contact_name" name="contact_name" defaultValue={supplier?.contact_name ?? ""} placeholder="Nombre de la persona de contacto" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email (opcional)</Label>
          <Input id="email" name="email" type="email" defaultValue={supplier?.email ?? ""} placeholder="compras@proveedor.mx" />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={supplier?.phone ?? ""} placeholder="8112345678" />
        </div>
      </div>

      <div>
        <Label htmlFor="preferred_currency">Moneda habitual (opcional)</Label>
        <Input id="preferred_currency" name="preferred_currency" defaultValue={supplier?.preferred_currency ?? ""} placeholder="MXN" className="w-32 uppercase" />
      </div>

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={supplier?.notes ?? ""} />
      </div>

      {showActiveToggle && (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="active"
            defaultChecked={supplier?.active ?? true}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Activo
        </label>
      )}

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/proveedores" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
