"use client";

import { StatusToggle } from "@/components/admin/status-toggle";
import { toggleAgentStatusAction } from "@/app/(app)/admin/agents/actions";

export function AgentStatusCell({ agentId, status }: { agentId: string; status: "active" | "inactive" }) {
  return <StatusToggle status={status} onToggle={(next) => toggleAgentStatusAction(agentId, next)} />;
}
