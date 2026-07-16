"use client";

import { useActionState } from "react";

import { decideApprovalAction } from "./actions";

export function ApprovalDecisionForm({ approvalId }: { approvalId: string }) {
  const approveAction = decideApprovalAction.bind(null, approvalId, "APPROVED");
  const rejectAction = decideApprovalAction.bind(null, approvalId, "REJECTED");

  const [approveError, approveFormAction, approvePending] = useActionState(approveAction, undefined);
  const [rejectError, rejectFormAction, rejectPending] = useActionState(rejectAction, undefined);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <form action={approveFormAction} className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={approvePending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {approvePending ? "Aprobando…" : "Aprobar"}
        </button>
        {approveError ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {approveError}
          </p>
        ) : null}
      </form>

      <form action={rejectFormAction} className="flex flex-1 flex-col gap-2">
        <div className="flex gap-2">
          <input
            name="decisionNote"
            required
            placeholder="Motivo del rechazo (obligatorio)"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={rejectPending}
            className="shrink-0 rounded-md border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {rejectPending ? "Rechazando…" : "Rechazar"}
          </button>
        </div>
        {rejectError ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {rejectError}
          </p>
        ) : null}
      </form>
    </div>
  );
}
