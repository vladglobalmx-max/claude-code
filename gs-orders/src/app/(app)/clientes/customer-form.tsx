"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type { Customer } from "@/types/domain";
import type { CustomerFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function CustomerForm({
  action,
  customer,
  submitLabel,
  showActiveToggle = false,
}: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  customer?: Customer;
  submitLabel: string;
  /** true solo en edición (ADMIN) — crear nunca expone el toggle, active siempre nace true. */
  showActiveToggle?: boolean;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={customer?.name} placeholder="Constructora del Norte" />
      </div>

      <div>
        <Label htmlFor="legal_name">Razón social (opcional)</Label>
        <Input id="legal_name" name="legal_name" defaultValue={customer?.legal_name ?? ""} placeholder="Constructora del Norte SA de CV" />
      </div>

      <div>
        <Label htmlFor="tax_id">RFC (opcional)</Label>
        <Input id="tax_id" name="tax_id" defaultValue={customer?.tax_id ?? ""} className="font-mono uppercase" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email (opcional)</Label>
          <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} placeholder="contacto@empresa.mx" />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} placeholder="8112345678" />
        </div>
      </div>

      {showActiveToggle && (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="active"
            defaultChecked={customer?.active ?? true}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Activo
        </label>
      )}

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/clientes" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
