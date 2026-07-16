"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { expireOverdueQuotations } from "@/lib/followups/mutations";

export async function runExpirationAction(): Promise<void> {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_SEQUENCES)) {
    redirect("/dashboard?error=forbidden");
  }

  const expiredIds = await expireOverdueQuotations(new Date(), session.user.id);
  redirect(`/admin/followups?expired=${expiredIds.length}`);
}
