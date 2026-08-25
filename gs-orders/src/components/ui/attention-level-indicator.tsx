import { cn } from "@/lib/utils/cn";
import {
  ATTENTION_LEVEL_DOT_COLOR,
  ATTENTION_LEVEL_LABELS,
  formatDaysInStatus,
  type AttentionLevel,
} from "@/lib/dashboard/attention-queue";

/**
 * THÖREN Fase 6J — indicador discreto del semáforo de antigüedad (punto +
 * etiqueta, no un Badge de pill completo — pedido explícito de "indicador
 * visual discreto"). Reutilizado por el Dashboard ("Requieren atención") y
 * por el listado de Pedidos (columna Seguimiento, formato compacto
 * "Crítico · 8 días" cuando se pasa `daysInStatus`) — una sola fuente de
 * verdad para el mapeo nivel -> color/etiqueta
 * (lib/dashboard/attention-queue.ts).
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
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-soft", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ATTENTION_LEVEL_DOT_COLOR[level])} />
      {ATTENTION_LEVEL_LABELS[level]}
      {daysInStatus !== undefined && ` · ${formatDaysInStatus(daysInStatus)}`}
    </span>
  );
}
