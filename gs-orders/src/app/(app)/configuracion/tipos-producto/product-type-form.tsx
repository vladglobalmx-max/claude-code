"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type { ProductTypeItem } from "@/types/domain";
import type { ProductTypeFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function ProductTypeForm({
  action,
  productType,
  submitLabel,
}: {
  action: (state: ProductTypeFormState, formData: FormData) => Promise<ProductTypeFormState>;
  productType?: ProductTypeItem;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const isEdit = !!productType;

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={productType?.name} placeholder="Iluminación Industrial" />
        <p className="mt-1 text-xs text-ink-faint">Texto que se muestra en Nuevo Pedido, Ver Pedido y el PDF.</p>
      </div>

      {isEdit ? (
        <div>
          <Label>Código interno</Label>
          <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm text-ink-soft">
            {productType.code}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            El código interno no se puede cambiar: algunos tipos (como Proyector/GOBO) controlan lógica de la app.
          </p>
        </div>
      ) : (
        <div>
          <Label htmlFor="code">Código interno (opcional)</Label>
          <Input id="code" name="code" placeholder="Se genera automáticamente a partir del nombre si lo dejas vacío" />
          <p className="mt-1 text-xs text-ink-faint">
            Identificador interno estable, minúsculas y guion bajo. Si lo dejas vacío se genera a partir del nombre.
            No se podrá editar después de crear el tipo.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="active"
          defaultChecked={productType?.active ?? true}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        />
        Activo (visible en Nuevo Pedido)
      </label>

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/configuracion/tipos-producto" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
