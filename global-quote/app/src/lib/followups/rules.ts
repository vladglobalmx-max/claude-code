import { Decimal } from "decimal.js";

import type { QuotationStatus } from "@/generated/prisma/enums";

/**
 * Motor de seguimiento (docs/ARCHITECTURE.md §5.2/§6.1/§10). Puro: no toca
 * la base de datos, para poder probarlo sin Postgres — mismo patrón que
 * `approval-rules.ts` (Módulo 7).
 */

const TERMINAL_STATUSES: readonly QuotationStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "CONVERTED_TO_ORDER",
];

/**
 * §6.1: "Vencida se dispara automáticamente (cron) cuando now() >
 * valid_until y el estado sigue en Enviada/Vista por cliente/En
 * seguimiento/Negociación." Nuestra máquina de estados (Módulo 6) colapsa
 * esos cuatro en un solo `SENT`, así que la regla es simplemente
 * `status === "SENT"`.
 */
export function isQuotationExpired(input: {
  status: QuotationStatus;
  validUntil: Date | null;
  now: Date;
}): boolean {
  return input.status === "SENT" && input.validUntil != null && input.validUntil.getTime() < input.now.getTime();
}

export type FollowupBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "NONE" | "DONE";

/**
 * Agrupación de la pantalla de Seguimientos (docs/ARCHITECTURE.md §9):
 * Hoy · Vencidos · Próximos · Completados. "Completados" es cualquier
 * cotización que ya llegó a un estado terminal — no requiere más
 * seguimiento sin importar qué diga `nextFollowupAt`.
 */
export function followupBucket(input: {
  quotationStatus: QuotationStatus;
  nextFollowupAt: Date | null;
  now: Date;
}): FollowupBucket {
  if (TERMINAL_STATUSES.includes(input.quotationStatus)) return "DONE";
  if (!input.nextFollowupAt) return "NONE";

  const startOfToday = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  if (input.nextFollowupAt.getTime() < startOfToday.getTime()) return "OVERDUE";
  if (input.nextFollowupAt.getTime() < startOfTomorrow.getTime()) return "TODAY";
  return "UPCOMING";
}

/** `weighted_amount` (§5.2) es "calculado" — nunca se guarda en base de datos. */
export function computeWeightedAmount(
  total: Decimal.Value,
  closeProbabilityPct: Decimal.Value | null,
): Decimal | null {
  if (closeProbabilityPct == null) return null;
  return new Decimal(total).times(new Decimal(closeProbabilityPct).dividedBy(100));
}
