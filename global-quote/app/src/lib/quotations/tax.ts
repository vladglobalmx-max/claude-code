import { Decimal } from "decimal.js";

/**
 * Tasa única por cotización (docs/ARCHITECTURE.md §5.2, catálogo `taxes`
 * del Módulo 2): aditiva sobre `total` (el neto después de descuento, sin
 * impuesto — ver comentario en `prisma/schema.prisma` sobre por qué
 * `total` no cambia de significado). `null` es "sin impuesto elegido".
 */
export function computeTaxTotal(total: Decimal.Value, taxRatePct: Decimal.Value | null): Decimal {
  if (taxRatePct == null) return new Decimal(0);
  return new Decimal(total).times(new Decimal(taxRatePct).dividedBy(100));
}
