"use client";

import { useActionState, useState } from "react";

import { markQuotationAcceptedAction, markQuotationRejectedAction } from "../actions";

export function QuotationDecisionForm({ quotationId }: { quotationId: string }) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const boundReject = markQuotationRejectedAction.bind(null, quotationId);
  const [rejectError, rejectFormAction, isRejecting] = useActionState(boundReject, undefined);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Esta app no tiene portal de cliente: registra aquí lo que el cliente decidió por el canal
        que haya usado (llamada, correo, WhatsApp).
      </p>
      <div className="flex gap-2">
        <form action={markQuotationAcceptedAction.bind(null, quotationId)}>
          <button
            type="submit"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          >
            Marcar como aceptada
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowRejectForm((value) => !value)}
          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
        >
          Marcar como rechazada
        </button>
      </div>

      {showRejectForm ? (
        <form action={rejectFormAction} className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <label className="flex flex-col gap-1 text-sm">
            Motivo del rechazo
            <textarea
              name="reason"
              rows={2}
              required
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          {rejectError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {rejectError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isRejecting}
            className="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {isRejecting ? "Guardando…" : "Confirmar rechazo"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
