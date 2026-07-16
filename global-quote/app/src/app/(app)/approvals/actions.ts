"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { decideApproval } from "@/lib/quotations/approvals";
import { QuotationMutationError } from "@/lib/quotations/mutations";

export async function decideApprovalAction(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.APPROVE_EXCEPTION)) {
    redirect("/dashboard?error=forbidden");
  }

  const decisionNote = formData.get("decisionNote");

  try {
    await decideApproval({
      approvalId,
      approverId: session.user.id,
      approverRole: session.user.role,
      decision,
      decisionNote: typeof decisionNote === "string" ? decisionNote : null,
    });
  } catch (error) {
    if (error instanceof QuotationMutationError) return error.message;
    throw error;
  }

  redirect("/approvals");
}
