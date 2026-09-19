"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { OrganizationSettingsFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={pending}>
      Guardar cambios
    </Button>
  );
}

/**
 * THÖREN 0084 — trade_name/tax_id/currency/timezone son las ÚNICAS
 * columnas editables por un Admin de organización (rpc_update_organization_
 * settings). Nombre legal (name), slug y active NO aparecen aquí: quedan
 * reservados a plataforma/service_role (ver DECISIÓN en
 * 0084_organization_modules.sql).
 */
export function OrganizationSettingsForm({
  action,
  organizationName,
  initialTradeName,
  initialTaxId,
  initialCurrency,
  initialTimezone,
}: {
  action: (state: OrganizationSettingsFormState, formData: FormData) => Promise<OrganizationSettingsFormState>;
  organizationName: string;
  initialTradeName: string;
  initialTaxId: string;
  initialCurrency: string;
  initialTimezone: string;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label>Nombre legal</Label>
        <p className="mt-1 text-sm text-ink-soft">{organizationName}</p>
        <p className="mt-1 text-xs text-ink-faint">
          El nombre legal y el identificador de la organización no son editables desde aquí.
        </p>
      </div>

      <div>
        <Label htmlFor="trade_name">Nombre comercial</Label>
        <Input id="trade_name" name="trade_name" defaultValue={initialTradeName} maxLength={200} />
      </div>

      <div>
        <Label htmlFor="tax_id">RFC / Tax ID</Label>
        <Input id="tax_id" name="tax_id" defaultValue={initialTaxId} maxLength={40} className="font-mono uppercase" />
      </div>

      <div>
        <Label htmlFor="currency">Moneda principal</Label>
        <Select id="currency" name="currency" required defaultValue={initialCurrency}>
          <option value="MXN">MXN — Peso mexicano</option>
          <option value="USD">USD — Dólar estadounidense</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="timezone">Zona horaria</Label>
        <Input id="timezone" name="timezone" required defaultValue={initialTimezone} placeholder="America/Monterrey" />
        <p className="mt-1 text-xs text-ink-faint">
          Identificador IANA (ej. America/Monterrey, America/Mexico_City). Se usa para calcular la fecha/hora de
          negocio de folios y del saludo de Inicio.
        </p>
      </div>

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
