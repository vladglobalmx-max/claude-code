import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/kpi";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardData } from "@/components/dashboard/get-dashboard-data";
import { RecentOrdersTable } from "@/components/dashboard/recent-orders-table";
import { StatusDistribution } from "@/components/dashboard/status-distribution";
import { OperationalStatusDistribution } from "@/components/dashboard/operational-status-distribution";
import { AttentionQueue } from "@/components/dashboard/attention-queue";
import { SalespersonPerformance } from "@/components/dashboard/salesperson-performance";
import { getBusinessMonthRange } from "@/lib/business-date";
import { formatNumber, formatPercentDelta } from "@/lib/utils/format";

/**
 * Render puro del Dashboard — separado de page.tsx para poder probarlo con
 * datos simulados (QA visual sin backend de Supabase disponible en este
 * entorno) usando exactamente el mismo código de presentación que
 * producción, nunca una reimplementación aparte.
 */
export function monthLabel(): string {
  const { start } = getBusinessMonthRange(0);
  const label = format(parseISO(start), "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardView({ data }: { data: DashboardData }) {
  const description = `Resumen operativo — ${monthLabel()}`;

  if (data.hasError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader title={`Hola, ${data.name}`} description={description} />
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          No se pudo cargar la información del Dashboard. Intenta recargar la página en unos momentos.
        </div>
      </div>
    );
  }

  if (!data.hasAnyOrders) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader title={`Hola, ${data.name}`} description={description} />
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={ClipboardList}
            title="Todavía no hay pedidos"
            description="En cuanto se cree el primer pedido, aquí aparecerá el resumen operativo."
          />
        </div>
      </div>
    );
  }

  const monthTrend = formatPercentDelta(data.monthOrderCount, data.previousMonthOrderCount);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title={`Hola, ${data.name}`} description={description} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi
          label="Pedidos del mes"
          value={formatNumber(data.monthOrderCount)}
          icon={FileText}
          trend={monthTrend ? { label: `${monthTrend} vs. mes anterior`, positive: !monthTrend.startsWith("-") } : null}
        />
        <Kpi label="Pedidos activos" value={formatNumber(data.activeOrderCount)} icon={AlertTriangle} />
        <Kpi label="Cerrados este mes" value={formatNumber(data.closedThisMonthCount)} icon={CheckCircle2} />
        <Kpi label="Clientes atendidos" value={formatNumber(data.distinctClientsThisMonth)} icon={Users} />
      </div>

      <div className="mt-6">
        <AttentionQueue rows={data.attentionQueue} />
      </div>

      <div className="mt-6">
        <RecentOrdersTable orders={data.recentOrders} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OperationalStatusDistribution breakdown={data.operationalStatusBreakdown} />
        <StatusDistribution breakdown={data.statusBreakdown} />
      </div>

      {data.salespersonBreakdown && (
        <div className="mt-6">
          <SalespersonPerformance rows={data.salespersonBreakdown} />
        </div>
      )}
    </div>
  );
}
