"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { CUSTOM_FIELD_ENTITY_TYPES, CUSTOM_FIELD_TYPES, type CustomFieldDefinition } from "@/lib/custom-fields/types";
import type { CustomFieldFormState } from "./actions";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "Producto",
  quote_item: "Producto de cotización",
  order_item: "Producto de pedido",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  textarea: "Texto largo",
  number: "Número",
  select: "Selección",
  checkbox: "Casilla",
  date: "Fecha",
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function CustomFieldForm({
  action,
  definition,
  businessUnits,
  submitLabel,
}: {
  action: (state: CustomFieldFormState, formData: FormData) => Promise<CustomFieldFormState>;
  definition?: CustomFieldDefinition;
  businessUnits: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const isEdit = !!definition;

  return (
    <form action={formAction} className="space-y-5">
      {isEdit ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Aplica a</Label>
            <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink-soft">
              {ENTITY_TYPE_LABELS[definition.entityType] ?? definition.entityType}
            </p>
          </div>
          <div>
            <Label>Clave interna</Label>
            <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm text-ink-soft">
              {definition.key}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="entityType">Aplica a</Label>
            <Select id="entityType" name="entityType" defaultValue="order_item" required>
              {CUSTOM_FIELD_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="key">Clave interna</Label>
            <Input id="key" name="key" placeholder="ej. color, prioridad" required />
            <p className="mt-1 text-xs text-ink-faint">Minúsculas, sin espacios. No se puede editar después.</p>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="businessUnitId">Alcance</Label>
        {isEdit ? (
          <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink-soft">
            {definition.businessUnitId
              ? businessUnits.find((bu) => bu.id === definition.businessUnitId)?.name ?? "—"
              : "Toda la organización"}
          </p>
        ) : (
          <Select id="businessUnitId" name="businessUnitId" defaultValue="">
            <option value="">Toda la organización</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name}
              </option>
            ))}
          </Select>
        )}
        <p className="mt-1 text-xs text-ink-faint">
          &ldquo;Toda la organización&rdquo; aparece en cualquier Business Unit. Elegir una la limita solo a esa.
        </p>
      </div>

      <div>
        <Label htmlFor="label">Etiqueta</Label>
        <Input id="label" name="label" required defaultValue={definition?.label} placeholder="Ej. Color, Prioridad" />
        <p className="mt-1 text-xs text-ink-faint">Texto que ve quien captura el formulario.</p>
      </div>

      {isEdit ? (
        <div>
          <Label>Tipo de campo</Label>
          <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink-soft">
            {FIELD_TYPE_LABELS[definition.fieldType] ?? definition.fieldType}
          </p>
          <input type="hidden" name="fieldType" value={definition.fieldType} />
        </div>
      ) : (
        <div>
          <Label htmlFor="fieldType">Tipo de campo</Label>
          <Select id="fieldType" name="fieldType" defaultValue="text" required>
            {CUSTOM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="options">Opciones (solo para &ldquo;Selección&rdquo;)</Label>
        <Textarea
          id="options"
          name="options"
          rows={3}
          defaultValue={definition?.options?.join("\n")}
          placeholder={"Una opción por línea, ej.:\nComodato\nVenta"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="placeholder">Texto de ejemplo (opcional)</Label>
          <Input id="placeholder" name="placeholder" defaultValue={definition?.placeholder ?? ""} />
        </div>
        <div>
          <Label htmlFor="sortOrder">Orden</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={definition?.sortOrder ?? 0} />
        </div>
      </div>

      <div>
        <Label htmlFor="helpText">Ayuda (opcional)</Label>
        <Textarea id="helpText" name="helpText" rows={2} defaultValue={definition?.helpText ?? ""} />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="required"
            defaultChecked={definition?.required ?? false}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Obligatorio al capturar
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="requiredBeforeOrder"
            defaultChecked={definition?.requiredBeforeOrder ?? false}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Obligatorio antes de Pedido
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="requiredBeforeFulfillment"
            defaultChecked={definition?.requiredBeforeFulfillment ?? false}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Obligatorio antes de Fulfillment
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="active"
            defaultChecked={definition?.active ?? true}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
          />
          Activo (visible al capturar)
        </label>
      </div>
      <p className="-mt-3 text-xs text-ink-faint">
        &ldquo;Antes de Fulfillment&rdquo; se guarda pero todavía no bloquea nada — se reserva para una fase futura.
      </p>

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/configuracion/campos-personalizados" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
