"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";

export async function toggleToolStatusAction(toolId: string, nextStatus: "active" | "inactive") {
  const user = await getCurrentUser();
  if (!user || !roleHasPermission(user.role, "manage_tools")) throw new Error("No autorizado.");

  const supabase = createSupabaseServerClient();
  await supabase.from("tools").update({ status: nextStatus }).eq("id", toolId).eq("company_id", user.companyId);

  await supabase.from("audit_log").insert({
    company_id: user.companyId,
    user_id: user.id,
    action: nextStatus === "active" ? "activate_tool" : "deactivate_tool",
    entity_type: "tools",
    entity_id: toolId,
  });

  revalidatePath("/admin/tools");
}
