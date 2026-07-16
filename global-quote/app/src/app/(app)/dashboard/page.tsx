import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, ROLE_LABELS, hasPermission } from "@/lib/auth/permissions";
import { quotationScopeWhere } from "@/lib/quotations/scope";
import { getDashboardKpis } from "@/lib/dashboard/queries";
import type { QuotationKpis } from "@/lib/dashboard/kpis";

const currencyFormat = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "won" | "lost" }) {
  const toneClass =
    tone === "won"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "lost"
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function KpiBreakdownTable({
  title,
  columnLabel,
  groups,
  showMargin,
}: {
  title: string;
  columnLabel: string;
  groups: { key: string; kpis: QuotationKpis }[];
  showMargin: boolean;
}) {
  if (groups.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="py-2 pr-3">{columnLabel}</th>
              <th className="py-2 pr-3">Cotizado</th>
              <th className="py-2 pr-3">Ganado</th>
              <th className="py-2 pr-3">Perdido</th>
              <th className="py-2 pr-3">Conversión</th>
              {showMargin ? <th className="py-2 pr-3">Margen prom.</th> : null}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="py-2 pr-3 font-medium">{group.key}</td>
                <td className="py-2 pr-3">{currencyFormat(group.kpis.quotedTotal.toNumber())}</td>
                <td className="py-2 pr-3">{currencyFormat(group.kpis.wonTotal.toNumber())}</td>
                <td className="py-2 pr-3">{currencyFormat(group.kpis.lostTotal.toNumber())}</td>
                <td className="py-2 pr-3">
                  {group.kpis.conversionRatePct != null
                    ? `${group.kpis.conversionRatePct.toDecimalPlaces(1).toString()}%`
                    : "—"}
                </td>
                {showMargin ? (
                  <td className="py-2 pr-3">
                    {group.kpis.averageMarginPct != null
                      ? `${group.kpis.averageMarginPct.toDecimalPlaces(1).toString()}%`
                      : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role;

  const businessUnits = await prisma.businessUnit.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
  });

  const canViewCosts = hasPermission(role, PERMISSIONS.VIEW_COSTS);
  const canViewAudit = hasPermission(role, PERMISSIONS.VIEW_AUDIT);
  const canViewMarginPct = canViewCosts || hasPermission(role, PERMISSIONS.VIEW_MARGIN_PCT);
  const canViewBreakdowns =
    hasPermission(role, PERMISSIONS.VIEW_ALL_QUOTATIONS) ||
    hasPermission(role, PERMISSIONS.VIEW_TEAM_QUOTATIONS);

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const scopeWhere = quotationScopeWhere({
    role,
    userId: session.user.id,
    businessUnitIds: userBusinessUnits.map((ubu) => ubu.businessUnitId),
  });
  const kpis = scopeWhere ? await getDashboardKpis(scopeWhere) : null;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Bienvenido, {session.user.fullName}
        </h1>
        <p className="text-sm text-zinc-500">Rol: {ROLE_LABELS[role]}</p>
      </div>

      {kpis ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Indicadores comerciales
            </h2>
            <a
              href="/dashboard/export.csv"
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Exportar CSV
            </a>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            docs/ARCHITECTURE.md §9.2 — cotizado, ganado, perdido y conversión, dentro de tu
            alcance de visibilidad (mismo criterio que /quotations).
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Cotizado" value={currencyFormat(kpis.overall.quotedTotal.toNumber())} />
            <KpiCard
              label={`Ganado (${kpis.overall.wonCount})`}
              value={currencyFormat(kpis.overall.wonTotal.toNumber())}
              tone="won"
            />
            <KpiCard
              label={`Perdido (${kpis.overall.lostCount})`}
              value={currencyFormat(kpis.overall.lostTotal.toNumber())}
              tone="lost"
            />
            <KpiCard
              label="Tasa de conversión"
              value={
                kpis.overall.conversionRatePct != null
                  ? `${kpis.overall.conversionRatePct.toDecimalPlaces(1).toString()}%`
                  : "—"
              }
            />
          </div>

          {canViewMarginPct ? (
            <div className="mt-3">
              <KpiCard
                label="Margen promedio"
                value={
                  kpis.overall.averageMarginPct != null
                    ? `${kpis.overall.averageMarginPct.toDecimalPlaces(1).toString()}%`
                    : "—"
                }
              />
            </div>
          ) : null}

          {canViewBreakdowns ? (
            <div className="mt-5 flex flex-col gap-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <KpiBreakdownTable
                title="Por línea de negocio"
                columnLabel="Línea"
                groups={kpis.byBusinessUnit}
                showMargin={canViewMarginPct}
              />
              <KpiBreakdownTable
                title="Por vendedor"
                columnLabel="Vendedor"
                groups={kpis.bySeller}
                showMargin={canViewMarginPct}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Líneas de negocio ({businessUnits.length})
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {businessUnits.map((bu) => (
            <li
              key={bu.id}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{bu.code}</p>
              <p className="text-xs text-zinc-500">{bu.name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Visibilidad de costos y márgenes (RBAC)
        </h2>
        {canViewCosts ? (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            Tu rol puede ver costos y márgenes monetarios en el catálogo (/products) y el margen
            promedio de este dashboard.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Tu rol no tiene permiso para ver costos ni utilidad monetaria — el servidor nunca
            envía esos campos a este usuario (docs/ARCHITECTURE.md §3.1).
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Auditoría</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {canViewAudit ? (
            <>
              Tu rol puede consultar el registro de auditoría real en{" "}
              <a href="/admin/audit" className="underline">
                /admin/audit
              </a>{" "}
              (Módulo 10).
            </>
          ) : (
            "Tu rol no tiene acceso al registro de auditoría."
          )}
        </p>
      </section>
    </div>
  );
}
