"use client";

import { useActionState } from "react";

import { createTaxAction } from "./actions";

export function NewTaxForm() {
  const [errorMessage, formAction, isPending] = useActionState(createTaxAction, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Código *
        <input
          name="code"
          required
          placeholder="IVA16"
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nombre *
        <input
          name="name"
          required
          placeholder="IVA 16%"
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tasa (%) *
        <input
          name="ratePct"
          type="number"
          min="0"
          max="100"
          step="0.01"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Creando…" : "+ Agregar impuesto"}
      </button>
      {errorMessage ? (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
