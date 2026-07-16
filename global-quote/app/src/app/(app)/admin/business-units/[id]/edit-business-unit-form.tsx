"use client";

import { useActionState } from "react";

import { updateBusinessUnitAction } from "../actions";

export function EditBusinessUnitForm({
  businessUnitId,
  defaults,
}: {
  businessUnitId: string;
  defaults: {
    name: string;
    legalName: string;
    taxId: string;
    address: string;
    colorPrimary: string;
    colorSecondary: string;
    minMarginDefault: string;
    folioNumberingMode: string;
    active: boolean;
  };
}) {
  const boundAction = updateBusinessUnitAction.bind(null, businessUnitId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Nombre *
        <input
          name="name"
          required
          defaultValue={defaults.name}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Razón social
        <input
          name="legalName"
          defaultValue={defaults.legalName}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          RFC
          <input
            name="taxId"
            defaultValue={defaults.taxId}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Margen mínimo por defecto (%)
          <input
            name="minMarginDefault"
            type="number"
            min="0"
            max="99.99"
            step="0.01"
            defaultValue={defaults.minMarginDefault}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Dirección
        <textarea
          name="address"
          rows={2}
          defaultValue={defaults.address}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Color primario
          <input
            name="colorPrimary"
            type="text"
            placeholder="#0f766e"
            defaultValue={defaults.colorPrimary}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Color secundario
          <input
            name="colorSecondary"
            type="text"
            placeholder="#f0fdfa"
            defaultValue={defaults.colorSecondary}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Numeración de folios
        <select
          name="folioNumberingMode"
          defaultValue={defaults.folioNumberingMode}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="ANNUAL">Anual (reinicia cada enero)</option>
          <option value="CONTINUOUS">Continua (nunca reinicia)</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={defaults.active} />
        Línea activa
      </label>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
