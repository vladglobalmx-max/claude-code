import { cn } from "@/lib/utils/cn";

/**
 * THÖREN Fase 6J/6K — primitivo del "indicador visual discreto" (punto +
 * etiqueta, nunca un Badge de pill completo) — reutilizado por
 * AttentionLevelIndicator (semáforo de antigüedad) y DueDateStatusIndicator
 * (vencimiento contra fecha compromiso, Fase 6K), en vez de duplicar la
 * misma estructura dot+texto en cada uno.
 */
export function DotIndicator({
  colorClassName,
  label,
  suffix,
  className,
}: {
  colorClassName: string;
  label: string;
  /** Texto opcional agregado después de la etiqueta, ej. " · 8 días". */
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-soft", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colorClassName)} />
      {label}
      {suffix}
    </span>
  );
}
