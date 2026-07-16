import { Decimal } from "decimal.js";

import type { QuotationStatus } from "@/generated/prisma/enums";

/**
 * KPIs comerciales (docs/ARCHITECTURE.md §9.2/§10, Módulo 13). Puro: no
 * toca la base de datos, mismo patrón que `approval-rules.ts` (Módulo 7) y
 * `followups/rules.ts` (Módulo 11) — así se puede probar la aritmética sin
 * Postgres y, en integración, solo hace falta verificar que la consulta
 * trae los campos correctos.
 *
 * La máquina de estados real (Módulo 6) colapsa el diagrama del brief
 * (§6.1: "Aceptada -> Convertida a pedido -> Cerrada ganada",
 * "Rechazada por cliente -> Cerrada perdida", "Vencida -> Cancelada") en
 * los estados que sí existen como código: ganado = `ACCEPTED` +
 * `CONVERTED_TO_ORDER`; perdido = `REJECTED` + `EXPIRED` + `CANCELLED`
 * (esta última hoy inalcanzable — no hay mutación que la dispare todavía
 * — pero se incluye para que la aritmética no se rompa el día que exista).
 * "Cotizado" es cualquier cotización que salió de edición libre — se
 * excluyen `DRAFT` y `PENDING_APPROVAL` porque el cliente todavía no la
 * ha visto.
 */

const WON_STATUSES: readonly QuotationStatus[] = ["ACCEPTED", "CONVERTED_TO_ORDER"];
const LOST_STATUSES: readonly QuotationStatus[] = ["REJECTED", "EXPIRED", "CANCELLED"];
const NOT_YET_QUOTED_STATUSES: readonly QuotationStatus[] = ["DRAFT", "PENDING_APPROVAL"];

export type KpiQuotationInput = {
  status: QuotationStatus;
  total: Decimal.Value;
  marginPct: Decimal.Value | null;
};

export type QuotationKpis = {
  quotedCount: number;
  quotedTotal: Decimal;
  wonCount: number;
  wonTotal: Decimal;
  lostCount: number;
  lostTotal: Decimal;
  /** null si no hay ni una sola cotización ganada o perdida todavía (nada que decidir). */
  conversionRatePct: Decimal | null;
  /** null si ninguna cotización cotizada tiene margen calculado (p. ej. sin partidas). */
  averageMarginPct: Decimal | null;
};

export function computeQuotationKpis(quotations: KpiQuotationInput[]): QuotationKpis {
  const quoted = quotations.filter((q) => !NOT_YET_QUOTED_STATUSES.includes(q.status));
  const won = quoted.filter((q) => WON_STATUSES.includes(q.status));
  const lost = quoted.filter((q) => LOST_STATUSES.includes(q.status));

  const sumTotal = (rows: KpiQuotationInput[]) =>
    rows.reduce((acc, q) => acc.plus(q.total), new Decimal(0));

  const decided = won.length + lost.length;
  const marginValues = quoted.flatMap((q) => (q.marginPct != null ? [new Decimal(q.marginPct)] : []));

  return {
    quotedCount: quoted.length,
    quotedTotal: sumTotal(quoted),
    wonCount: won.length,
    wonTotal: sumTotal(won),
    lostCount: lost.length,
    lostTotal: sumTotal(lost),
    conversionRatePct:
      decided === 0 ? null : new Decimal(won.length).dividedBy(decided).times(100),
    averageMarginPct:
      marginValues.length === 0
        ? null
        : marginValues.reduce((acc, v) => acc.plus(v), new Decimal(0)).dividedBy(marginValues.length),
  };
}

export type KpiGroup<TKey> = {
  key: TKey;
  kpis: QuotationKpis;
};

/**
 * Agrupa por línea de negocio o por vendedor (§9.2: "por línea/vendedor")
 * preservando el orden de primera aparición — no ordena alfabéticamente
 * para no imponer un criterio que la pantalla no pidió.
 */
export function groupQuotationKpis<TItem extends KpiQuotationInput, TKey>(
  items: TItem[],
  keyFn: (item: TItem) => TKey,
): KpiGroup<TKey>[] {
  const order: TKey[] = [];
  const buckets = new Map<TKey, TItem[]>();

  for (const item of items) {
    const key = keyFn(item);
    if (!buckets.has(key)) {
      order.push(key);
      buckets.set(key, []);
    }
    buckets.get(key)!.push(item);
  }

  return order.map((key) => ({ key, kpis: computeQuotationKpis(buckets.get(key)!) }));
}
