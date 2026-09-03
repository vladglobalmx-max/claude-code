import { ClipboardList, FileText, PackageCheck, Boxes, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardData } from "@/components/dashboard/get-dashboard-data";
import { CommandCenterHeader, type HeroKpi } from "@/components/dashboard/command-center-header";
import { OperationalFlow, buildOperationalFlowStages } from "@/components/dashboard/operational-flow";
import { RecentOrdersTable } from "@/components/dashboard/recent-orders-table";
import { OperationalStatusDistribution } from "@/components/dashboard/operational-status-distribution";
import { OrdersByBusinessUnit } from "@/components/dashboard/orders-by-business-unit";
import { AttentionQueue } from "@/components/dashboard/attention-queue";
import { ThorenIntelligence, buildThorenInsights } from "@/components/dashboard/thoren-intelligence";
import { UpcomingDeliveries } from "@/components/dashboard/upcoming-deliveries";
import { PurchaseOrdersInTransit } from "@/components/dashboard/purchase-orders-in-transit";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { buildQuickActions } from "@/lib/dashboard/quick-actions";
import { getBusinessMonthRange } from "@/lib/business-date";
import { formatNumber, formatPercentDelta } from "@/lib/utils/format";

/**
 * THÖREN 6R.1C — Home contextual por role+capabilities (nunca por
 * email/nombre). "Vista global" = admin pleno O cualquier capability que ya
 * habilita ver ventas de toda la organización (can_view_all_sales, ver
 * 0041) — es la única capability de este tipo ya cableada (DECISIÓN:
 * can_view_global_dashboard permanece sin activar, ver auditoría 6R.1C).
 */
function isGlobalView(data: DashboardData): boolean {
  return data.role === "admin" || data.capabilities.has("can_view_all_sales");
}

function buildContextLabel(data: DashboardData): string {
  if (data.role === "admin") return "Vista general de la organización";
  if (data.capabilities.has("can_view_all_sales")) return "Vista global de ventas";
  return "Tu actividad comercial";
}

const KPI_IDS = [
  "pedidos-mes",
  "pedidos-activos",
  "unidades-entregar",
  "unidades-comprometidas",
  "ordenes-compra-abiertas",
] as const;

/**
 * THÖREN 6R.1C — prioridad de los 5 KPIs del hero (mismos 5 de siempre,
 * nunca se agregan/quitan, ver DECISIÓN en get-dashboard-data.ts). Los
 * roles operativos/logística (Rodolfo: entregas y/o recepción) necesitan
 * ver primero lo que van a atender hoy, no "Pedidos del mes" — el resto de
 * los actores (admin, vista global de ventas, vendedor normal) usa el
 * orden comercial por defecto.
 */
function buildKpiOrder(data: DashboardData): (typeof KPI_IDS)[number][] {
  const isLogisticsFocused =
    data.role !== "admin" &&
    (data.capabilities.has("can_manage_deliveries") || data.capabilities.has("can_receive_inventory"));

  if (isLogisticsFocused) {
    return ["unidades-entregar", "ordenes-compra-abiertas", "unidades-comprometidas", "pedidos-activos", "pedidos-mes"];
  }

  return ["pedidos-mes", "pedidos-activos", "unidades-entregar", "unidades-comprometidas", "ordenes-compra-abiertas"];
}

/**
 * Render puro del Dashboard — separado de page.tsx para poder probarlo con
 * datos simulados (QA visual sin backend de Supabase disponible en este
 * entorno) usando exactamente el mismo código de presentación que
 * producción, nunca una reimplementación aparte.
 *
 * =========================================================================
 * DECISIÓN — jerarquía visual (Fase 6Q.1)
 * =========================================================================
 * El hero (CommandCenterHeader) rompe intencionalmente el contenedor de
 * ancho máximo — vive a todo el ancho del área de contenido, no como una
 * card oscura flotando sobre la página (ver DECISIÓN en ese componente).
 * El resto del contenido (Flujo Operativo, Atención Ejecutiva, Analítica,
 * resúmenes) sí vive dentro de un contenedor con max-width — "Rendimiento
 * por vendedor" (SalespersonPerformance) deja de renderizarse aquí a
 * propósito (Inicio es un Command Center, no un reporte comercial) — el
 * componente y su lógica siguen intactos, solo no se invocan desde esta
 * vista, igual criterio que StatusDistribution (legacy) desde 6Q.
 */
export function monthLabel(timezone?: string): string {
  const { start } = getBusinessMonthRange(0, timezone);
  const label = format(parseISO(start), "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardView({ data }: { data: DashboardData }) {
  if (data.hasError) {
    return (
      <div>
        <CommandCenterHeader name={data.name} timezone={data.timezone} />
        <div className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10">
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            No se pudo cargar la información del Command Center. Intenta recargar la página en unos momentos.
          </div>
        </div>
      </div>
    );
  }

  if (!data.hasAnyOrders) {
    return (
      <div>
        <CommandCenterHeader name={data.name} timezone={data.timezone} />
        <div className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10">
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState
              icon={ClipboardList}
              title="Todavía no hay pedidos"
              description="En cuanto se cree el primer pedido, aquí aparecerá el resumen operativo."
            />
          </div>
        </div>
      </div>
    );
  }

  const monthTrend = formatPercentDelta(data.monthOrderCount, data.previousMonthOrderCount);
  const flowStages = buildOperationalFlowStages(data);
  const criticalAttentionCount = data.attentionQueue.filter(
    (row) => row.attentionLevel === "critico" || row.dueDateStatus === "vencido"
  ).length;
  const { headline: intelligenceHeadline, insights } = buildThorenInsights({
    criticalAttentionCount,
    deliveriesUpcomingCount: data.deliveriesUpcomingCount,
    purchaseOrdersOpenCount: data.purchaseOrdersOpenCount,
  });
  // Fase 6Q.3 — "Atención ejecutiva" en Inicio muestra máximo 5 (resumen
  // ejecutivo, no el listado completo — para eso está /pedidos, que ya
  // recibe las hasta ATTENTION_QUEUE_LIMIT=15 filas sin recortar).
  const attentionQueuePreview = data.attentionQueue.slice(0, 5);

  // THÖREN 6R.1C — los 5 KPIs de siempre (mismos datos/labels/helpers, ver
  // DECISIÓN arriba), reordenados por role+capabilities vía buildKpiOrder().
  const kpiByid: Record<(typeof KPI_IDS)[number], HeroKpi> = {
    "pedidos-mes": {
      label: "Pedidos del mes",
      value: formatNumber(data.monthOrderCount),
      trend: monthTrend ? { label: `${monthTrend} vs. mes anterior`, positive: !monthTrend.startsWith("-") } : null,
      icon: FileText,
    },
    "pedidos-activos": {
      label: "Pedidos activos",
      value: formatNumber(data.activeOperationalOrderCount),
      helper: "En el pipeline operativo",
      icon: ClipboardList,
    },
    "unidades-entregar": {
      // Fase 6Q — Hotfix semántico: el valor es una cantidad de UNIDADES
      // físicas (pendingToDeliverUnitsTotal), no un conteo de Pedidos —
      // el label lo hace explícito para no confundirlo con "96 pedidos".
      label: "Unidades por entregar",
      value: formatNumber(data.pendingToDeliverUnitsTotal),
      helper: "Surtidas, pendientes de entrega",
      icon: PackageCheck,
    },
    "unidades-comprometidas": {
      // Fase 6Q — Hotfix semántico: mismo criterio — es un total de
      // UNIDADES (committedUnitsTotal), no un conteo de productos/pedidos.
      label: "Unidades comprometidas",
      value: formatNumber(data.committedUnitsTotal),
      helper: "Reservadas para pedidos activos",
      icon: Boxes,
    },
    "ordenes-compra-abiertas": {
      // Fase 6Q — Hotfix semántico: el valor es purchaseOrdersOpenCount —
      // TODAS las Purchase Orders abiertas (fuera de recibida/cancelada),
      // sin importar su status puntual. NO es un subconjunto "realmente en
      // tránsito" (no existe ese cálculo por separado) — por eso el label
      // dice "Órdenes de compra abiertas", igual que en THÖREN Intelligence
      // y en el bloque "Órdenes de compra abiertas" más abajo: una sola
      // métrica, una sola forma de nombrarla en todo Inicio.
      label: "Órdenes de compra abiertas",
      value: formatNumber(data.purchaseOrdersOpenCount),
      helper: `${formatNumber(data.incomingUnitsTotal)} unidades en camino`,
      icon: Package,
    },
  };
  const kpis: HeroKpi[] = buildKpiOrder(data).map((id) => kpiByid[id]);

  const globalView = isGlobalView(data);
  const contextLabel = buildContextLabel(data);
  const quickActions = buildQuickActions(data.role, data.capabilities);
  const flowTitle = globalView ? "Flujo operativo de la organización" : "Tu flujo operativo";
  const attentionTitle = globalView ? "Atención ejecutiva" : "Tus pendientes";

  return (
    <div>
      <CommandCenterHeader name={data.name} kpis={kpis} contextLabel={contextLabel} timezone={data.timezone} />

      <div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10 lg:py-16">
        {/* Accesos rápidos — hasta 3-4 acciones derivadas de role+capabilities. */}
        {quickActions.length > 0 && (
          <div className="mb-12">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">Accesos rápidos</p>
            <QuickActions actions={quickActions} />
          </div>
        )}

        {/* Flujo operativo — pieza distintiva, sin card propia. */}
        <OperationalFlow stages={flowStages} title={flowTitle} />

        {/* Atención ejecutiva + THÖREN Intelligence */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <AttentionQueue rows={attentionQueuePreview} title={attentionTitle} compact />
          </div>
          <ThorenIntelligence headline={intelligenceHeadline} insights={insights} />
        </div>

        {/* Analítica secundaria — deliberadamente ligera, sin competir con lo anterior. */}
        <div className="mt-16 grid grid-cols-1 gap-10 border-t border-border pt-10 sm:grid-cols-2">
          <OrdersByBusinessUnit rows={data.ordersByBusinessUnit} monthLabel={monthLabel(data.timezone)} />
          <OperationalStatusDistribution breakdown={data.operationalStatusBreakdown} />
        </div>

        {/* Resúmenes operativos */}
        <div className="mt-20 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RecentOrdersTable orders={data.recentOrders} />
          <UpcomingDeliveries rows={data.deliveriesUpcoming} totalCount={data.deliveriesUpcomingCount} />
          <PurchaseOrdersInTransit rows={data.purchaseOrdersInTransit} totalCount={data.purchaseOrdersOpenCount} />
        </div>
      </div>
    </div>
  );
}
