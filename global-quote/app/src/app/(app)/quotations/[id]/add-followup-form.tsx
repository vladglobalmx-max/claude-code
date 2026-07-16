"use client";

import { useActionState } from "react";

import { addFollowupAction } from "../actions";

export function AddFollowupForm({ quotationId }: { quotationId: string }) {
  const boundAction = addFollowupAction.bind(null, quotationId);
  const [errorMessage, formAction, isPending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          Medio de contacto
          <select
            name="contactMethod"
            defaultValue="PHONE"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="EMAIL">Correo</option>
            <option value="PHONE">Teléfono</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IN_PERSON">En persona</option>
            <option value="OTHER">Otro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Próximo seguimiento
          <input
            name="nextFollowupAt"
            type="date"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Probabilidad de cierre (%)
          <input
            name="closeProbabilityPct"
            type="number"
            min="0"
            max="100"
            step="1"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Competidor mencionado
          <input
            name="competitor"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Objeción
        <input
          name="objection"
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Comentarios
        <textarea
          name="comments"
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
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        {isPending ? "Guardando…" : "+ Registrar seguimiento"}
      </button>
    </form>
  );
}
