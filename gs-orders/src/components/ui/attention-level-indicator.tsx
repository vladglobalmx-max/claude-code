import { DotIndicator } from "@/components/ui/dot-indicator";
import {
  ATTENTION_LEVEL_DOT_COLOR,
  ATTENTION_LEVEL_LABELS,
  formatDaysInStatus,
  type AttentionLevel,
} from "@/lib/dashboard/attention-queue";

/**
 * THÖREN Fase 6J — indicador discreto del semáforo de antigüedad.
 * Reutilizado por el Dashboard ("Requieren atención") y por el listado de
 * Pedidos (columna Seguimiento, formato compacto "Crítico · 8 días" cuando
 * se pasa `daysInStatus`) — una sola fuente de verdad para el mapeo nivel
 * -> color/etiqueta (lib/dashboard/attention-queue.ts).
 */
export function AttentionLevelIndicator({
  level,
  daysInStatus,
  className,
}: {
  level: AttentionLevel;
  /** Opcional — cuando se pasa, agrega " · N días" al indicador (formato compacto del listado de Pedidos). */
  daysInStatus?: number;
  className?: string;
}) {
  return (
    <DotIndicator
      colorClassName={ATTENTION_LEVEL_DOT_COLOR[level]}
      label={ATTENTION_LEVEL_LABELS[level]}
      suffix={daysInStatus !== undefined ? ` · ${formatDaysInStatus(daysInStatus)}` : undefined}
      className={className}
    />
  );
}
