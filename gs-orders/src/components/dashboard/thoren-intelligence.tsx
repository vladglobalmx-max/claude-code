import { AlertTriangle, PackageCheck, Sparkles, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

/**
 * THÖREN Fase 6Q/6Q.1/6Q.2/6Q.3 — "THÖREN Intelligence": zona reservada
 * para evolucionar a futuro (§16 del enunciado original), hoy 100%
 * determinística — cero LLM, cero conclusión que no se pueda demostrar con
 * datos ya calculados en get-dashboard-data.ts (ningún número nuevo nace
 * aquí).
 *
 * Fase 6Q.3 — DECISIÓN: el color del ícono de "pedidos críticos" es la
 * ÚNICA señal condicional (rojo si > 0, neutral si 0) — un 0 nunca se
 * presenta con el color de alerta, para no "mostrar 0 alertas como si
 * fueran un problema". Entregas próximas/Compras abiertas son hechos
 * operativos, no alertas — su ícono usa siempre el acento cobre, nunca
 * ámbar/rojo (ámbar/rojo solo tienen significado cuando hay riesgo real de
 * incumplimiento, que ya vive en attention-queue.ts/due-dates.ts, no aquí).
 * El titular (headline) es la única frase ejecutiva nueva — deriva
 * exclusivamente de criticalAttentionCount, ya calculado en dashboard-view.tsx.
 */
export interface ThorenInsight {
  value: number;
  text: string;
  icon: LucideIcon;
  iconColorClassName: string;
}

export function buildThorenInsights(data: {
  criticalAttentionCount: number;
  deliveriesUpcomingCount: number;
  purchaseOrdersOpenCount: number;
}): { headline: string; insights: ThorenInsight[] } {
  const headline =
    data.criticalAttentionCount > 0
      ? `${formatNumber(data.criticalAttentionCount)} pedido${
          data.criticalAttentionCount === 1 ? "" : "s"
        } requiere${data.criticalAttentionCount === 1 ? "" : "n"} atención inmediata.`
      : "Tu operación no presenta alertas críticas en este momento.";

  const insights: ThorenInsight[] = [
    {
      value: data.criticalAttentionCount,
      text: data.criticalAttentionCount === 1 ? "pedido crítico" : "pedidos críticos",
      icon: AlertTriangle,
      iconColorClassName: data.criticalAttentionCount > 0 ? "bg-danger/15 text-danger" : "bg-white/10 text-sidebar-ink-soft",
    },
    {
      value: data.deliveriesUpcomingCount,
      text: data.deliveriesUpcomingCount === 1 ? "entrega próxima" : "entregas próximas",
      icon: PackageCheck,
      iconColorClassName: "bg-accent/15 text-accent",
    },
    {
      // Fase 6Q — Hotfix semántico: "orden de compra", no "compra" a secas
      // — mismo wording que el KPI del hero y el bloque inferior, misma
      // métrica exacta (purchaseOrdersOpenCount) en los tres lugares.
      value: data.purchaseOrdersOpenCount,
      text: data.purchaseOrdersOpenCount === 1 ? "orden de compra abierta" : "órdenes de compra abiertas",
      icon: Truck,
      iconColorClassName: "bg-accent/15 text-accent",
    },
  ];

  return { headline, insights };
}

export function ThorenIntelligence({ headline, insights }: { headline: string; insights: ThorenInsight[] }) {
  return (
    <div className="flex h-full flex-col rounded-xl bg-sidebar-bg p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sidebar-ink-soft">THÖREN Intelligence</p>
      </div>
      <p className="mt-4 text-sm font-medium text-sidebar-ink">{headline}</p>
      <ul className="mt-5 space-y-4">
        {insights.map((insight) => (
          <li key={insight.text} className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${insight.iconColorClassName}`}>
              <insight.icon className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-sidebar-ink">{formatNumber(insight.value)}</span>
              <span className="text-sm text-sidebar-ink-soft">{insight.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
