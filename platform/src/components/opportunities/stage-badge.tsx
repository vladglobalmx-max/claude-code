import { Badge } from "@/components/ui/badge";
import { OPPORTUNITY_STAGES, type Opportunity } from "@/types/domain";

const TONE_BY_STAGE: Record<Opportunity["stage"], "neutral" | "accent" | "success" | "danger" | "warning"> = {
  prospecto: "neutral",
  contactado: "neutral",
  calificado: "accent",
  diagnostico: "accent",
  propuesta: "warning",
  negociacion: "warning",
  prueba_piloto: "warning",
  cierre_ganado: "success",
  cierre_perdido: "danger",
  seguimiento_futuro: "neutral",
};

export function StageBadge({ stage }: { stage: Opportunity["stage"] }) {
  const label = OPPORTUNITY_STAGES.find((s) => s.value === stage)?.label ?? stage;
  return <Badge tone={TONE_BY_STAGE[stage]}>{label}</Badge>;
}
