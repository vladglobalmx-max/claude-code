import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { APPROVAL_RULE_LABELS, canApproveRule } from "@/lib/quotations/approval-rules";
import { pendingApprovalsWhere } from "@/lib/quotations/approvals";

import { ApprovalDecisionForm } from "./approval-decision-form";

const currency = (value: number, code: string) =>
  value.toLocaleString("es-MX", { style: "currency", currency: code });

export default async function ApprovalsPage() {
  const session = await requireSession();
  const role = session.user.role;

  if (!hasPermission(role, PERMISSIONS.APPROVE_EXCEPTION)) {
    redirect("/dashboard?error=forbidden");
  }

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);

  const allPending = await prisma.quotationApproval.findMany({
    where: pendingApprovalsWhere(businessUnitIds),
    include: {
      quotation: {
        include: {
          customer: { select: { legalName: true } },
          seller: { select: { fullName: true } },
          businessUnit: { select: { code: true } },
        },
      },
      requestedBy: { select: { fullName: true } },
    },
    orderBy: { requestedAt: "asc" },
  });

  const pending = allPending.filter((approval) => canApproveRule(role, approval.ruleType));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Autorizaciones</h1>
        <p className="text-sm text-zinc-500">
          Módulo 7 — ver docs/ARCHITECTURE.md §12. Solo se muestran las excepciones sobre las que
          tu rol tiene autoridad de decisión.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No hay autorizaciones pendientes para ti.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((approval) => (
            <div
              key={approval.id}
              className="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/quotations/${approval.quotationId}`}
                    className="font-mono text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {approval.quotation.folio}
                  </Link>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {approval.quotation.businessUnit.code} · {approval.quotation.customer.legalName}{" "}
                    · Vendedor: {approval.quotation.seller.fullName}
                  </p>
                </div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {currency(approval.quotation.total.toNumber(), approval.quotation.currency)}
                </p>
              </div>

              <p className="mt-3 text-sm font-semibold text-amber-800 dark:text-amber-400">
                {APPROVAL_RULE_LABELS[approval.ruleType]}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-400">{approval.reason}</p>
              {approval.marginPctBefore != null ? (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Margen de la cotización: {approval.marginPctBefore.toString()}%
                </p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Justificación de {approval.requestedBy.fullName}: {approval.justification}
              </p>

              <div className="mt-4 border-t border-amber-200 pt-4 dark:border-amber-900">
                <ApprovalDecisionForm approvalId={approval.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
