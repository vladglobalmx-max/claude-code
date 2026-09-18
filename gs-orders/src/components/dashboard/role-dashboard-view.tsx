import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DashboardMetricCard } from "./dashboard-metric-card";
import type { AttentionSeverity, DashboardCard, RoleDashboardData } from "./get-role-dashboard-data";

const SEVERITY_BADGE_VARIANT: Record<AttentionSeverity, "danger" | "warning" | "neutral"> = {
  vencido: "danger",
  atencion: "warning",
  pendiente: "neutral",
};

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  vencido: "Vencido",
  atencion: "Atención",
  pendiente: "Pendiente",
};

function CardGrid({ cards }: { cards: DashboardCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <DashboardMetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">{children}</h2>;
}

/**
 * THÖREN 0084 — Dashboard de Inicio por rol. Presentación pura: toda la
 * lógica de qué sección aplica ya se resolvió en get-role-dashboard-data.ts
 * (isAdmin/isCompras/isLogistica no excluyentes entre sí — ticket, punto
 * 5). Sin gráficas (alcance explícito del ticket): solo tarjetas de
 * conteo con link al módulo y la lista "Requiere atención" (solo Admin).
 */
export function RoleDashboardView({ data }: { data: RoleDashboardData }) {
  const {
    name,
    isAdmin,
    isCompras,
    isLogistica,
    adminCards,
    attentionItems,
    vendorCards,
    comprasCards,
    logisticaCards,
    activeWorkOrdersCount,
    hasError,
  } = data;

  if (hasError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <p className="text-sm font-medium text-ink">No se pudo cargar el dashboard completo</p>
          <p className="max-w-sm text-sm text-ink-faint">Ocurrió un error leyendo la información. Intenta recargar la página en unos momentos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Inicio" description={name ? `Hola, ${name}` : undefined} />

      <div className="space-y-8">
        {isAdmin && adminCards && (
          <section>
            <SectionTitle>Resumen general</SectionTitle>
            <CardGrid cards={adminCards} />
          </section>
        )}

        {!isAdmin && vendorCards && (
          <section>
            <SectionTitle>Mi resumen</SectionTitle>
            <CardGrid cards={vendorCards} />
          </section>
        )}

        {isCompras && comprasCards && (
          <section>
            <SectionTitle>Compras</SectionTitle>
            <CardGrid cards={comprasCards} />
          </section>
        )}

        {isLogistica && logisticaCards && (
          <section>
            <SectionTitle>Logística</SectionTitle>
            <CardGrid cards={logisticaCards} />
          </section>
        )}

        <section>
          <SectionTitle>Órdenes de Trabajo</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <DashboardMetricCard label="Órdenes de Trabajo activas" count={activeWorkOrdersCount} href="/pedidos" />
          </div>
        </section>

        {isAdmin && (
          <section>
            <SectionTitle>Requiere atención</SectionTitle>
            {attentionItems.length === 0 ? (
              <Card>
                <EmptyState icon={ClipboardList} title="Nada requiere atención por ahora" description="Los pendientes urgentes de todo el pipeline aparecerán aquí." />
              </Card>
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {attentionItems.map((item) => (
                  <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.label}</p>
                      <p className="truncate text-xs text-ink-faint">{item.description}</p>
                    </div>
                    <Badge variant={SEVERITY_BADGE_VARIANT[item.severity]} className="shrink-0">
                      {SEVERITY_LABEL[item.severity]}
                    </Badge>
                  </Link>
                ))}
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
