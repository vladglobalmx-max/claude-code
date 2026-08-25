import { DotIndicator } from "@/components/ui/dot-indicator";
import { DUE_DATE_STATUS_DOT_COLOR, DUE_DATE_STATUS_LABELS, type DueDateStatus } from "@/lib/dashboard/due-dates";

/**
 * THÖREN Fase 6K — indicador discreto de vencimiento contra la fecha
 * compromiso relevante (ver lib/dashboard/due-dates.ts). Solo se debe
 * renderizar cuando existe un DueDateStatus real (null = sin fecha
 * relevante capturada — no se inventa un vencimiento).
 */
export function DueDateStatusIndicator({ status, className }: { status: DueDateStatus; className?: string }) {
  return (
    <DotIndicator colorClassName={DUE_DATE_STATUS_DOT_COLOR[status]} label={DUE_DATE_STATUS_LABELS[status]} className={className} />
  );
}
