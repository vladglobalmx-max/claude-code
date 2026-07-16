"use client";

import { useActionState } from "react";

import { createQuotationAction } from "../actions";

export function NewQuotationForm({
  businessUnitId,
  businessUnitLabel,
  customers,
  defaultValidUntil,
}: {
  businessUnitId: string;
  businessUnitLabel: string;
  customers: { id: string; legalName: string; tradeName: string | null }[];
  defaultValidUntil: string;
}) {
  const [errorMessage, formAction, isPending] = useActionState(createQuotationAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="businessUnitId" value={businessUnitId} />

      <p className="text-sm text-zinc-500">
        Línea: <span className="font-semibold">{businessUnitLabel}</span>
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Cliente *
        <select
          name="customerId"
          required
          defaultValue=""
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            Selecciona un cliente
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.legalName}
              {customer.tradeName ? ` (${customer.tradeName})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Vigente hasta
        <input
          name="validUntil"
          type="date"
          defaultValue={defaultValidUntil}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observaciones
        <textarea
          name="notes"
          rows={2}
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Creando…" : "Crear cotización"}
      </button>
    </form>
  );
}
