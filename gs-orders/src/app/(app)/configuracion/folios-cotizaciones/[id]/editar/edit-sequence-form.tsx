"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type { SalespersonQuoteSequence } from "@/types/domain";
import type { QuoteSequenceFormState } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Guardar cambios
    </Button>
  );
}

export function EditQuoteSequenceForm({
  action,
  sequence,
  salespersonName,
  businessUnitName,
}: {
  action: (state: QuoteSequenceFormState, formData: FormData) => Promise<QuoteSequenceFormState>;
  sequence: SalespersonQuoteSequence;
  salespersonName: string;
  businessUnitName: string;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label>Vendedor</Label>
        <p className="text-sm text-ink">{salespersonName}</p>
      </div>

      <div>
        <Label>Business Unit</Label>
        <p className="text-sm text-ink">{businessUnitName}</p>
      </div>

      <div>
        <Label htmlFor="quote_prefix">Prefijo de folio</Label>
        <Input
          id="quote_prefix"
          name="quote_prefix"
          required
          maxLength={20}
          defaultValue={sequence.quote_prefix}
          className="font-mono uppercase"
        />
        <p className="mt-1 text-xs text-ink-faint">
          Solo letras, números y guiones, sin espacios. Se convierte a MAYÚSCULAS automáticamente y debe ser único en
          tu organización.
        </p>
      </div>

      <div>
        <Label>Consecutivo actual</Label>
        <p className="font-mono text-sm text-ink">{sequence.sequence_current}</p>
        <p className="mt-1 text-xs text-ink-faint">
          Lo administra exclusivamente el motor de folios al generar cada Cotización — no es editable desde aquí.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="active"
          defaultChecked={sequence.active}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        />
        Activo
      </label>

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton />
        <Link href="/configuracion/folios-cotizaciones" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
