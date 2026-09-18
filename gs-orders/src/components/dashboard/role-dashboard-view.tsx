import { AlertTriangle, Briefcase, Package, PackageCheck, FileText, ClipboardList } from "lucide-react";
import { DashboardHero } from "./dashboard-hero";
import { DashboardQuickActions } from "./dashboard-quick-actions";
import { DashboardBlockSection } from "./dashboard-block-section";
import { DashboardAttentionPanel } from "./dashboard-attention-panel";
import { DashboardTodayPanel } from "./dashboard-today-panel";
import { DashboardMetricCard } from "./dashboard-metric-card";
import type { RoleDashboardData } from "./get-role-dashboard-data";

/**
 * THÖREN 0085 — rediseño visual del dashboard de Inicio (0084). Presentación
 * pura: toda la lógica de qué sección aplica ya se resolvió en
 * get-role-dashboard-data.ts. Sin gráficas (alcance explícito del ticket).
 *
 * Distribución (ticket, punto 4): Admin usa el layout completo de Command
 * Center — hero, quick actions, grid 65/35 (bloques + atención a la
 * izquierda, "Hoy" a la derecha). El resto de personas (Vendedor/Compras/
 * Logística) no tienen "Requiere atención" ni panel "Hoy" en el alcance de
 * este ticket (ninguno de los dos existía para ellas en V1 tampoco) — se
 * quedan con hero + quick actions + sus bloques en una sola columna.
 */
export function RoleDashboardView({ data }: { data: RoleDashboardData }) {
  const {
    name,
    timezone,
    isAdmin,
    isCompras,
    isLogistica,
    canCreatePurchaseOrder,
    heroKpis,
    adminComercialCards,
    adminComprasCards,
    adminOperacionCards,
    attentionItems,
    todayPanel,
    vendorCards,
    comprasCards,
    logisticaCards,
    activeWorkOrdersCount,
    hasError,
  } = data;

  if (hasError) {
    return (
      <div>
        <DashboardHero name={name} timezone={timezone} kpis={[]} />
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-danger" />
            <p className="text-sm font-medium text-ink">No se pudo cargar el dashboard completo</p>
            <p className="max-w-sm text-sm text-ink-faint">Ocurrió un error leyendo la información. Intenta recargar la página en unos momentos.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHero name={name} timezone={timezone} kpis={heroKpis} />

      <div className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10">
        <div className="mb-8">
          <DashboardQuickActions canCreatePurchaseOrder={canCreatePurchaseOrder} />
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-8">
              <div className="space-y-8">
                {adminComercialCards && <DashboardBlockSection title="Comercial" icon={Briefcase} cards={adminComercialCards} />}
                {adminComprasCards && <DashboardBlockSection title="Compras" icon={Package} cards={adminComprasCards} />}
                {adminOperacionCards && <DashboardBlockSection title="Operación" icon={PackageCheck} cards={adminOperacionCards} />}
              </div>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-ink-faint" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Requiere atención</h2>
                </div>
                <DashboardAttentionPanel items={attentionItems} />
              </section>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">{todayPanel && <DashboardTodayPanel items={todayPanel} />}</div>
          </div>
        ) : (
          <div className="space-y-8">
            {vendorCards && <DashboardBlockSection title="Mi resumen" icon={Briefcase} cards={vendorCards} />}
            {isCompras && comprasCards && <DashboardBlockSection title="Compras" icon={Package} cards={comprasCards} />}
            {isLogistica && logisticaCards && <DashboardBlockSection title="Logística" icon={PackageCheck} cards={logisticaCards} />}

            <section>
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-ink-faint" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Órdenes de Trabajo</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <DashboardMetricCard label="Órdenes de Trabajo activas" count={activeWorkOrdersCount} href="/pedidos" icon={FileText} compact />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
