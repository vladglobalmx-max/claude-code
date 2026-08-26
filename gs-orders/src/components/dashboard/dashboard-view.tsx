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
import { getBusinessMonthRange } from "@/lib/business-date";
import { formatNumber, formatPercentDelta } from "@/lib/utils/format";

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
export function monthLabel(): string {
  const { start } = getBusinessMonthRange(0);
  const label = format(parseISO(start), "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardView({ data }: { data: DashboardData }) {
  if (data.hasError) {
    return (
      <div>
        <CommandCenterHeader name={data.name} />
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
        <CommandCenterHeader name={data.name} />
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

  const kpis: HeroKpi[] = [
    {
      label: "Pedidos del mes",
      value: formatNumber(data.monthOrderCount),
      trend: monthTrend ? { label: `${monthTrend} vs. mes anterior`, positive: !monthTrend.startsWith("-") } : null,
      icon: FileText,
    },
    {
      label: "Pedidos activos",
      value: formatNumber(data.activeOperationalOrderCount),
      helper: "En el pipeline operativo",
      icon: ClipboardList,
    },
    {
      label: "Por entregar",
      value: formatNumber(data.pendingToDeliverUnitsTotal),
      helper: "Unidades surtidas, pendientes",
      icon: PackageCheck,
    },
    {
      label: "Inventario comprometido",
      value: formatNumber(data.committedUnitsTotal),
      helper: "Unidades reservadas",
      icon: Boxes,
    },
    {
      label: "Compras en tránsito",
      value: formatNumber(data.purchaseOrdersOpenCount),
      helper: `${formatNumber(data.incomingUnitsTotal)} unidades en camino`,
      icon: Package,
    },
  ];

  return (
    <div>
      <CommandCenterHeader name={data.name} kpis={kpis} />

      <div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10 lg:py-16">
        {/* Flujo operativo — pieza distintiva, sin card propia. */}
        <OperationalFlow stages={flowStages} />

        {/* Atención ejecutiva + THÖREN Intelligence */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <AttentionQueue rows={attentionQueuePreview} title="Atención ejecutiva" compact />
          </div>
          <ThorenIntelligence headline={intelligenceHeadline} insights={insights} />
        </div>

        {/* Analítica secundaria — deliberadamente ligera, sin competir con lo anterior. */}
        <div className="mt-16 grid grid-cols-1 gap-10 border-t border-border pt-10 sm:grid-cols-2">
          <OrdersByBusinessUnit rows={data.ordersByBusinessUnit} monthLabel={monthLabel()} />
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
