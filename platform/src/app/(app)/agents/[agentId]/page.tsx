import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ChatWindow } from "@/components/agents/chat-window";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({ params }: { params: { agentId: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = createSupabaseServerClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, slug, name, description, allowed_roles")
    .eq("slug", params.agentId)
    .eq("company_id", user.companyId)
    .eq("status", "active")
    .single();

  if (!agent) notFound();
  if (agent.allowed_roles.length > 0 && !agent.allowed_roles.includes(user.role)) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{agent.name}</h1>
        {agent.description && <p className="text-sm text-ink-faint">{agent.description}</p>}
      </div>
      <ChatWindow agentSlug={agent.slug} agentName={agent.name} />
    </div>
  );
}
