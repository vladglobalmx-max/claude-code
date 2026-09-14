/**
 * Espejo exacto en TypeScript de la fórmula de totales de
 * rpc_create_sales_order/rpc_update_sales_order (ver
 * 0067_sales_orders_mvp.sql, DECISIÓN "fórmula de dinero"). Existe
 * ÚNICAMENTE para mostrar un preview mientras se captura una Sales Order,
 * antes de guardar — la base de datos sigue siendo la única autoridad de
 * los totales persistidos (subtotal/tax_total/total de `sales_orders`,
 * line_subtotal/line_total de `sales_order_items`).
 *
 * A diferencia de Quotes, aquí NO hay descuento/impuesto global de
 * encabezado: `discount`/`tax` son porcentajes POR LÍNEA, y el encabezado
 * solo acumula subtotal (post-descuento, pre-impuesto), tax_total y total.
 * NO DIVERGIR de la fórmula SQL sin actualizar ambos lados:
 *   line_gross            = quantity × unit_price
 *   line_discount_amount  = round(line_gross × discount / 100, 2)
 *   line_subtotal         = line_gross − line_discount_amount
 *   line_tax_amount       = round(line_subtotal × tax / 100, 2)
 *   line_total             = line_subtotal + line_tax_amount
 *   subtotal (header)      = Σ line_subtotal
 *   tax_total (header)     = Σ line_tax_amount
 *   total (header)         = subtotal + tax_total
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface SalesOrderTotalsItemInput {
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
}

export interface SalesOrderTotalsResult {
  /** line_subtotal de cada línea, en el mismo orden que `items` de entrada. */
  lineSubtotals: number[];
  /** line_total de cada línea, en el mismo orden que `items` de entrada. */
  lineTotals: number[];
  subtotal: number;
  taxTotal: number;
  total: number;
}

export function computeSalesOrderTotals(items: SalesOrderTotalsItemInput[]): SalesOrderTotalsResult {
  const lineSubtotals: number[] = [];
  const lineTotals: number[] = [];
  let subtotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const unitPrice = round2(item.unit_price);
    const discount = round2(item.discount);
    const tax = round2(item.tax);

    const lineGross = round2(item.quantity * unitPrice);
    const lineDiscountAmount = round2((lineGross * discount) / 100);
    const lineSubtotal = round2(lineGross - lineDiscountAmount);
    const lineTaxAmount = round2((lineSubtotal * tax) / 100);
    const lineTotal = round2(lineSubtotal + lineTaxAmount);

    lineSubtotals.push(lineSubtotal);
    lineTotals.push(lineTotal);
    subtotal = round2(subtotal + lineSubtotal);
    taxTotal = round2(taxTotal + lineTaxAmount);
  }

  const total = round2(subtotal + taxTotal);

  return { lineSubtotals, lineTotals, subtotal, taxTotal, total };
}
