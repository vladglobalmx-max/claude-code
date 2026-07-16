"use client";

import { useActionState } from "react";

import { createBusinessUnitAction } from "../actions";

export function NewBusinessUnitForm() {
  const [errorMessage, formAction, isPending] = useActionState(createBusinessUnitAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Código *
        <input
          name="code"
          required
          maxLength={5}
          placeholder="ej. TSS, GFB"
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="text-xs text-zinc-500">
          2 a 5 letras. No se puede cambiar después de crear la línea.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nombre *
        <input
          name="name"
          required
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
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Creando…" : "Crear línea"}
      </button>
    </form>
  );
}
