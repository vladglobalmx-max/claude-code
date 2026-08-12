"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";

export async function toggleAgentStatusAction(agentId: string, nextStatus: "active" | "inactive") {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "manage_agents")) throw new Error("No autorizado.");

  const supabase = createSupabaseServerClient();
  await supabase.from("agents").update({ status: nextStatus }).eq("id", agentId).eq("company_id", user.companyId);

  await supabase.from("audit_log").insert({
    company_id: user.companyId,
    user_id: user.id,
    action: nextStatus === "active" ? "activate_agent" : "deactivate_agent",
    entity_type: "agents",
    entity_id: agentId,
  });

  revalidatePath("/admin/agents");
}
