import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { QuickAction } from "@/lib/dashboard/quick-actions";

/**
 * THÖREN 6R.1C — franja de accesos rápidos del Home, derivados de
 * buildQuickActions() (role + capabilities). Deliberadamente compacto
 * (máximo 3 tarjetas, ver MAX_QUICK_ACTIONS) — grid responsive de 1
 * columna en mobile, 3 en desktop, sin overflow ni cards cortadas.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {actions.map((action) => (
        <Link
          key={action.id}
          href={action.href}
          className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:bg-surface-2"
        >
          <span className="truncate">{action.label}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-accent" />
        </Link>
      ))}
    </div>
  );
}
