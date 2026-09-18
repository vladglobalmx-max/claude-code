import Link from "next/link";
import { Calendar } from "lucide-react";
import { getBusinessGreeting, getBusinessToday } from "@/lib/business-date";
import { formatDateLong } from "@/lib/utils/format";
import type { DashboardCard } from "./get-role-dashboard-data";

/**
 * THÖREN 0085 — franja superior oscura estilo Command Center. Recupera el
 * tratamiento visual que ya existía antes de 0084 (símbolo Þ, tokens
 * `sidebar-bg`/`sidebar-ink`, `getBusinessGreeting`/`formatDateLong` ya
 * existentes) — no se inventa un estilo nuevo, se reintegra el que ya
 * estaba probado. Full-bleed (fuera de cualquier `max-w`, ver
 * role-dashboard-view.tsx): el fondo oscuro cubre todo el ancho del área
 * de contenido, el texto se acota internamente a `max-w-[1440px]`.
 */
export function DashboardHero({ name, timezone, kpis }: { name: string; timezone: string; kpis: DashboardCard[] }) {
  const greeting = getBusinessGreeting(timezone);
  const today = formatDateLong(getBusinessToday(timezone));

  return (
    <div className="border-b border-black/10 bg-sidebar-bg">
      <div className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-border text-lg font-bold leading-none text-accent"
              >
                Þ
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-ink-soft">
                THÖREN <span className="text-accent">· Command Center</span>
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-sidebar-ink sm:text-4xl">
              {greeting}
              {name ? `, ${name}` : ""}
            </h1>
            <p className="mt-1.5 text-sm text-sidebar-ink-soft">Control total de tu operación</p>
          </div>
          <p className="flex shrink-0 items-center gap-1.5 text-sm text-sidebar-ink-soft sm:text-right">
            <Calendar className="h-3.5 w-3.5" />
            {today}
          </p>
        </div>

        {kpis.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-5 lg:grid-cols-3 lg:divide-x lg:divide-white/10">
            {kpis.map((kpi) => (
              <Link key={kpi.label} href={kpi.href} className="group flex items-start gap-3 rounded-lg lg:px-6 lg:first:pl-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <kpi.icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-ink-soft">{kpi.label}</p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums text-sidebar-ink group-hover:text-accent">{kpi.count}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
