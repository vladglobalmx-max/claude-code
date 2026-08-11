"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type { Salesperson } from "@/types/domain";
import type { SalespersonFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function SalespersonForm({
  action,
  salesperson,
  submitLabel,
}: {
  action: (state: SalespersonFormState, formData: FormData) => Promise<SalespersonFormState>;
  salesperson?: Salesperson;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={salesperson?.name} placeholder="Vladimir Peña" />
      </div>

      <div>
        <Label htmlFor="prefix">Prefijo Thunder</Label>
        <Input
          id="prefix"
          name="prefix"
          required
          maxLength={8}
          defaultValue={salesperson?.prefix}
          placeholder="VPT"
          className="font-mono uppercase"
        />
        <p className="mt-1 text-xs text-ink-faint">Debe ser único. Se usa en el folio: VPT-20261108-001</p>
      </div>

      <div>
        <Label htmlFor="sequence_current">Consecutivo actual</Label>
        <Input
          id="sequence_current"
          name="sequence_current"
          type="number"
          min={0}
          defaultValue={salesperson?.sequence_current ?? 0}
        />
        <p className="mt-1 text-xs text-ink-faint">
          El siguiente pedido de este vendedor usará el consecutivo {" "}
          <span className="font-medium text-ink-soft">
            {(salesperson?.sequence_current ?? 0) + 1}
          </span>
          . Normalmente déjalo en 0 para un vendedor nuevo.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="active"
          defaultChecked={salesperson?.active ?? true}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        />
        Activo
      </label>

      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/vendedores" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
