"use client";

import { StatusToggle } from "@/components/admin/status-toggle";
import { toggleToolStatusAction } from "@/app/(app)/admin/tools/actions";

export function ToolStatusCell({ toolId, status }: { toolId: string; status: "active" | "inactive" }) {
  return <StatusToggle status={status} onToggle={(next) => toggleToolStatusAction(toolId, next)} />;
}
