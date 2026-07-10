"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { OPPORTUNITY_STAGES, type Opportunity } from "@/types/domain";
import { changeOpportunityStageAction } from "@/app/(app)/opportunities/actions";

export function StageSelector({ opportunityId, currentStage }: { opportunityId: string; currentStage: Opportunity["stage"] }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStage = e.target.value as Opportunity["stage"];
    startTransition(async () => {
      try {
        await changeOpportunityStageAction(opportunityId, newStage);
        toast.success("Etapa actualizada");
      } catch {
        toast.error("No se pudo actualizar la etapa");
      }
    });
  }

  return (
    <select
      defaultValue={currentStage}
      disabled={isPending}
      onChange={handleChange}
      className="h-9 rounded-md border border-border bg-surface-2 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
    >
      {OPPORTUNITY_STAGES.map((stage) => (
        <option key={stage.value} value={stage.value}>
          {stage.label}
        </option>
      ))}
    </select>
  );
}
