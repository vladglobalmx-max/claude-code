import { Calendar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getBusinessGreeting, getBusinessToday } from "@/lib/business-date";
import { formatDateLong } from "@/lib/utils/format";

export interface HeroKpi {
  label: string;
  value: string;
  helper?: string;
  trend?: { label: string; positive: boolean } | null;
  icon: LucideIcon;
}

/**
 * THÖREN Fase 6Q.1/6Q.2 — el header deja de ser "una tarjeta negra sobre la
 * página" y pasa a ser un hero de ancho completo del área de contenido
 * (fuera del contenedor con max-width, ver dashboard-view.tsx), integrado
 * con el fondo de THÖREN — no una card flotante con esquinas redondeadas.
 * Reutiliza el ÚNICO tratamiento de marca ya existente en el proyecto
 * (símbolo Þ en Ember sobre Basalt, ver sidebar.tsx y
 * THOREN_BRAND_SYSTEM.md) — no se inventa un logo ni un isotipo nuevo. Los
 * KPIs viven DENTRO del hero como una franja de cifras (números
 * protagonistas, separadores sutiles, ícono discreto por KPI) — mismos
 * datos/orden de siempre, solo presentación.
 *
 * Fase 6Q.3 (final polish): altura del hero reducida ~12% vs. 6Q.1/6Q.2
 * (menos padding vertical, iconos un poco más chicos) y el grid de KPIs
 * pasa de `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` a `grid-cols-2
 * lg:grid-cols-5` — en tablet (834px, breakpoint `sm` pero no `lg`) el
 * reparto 3+2 sin separadores se veía apretado/desbalanceado (problema
 * reportado explícitamente); 2 columnas limpias hasta desktop resuelve esa
 * lectura sin reducir tipografía.
 */
export function CommandCenterHeader({
  name,
  kpis,
  contextLabel,
  timezone,
}: {
  name: string;
  kpis?: HeroKpi[];
  /** THÖREN 6R.1C — sustituye el subtítulo genérico por uno derivado de role+capabilities (ver dashboard-view.tsx). */
  contextLabel?: string;
  /** THÖREN 7C — timezone de la organización activa (ver get-dashboard-data.ts); undefined cae al default global. */
  timezone?: string;
}) {
  const greeting = getBusinessGreeting(timezone);
  const today = formatDateLong(getBusinessToday(timezone));

  return (
    <div className="border-b border-black/10 bg-sidebar-bg">
      <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10 sm:py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-sidebar-ink sm:text-5xl">
              {greeting}
              {name ? `, ${name}` : ""}
            </h1>
            <p className="mt-2 text-base text-sidebar-ink-soft">{contextLabel ?? "Control total de tu operación."}</p>
          </div>
          <p className="flex shrink-0 items-center gap-1.5 text-sm text-sidebar-ink-soft sm:text-right">
            <Calendar className="h-3.5 w-3.5" />
            {today}
          </p>
        </div>

        {kpis && kpis.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-6 lg:grid-cols-5 lg:divide-x lg:divide-white/10">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="flex items-start gap-3 lg:px-8 lg:first:pl-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <kpi.icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-ink-soft">{kpi.label}</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-3xl font-semibold tabular-nums text-sidebar-ink">{kpi.value}</p>
                    {kpi.trend && (
                      <span className={`text-xs font-medium ${kpi.trend.positive ? "text-success" : "text-danger"}`}>
                        {kpi.trend.label}
                      </span>
                    )}
                  </div>
                  {kpi.helper && <p className="mt-1 text-xs text-sidebar-ink-soft/80">{kpi.helper}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
