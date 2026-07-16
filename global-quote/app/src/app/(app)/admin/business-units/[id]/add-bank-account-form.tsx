"use client";

import { useActionState } from "react";

import { addBankAccountAction } from "../actions";

export function AddBankAccountForm({ businessUnitId }: { businessUnitId: string }) {
  const boundAction = addBankAccountAction.bind(null, businessUnitId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Banco *
          <input
            name="bankName"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Titular *
          <input
            name="accountHolder"
            required
            defaultValue="Global Supplier MTY S.A. de C.V."
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cuenta *
          <input
            name="accountNumber"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          CLABE
          <input
            name="clabe"
            maxLength={18}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Moneda
          <select
            name="currency"
            defaultValue="MXN"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        {isPending ? "Agregando…" : "+ Agregar cuenta"}
      </button>
    </form>
  );
}
