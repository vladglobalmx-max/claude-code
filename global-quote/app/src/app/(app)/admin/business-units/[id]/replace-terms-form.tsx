"use client";

import { useActionState } from "react";

import { replaceTermsAction } from "../actions";

export function ReplaceTermsForm({
  businessUnitId,
  currentContent,
}: {
  businessUnitId: string;
  currentContent: string;
}) {
  const boundAction = replaceTermsAction.bind(null, businessUnitId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Texto de términos y condiciones
        <textarea
          name="content"
          rows={6}
          defaultValue={currentContent}
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <p className="text-xs text-zinc-500">
        Guardar cierra la versión vigente y crea una nueva — el texto anterior se conserva en el
        historial (docs/ARCHITECTURE.md §5.2).
      </p>

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
        {isPending ? "Guardando…" : "Guardar nueva versión"}
      </button>
    </form>
  );
}
