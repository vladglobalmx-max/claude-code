import { Decimal } from "decimal.js";

import { computeMarginPctFromSalePrice } from "@/lib/catalog/margin";
import type { RoleCode } from "@/generated/prisma/enums";

/**
 * Motor de reglas de autorizacion (docs/ARCHITECTURE.md §8.2/§12). Puro:
 * no toca la base de datos, para poder probarlo sin Postgres y para que
 * `recomputeQuotationTotals` y `submitQuotation` (mutations.ts) usen
 * exactamente la misma logica sin duplicarla.
 */

export const AMOUNT_THRESHOLD_MXN = 500_000;
export const VALIDITY_MAX_DAYS = 30;

export type ApprovalRuleType =
  | "MARGIN_BELOW_MIN"
  | "AMOUNT_OVER_THRESHOLD"
  | "VALIDITY_OVER_30_DAYS"
  | "DISCOUNT_OVER_LIMIT";

export type ApprovalTrigger = { ruleType: ApprovalRuleType; message: string };

type ItemForApproval = {
  unitPrice: Decimal.Value;
  discountPct: Decimal.Value;
  landedCostSnapshot: Decimal.Value | null;
  minMarginPctSnapshot: Decimal.Value | null;
};

/**
 * Orden de severidad: las reglas que solo Dirección General puede aprobar
 * van primero, para que si una cotización dispara varias, el registro de
 * autorización (quotation_approvals) quede con la de mayor jerarquía.
 */
const RULE_PRIORITY: ApprovalRuleType[] = [
  "MARGIN_BELOW_MIN",
  "AMOUNT_OVER_THRESHOLD",
  "VALIDITY_OVER_30_DAYS",
  "DISCOUNT_OVER_LIMIT",
];

export function computeApprovalTriggers(input: {
  items: ItemForApproval[];
  discountLimitPct: Decimal.Value | null;
  total: Decimal.Value;
  validUntil: Date | null;
  createdAt: Date;
}): ApprovalTrigger[] {
  const triggers: ApprovalTrigger[] = [];

  const belowMinMarginCount = input.items.filter((item) => {
    if (item.minMarginPctSnapshot == null || item.landedCostSnapshot == null) return false;
    const salePrice = new Decimal(item.unitPrice).times(
      new Decimal(1).minus(new Decimal(item.discountPct).dividedBy(100)),
    );
    if (salePrice.lessThanOrEqualTo(0)) return true;
    const itemMarginPct = computeMarginPctFromSalePrice({
      landedCost: item.landedCostSnapshot,
      salePrice,
    });
    return itemMarginPct.lessThan(new Decimal(item.minMarginPctSnapshot));
  }).length;
  if (belowMinMarginCount > 0) {
    triggers.push({
      ruleType: "MARGIN_BELOW_MIN",
      message: `Margen por debajo del mínimo en ${belowMinMarginCount} producto(s) — requiere autorización de Dirección General.`,
    });
  }

  if (new Decimal(input.total).greaterThan(AMOUNT_THRESHOLD_MXN)) {
    triggers.push({
      ruleType: "AMOUNT_OVER_THRESHOLD",
      message: `El total supera $${AMOUNT_THRESHOLD_MXN.toLocaleString("es-MX")} MXN — requiere autorización de Dirección General.`,
    });
  }

  if (input.validUntil) {
    const days = Math.round(
      (input.validUntil.getTime() - input.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (days > VALIDITY_MAX_DAYS) {
      triggers.push({
        ruleType: "VALIDITY_OVER_30_DAYS",
        message: `Vigencia de ${days} días excede el máximo de ${VALIDITY_MAX_DAYS} sin autorización.`,
      });
    }
  }

  const overLimitCount =
    input.discountLimitPct != null
      ? input.items.filter((item) =>
          new Decimal(item.discountPct).greaterThan(new Decimal(input.discountLimitPct!)),
        ).length
      : 0;
  if (overLimitCount > 0) {
    triggers.push({
      ruleType: "DISCOUNT_OVER_LIMIT",
      message: `Descuento aplicado excede tu límite autorizado de ${input.discountLimitPct}% en ${overLimitCount} producto(s).`,
    });
  }

  return triggers.sort((a, b) => RULE_PRIORITY.indexOf(a.ruleType) - RULE_PRIORITY.indexOf(b.ruleType));
}

/**
 * Autoridad requerida por regla (docs/ARCHITECTURE.md §12). Independiente
 * del permiso general `quotations.approve_exception`: tener el permiso
 * permite entrar al panel de autorizaciones, pero no aprobar cualquier
 * regla — Administración, por ejemplo, no tiene autoridad sobre margen ni
 * descuento en este alcance (solo la tendría sobre crédito especial,
 * modulo futuro).
 */
export function canApproveRule(role: RoleCode, ruleType: ApprovalRuleType): boolean {
  if (role === "SUPER_ADMIN") return true;
  switch (ruleType) {
    case "MARGIN_BELOW_MIN":
    case "AMOUNT_OVER_THRESHOLD":
      return role === "DIRECCION_GENERAL";
    case "VALIDITY_OVER_30_DAYS":
    case "DISCOUNT_OVER_LIMIT":
      return role === "GERENTE_VENTAS" || role === "DIRECCION_GENERAL";
    default:
      return false;
  }
}

export const APPROVAL_RULE_LABELS: Record<ApprovalRuleType, string> = {
  MARGIN_BELOW_MIN: "Margen por debajo del mínimo",
  AMOUNT_OVER_THRESHOLD: "Monto superior al umbral",
  VALIDITY_OVER_30_DAYS: "Vigencia superior a 30 días",
  DISCOUNT_OVER_LIMIT: "Descuento fuera de política",
};
