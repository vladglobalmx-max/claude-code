import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  computeQuotationKpis,
  groupQuotationKpis,
  type KpiGroup,
  type QuotationKpis,
} from "@/lib/dashboard/kpis";

export type DashboardKpiRow = {
  folio: string;
  status: Prisma.QuotationGetPayload<object>["status"];
  total: Prisma.Decimal;
  marginPct: Prisma.Decimal | null;
  businessUnitCode: string;
  sellerId: string;
  sellerName: string;
};

export type DashboardKpis = {
  overall: QuotationKpis;
  byBusinessUnit: KpiGroup<string>[];
  bySeller: KpiGroup<string>[];
  rows: DashboardKpiRow[];
};

/**
 * Trae las cotizaciones dentro del alcance de visibilidad ya resuelto
 * (`quotationScopeWhere`, reutilizado sin cambios — igual que `/followups`
 * en el Módulo 11) y calcula los KPIs con las funciones puras de
 * `dashboard/kpis.ts`. Separado de la página para que el mismo dataset
 * sirva tanto a `/dashboard` como a la exportación CSV, sin recalcular
 * dos veces contra Postgres.
 */
export async function getDashboardKpis(where: Prisma.QuotationWhereInput): Promise<DashboardKpis> {
  const quotations = await prisma.quotation.findMany({
    where,
    select: {
      folio: true,
      status: true,
      total: true,
      marginPct: true,
      businessUnit: { select: { code: true } },
      seller: { select: { id: true, fullName: true } },
    },
  });

  const rows: DashboardKpiRow[] = quotations.map((quotation) => ({
    folio: quotation.folio,
    status: quotation.status,
    total: quotation.total,
    marginPct: quotation.marginPct,
    businessUnitCode: quotation.businessUnit.code,
    sellerId: quotation.seller.id,
    sellerName: quotation.seller.fullName,
  }));

  return {
    overall: computeQuotationKpis(rows),
    byBusinessUnit: groupQuotationKpis(rows, (row) => row.businessUnitCode),
    bySeller: groupQuotationKpis(rows, (row) => row.sellerName),
    rows,
  };
}
