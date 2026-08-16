"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import type { QuoteSequenceFormState } from "./actions";

interface Option {
  id: string;
  name: string;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={disabled || pending}>
      Crear configuración
    </Button>
  );
}

export function NewQuoteSequenceForm({
  action,
  salespeople,
  businessUnits,
}: {
  action: (state: QuoteSequenceFormState, formData: FormData) => Promise<QuoteSequenceFormState>;
  salespeople: Option[];
  businessUnits: Option[];
}) {
  const [state, formAction] = useFormState(action, undefined);
  const canSubmit = salespeople.length > 0 && businessUnits.length > 0;

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="salesperson_id">Vendedor</Label>
        {salespeople.length === 0 ? (
          <p className="mt-1 text-sm text-ink-faint">No hay vendedores activos. Crea uno primero en Vendedores.</p>
        ) : (
          <Select id="salesperson_id" name="salesperson_id" required defaultValue="">
            <option value="" disabled>
              Selecciona un vendedor…
            </option>
            {salespeople.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div>
        <Label htmlFor="business_unit_id">Business Unit</Label>
        {businessUnits.length === 0 ? (
          <p className="mt-1 text-sm text-ink-faint">
            No hay Business Units activas. Crea una primero en Unidades de Negocio.
          </p>
        ) : (
          <Select id="business_unit_id" name="business_unit_id" required defaultValue="">
            <option value="" disabled>
              Selecciona una Business Unit…
            </option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div>
        <Label htmlFor="quote_prefix">Prefijo de folio</Label>
        <Input
          id="quote_prefix"
          name="quote_prefix"
          required
          maxLength={20}
          placeholder="VPT"
          className="font-mono uppercase"
        />
        <p className="mt-1 text-xs text-ink-faint">
          Solo letras, números y guiones, sin espacios. Se convierte a MAYÚSCULAS automáticamente y debe ser único en
          tu organización.
        </p>
      </div>

      <p className="text-xs text-ink-faint">
        Si este vendedor no tiene Business Units asignadas explícitamente en Personas, puede configurarse para
        cualquier Business Unit activa de tu organización. Si ya tiene asignaciones, solo podrá configurarse para
        esas.
      </p>

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton disabled={!canSubmit} />
        <Link href="/configuracion/folios-cotizaciones" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
