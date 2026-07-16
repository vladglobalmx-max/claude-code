import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { RoleCode } from "@/generated/prisma/enums";
import { canApproveRule } from "@/lib/quotations/approval-rules";
import { QuotationMutationError } from "@/lib/quotations/mutations";

/**
 * Alcance del panel de autorizaciones: solo las pendientes de líneas de
 * negocio asignadas al usuario. El filtro por regla (¿tiene autoridad para
 * *esta* regla en particular?) se aplica después con `canApproveRule`,
 * porque Prisma no puede expresar esa lógica en un `where` sin duplicarla.
 */
export function pendingApprovalsWhere(businessUnitIds: string[]): Prisma.QuotationApprovalWhereInput {
  return {
    decision: "PENDING",
    quotation: { businessUnitId: { in: businessUnitIds } },
  };
}

export async function decideApproval(input: {
  approvalId: string;
  approverId: string;
  approverRole: RoleCode;
  decision: "APPROVED" | "REJECTED";
  decisionNote: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.quotationApproval.findUniqueOrThrow({
      where: { id: input.approvalId },
      include: { quotation: true },
    });

    if (approval.decision !== "PENDING") {
      throw new QuotationMutationError("Esta autorización ya fue resuelta.");
    }
    if (approval.quotation.status !== "PENDING_APPROVAL") {
      throw new QuotationMutationError("Esta cotización ya no está pendiente de autorización.");
    }
    if (!canApproveRule(input.approverRole, approval.ruleType)) {
      throw new QuotationMutationError("Tu rol no tiene autoridad para decidir este tipo de excepción.");
    }
    if (input.decision === "REJECTED" && !input.decisionNote?.trim()) {
      throw new QuotationMutationError("Explica el motivo del rechazo.");
    }

    await tx.quotationApproval.update({
      where: { id: input.approvalId },
      data: {
        decision: input.decision,
        approverId: input.approverId,
        decidedAt: new Date(),
        decisionNote: input.decisionNote?.trim() || null,
      },
    });

    const nextStatus = input.decision === "APPROVED" ? "SENT" : "DRAFT";
    await tx.quotation.update({
      where: { id: approval.quotationId },
      data: { status: nextStatus },
    });
    await tx.quotationStatusHistory.create({
      data: {
        quotationId: approval.quotationId,
        fromStatus: "PENDING_APPROVAL",
        toStatus: nextStatus,
        changedById: input.approverId,
        note: input.decisionNote?.trim() || null,
      },
    });

    return tx.quotationApproval.findUniqueOrThrow({ where: { id: input.approvalId } });
  });
}
