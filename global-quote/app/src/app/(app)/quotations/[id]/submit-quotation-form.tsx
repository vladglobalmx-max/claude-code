"use client";

import { useActionState } from "react";

import { submitQuotationAction } from "../actions";

export function SubmitQuotationForm({
  quotationId,
  requiresApproval,
}: {
  quotationId: string;
  requiresApproval: boolean;
}) {
  const boundAction = submitQuotationAction.bind(null, quotationId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {requiresApproval ? (
        <label className="flex flex-col gap-1 text-sm">
          Justificación (obligatoria para enviar a autorización)
          <textarea
            name="justification"
            rows={2}
            required
            className="max-w-xl rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Explica por qué esta cotización necesita la excepción..."
          />
        </label>
      ) : null}

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
        {isPending ? "Enviando…" : requiresApproval ? "Enviar a autorización" : "Enviar cotización"}
      </button>
    </form>
  );
}
