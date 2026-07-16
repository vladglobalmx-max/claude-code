import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { quotationScopeWhere } from "@/lib/quotations/scope";
import { getDashboardKpis } from "@/lib/dashboard/queries";
import { toCsv } from "@/lib/dashboard/csv";
import { QUOTATION_STATUS_LABELS } from "@/lib/quotations/status-labels";

/**
 * Ruta no-UI (docs/ARCHITECTURE.md §10, Módulo 13: "export PDF/Excel/CSV").
 * Solo CSV en este alcance — no se agregó una dependencia nueva para Excel
 * ni se reutilizó el motor de PDF del Módulo 9 (esa plantilla es para una
 * cotización individual, no para un reporte tabular). Mismo patrón de
 * defensa en profundidad que `/quotations/[id]/pdf`: no hereda el layout
 * de `(app)`, así que revalida sesión y alcance de visibilidad aquí.
 */
export async function GET() {
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);
  const where = quotationScopeWhere({ role, userId: session.user.id, businessUnitIds });
  if (!where) {
    return new Response("No tienes acceso a cotizaciones.", { status: 403 });
  }

  const { rows } = await getDashboardKpis(where);

  const csv = toCsv(
    ["Folio", "Línea", "Vendedor", "Estatus", "Total", "Margen %"],
    rows.map((row) => [
      row.folio,
      row.businessUnitCode,
      row.sellerName,
      QUOTATION_STATUS_LABELS[row.status],
      row.total.toString(),
      row.marginPct != null ? row.marginPct.toString() : "",
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="global-quote-dashboard.csv"',
    },
  });
}
