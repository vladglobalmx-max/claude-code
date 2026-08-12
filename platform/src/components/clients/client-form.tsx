"use client";

import { useFormState, useFormStatus } from "react-dom";
import { FormField, Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClientAction, type CreateClientState } from "@/app/(app)/clients/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Guardar cliente
    </Button>
  );
}

export function ClientForm({ businessUnits }: { businessUnits: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState<CreateClientState, FormData>(createClientAction, {});

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {state.error && <p className="sm:col-span-2 text-sm text-danger">{state.error}</p>}

      <FormField label="Razón social" htmlFor="legal_name" error={state.fieldErrors?.legal_name}>
        <Input id="legal_name" name="legal_name" required />
      </FormField>
      <FormField label="Nombre comercial" htmlFor="trade_name">
        <Input id="trade_name" name="trade_name" />
      </FormField>

      <FormField label="Unidad de negocio" htmlFor="business_unit_id" error={state.fieldErrors?.business_unit_id}>
        <select
          id="business_unit_id"
          name="business_unit_id"
          required
          className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Selecciona…</option>
          {businessUnits.map((bu) => (
            <option key={bu.id} value={bu.id}>
              {bu.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Industria" htmlFor="industry">
        <Input id="industry" name="industry" />
      </FormField>

      <FormField label="Tamaño" htmlFor="size">
        <Input id="size" name="size" placeholder="PyME, corporativo…" />
      </FormField>
      <FormField label="Número de empleados" htmlFor="employees_count">
        <Input id="employees_count" name="employees_count" type="number" min={0} />
      </FormField>

      <FormField label="Sitio web" htmlFor="website">
        <Input id="website" name="website" placeholder="https://" />
      </FormField>
      <FormField label="Teléfono" htmlFor="phone">
        <Input id="phone" name="phone" />
      </FormField>

      <FormField label="Ciudad" htmlFor="city">
        <Input id="city" name="city" />
      </FormField>
      <FormField label="Estado" htmlFor="state">
        <Input id="state" name="state" />
      </FormField>
      <FormField label="País" htmlFor="country">
        <Input id="country" name="country" defaultValue="México" />
      </FormField>
      <FormField label="Dirección" htmlFor="address">
        <Input id="address" name="address" />
      </FormField>

      <div>
        <Label htmlFor="status">Estatus</Label>
        <select
          id="status"
          name="status"
          defaultValue="prospect"
          className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="prospect">Prospecto</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>
      <FormField label="Fuente del prospecto" htmlFor="source">
        <Input id="source" name="source" placeholder="Referido, feria, web…" />
      </FormField>

      <div className="sm:col-span-2">
        <FormField label="Notas" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} />
        </FormField>
      </div>

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
