import { Decimal } from "decimal.js";

export type MarginInput = Decimal.Value;

/**
 * Motor unico de margen del sistema (docs/ARCHITECTURE.md §8.1).
 * Margen = utilidad / precio de venta. Nunca markup (utilidad / costo).
 * Ningun otro modulo debe recalcular estas formulas por su cuenta.
 */

export function computeLandedCost(input: {
  purchaseCost: MarginInput;
  logisticsCost: MarginInput;
  importExpenses: MarginInput;
}): Decimal {
  return new Decimal(input.purchaseCost)
    .plus(input.logisticsCost)
    .plus(input.importExpenses);
}

/**
 * Precio de venta antes de IVA = costo aterrizado / (1 - margen deseado).
 * Ejemplo del brief: costo 1000, margen 30% -> precio 1428.57.
 */
export function computeSalePriceFromMargin(input: {
  landedCost: MarginInput;
  marginPct: MarginInput;
}): Decimal {
  const marginFraction = new Decimal(input.marginPct).dividedBy(100);
  if (marginFraction.greaterThanOrEqualTo(1)) {
    throw new Error("El margen no puede ser 100% o mayor: el precio de venta seria infinito.");
  }
  return new Decimal(input.landedCost).dividedBy(new Decimal(1).minus(marginFraction));
}

/** Inversa de computeSalePriceFromMargin: dado un precio, ¿que margen implica? */
export function computeMarginPctFromSalePrice(input: {
  landedCost: MarginInput;
  salePrice: MarginInput;
}): Decimal {
  const salePrice = new Decimal(input.salePrice);
  if (salePrice.isZero()) {
    throw new Error("El precio de venta no puede ser cero al calcular el margen.");
  }
  return salePrice.minus(input.landedCost).dividedBy(salePrice).times(100);
}

export function isBelowMinMargin(input: {
  landedCost: MarginInput;
  salePrice: MarginInput;
  minMarginPct: MarginInput;
}): boolean {
  const actualMarginPct = computeMarginPctFromSalePrice({
    landedCost: input.landedCost,
    salePrice: input.salePrice,
  });
  return actualMarginPct.lessThan(new Decimal(input.minMarginPct));
}
