"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Opportunity } from "@/types/domain";

export async function changeOpportunityStageAction(opportunityId: string, newStage: Opportunity["stage"]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sesión no válida.");

  const supabase = createSupabaseServerClient();

  const { data: current } = await supabase
    .from("opportunities")
    .select("stage")
    .eq("id", opportunityId)
    .eq("company_id", user.companyId)
    .single();

  if (!current) throw new Error("Oportunidad no encontrada.");

  await supabase
    .from("opportunities")
    .update({ stage: newStage, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", opportunityId);

  await supabase.from("opportunity_stage_history").insert({
    opportunity_id: opportunityId,
    from_stage: current.stage,
    to_stage: newStage,
    changed_by: user.id,
  });

  await supabase.from("audit_log").insert({
    company_id: user.companyId,
    user_id: user.id,
    action: "change_stage",
    entity_type: "opportunities",
    entity_id: opportunityId,
    metadata: { from: current.stage, to: newStage },
  });

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/kanban");
}
