/**
 * Espejo exacto en TypeScript de la fórmula de totales de
 * rpc_create_quote/rpc_update_quote (ver 0020_core_quotes.sql, sección
 * DECISIÓN "dinero: numeric(12,2)"). Existe ÚNICAMENTE para mostrar un
 * preview mientras el usuario captura una Quote, antes de guardar — la base
 * de datos sigue siendo la única autoridad de los totales persistidos
 * (subtotal/discount_total/tax_total/total de `quotes`,
 * line_subtotal de `quote_items`). Lo que devuelve rpc_create_quote/
 * rpc_update_quote al guardar SIEMPRE reemplaza este preview en pantalla.
 *
 * A diferencia del folio (ver AJUSTE 2 del Q4 approval — explícitamente NO
 * se replica ningún algoritmo de folio en el frontend, por riesgo de
 * concurrencia), los totales sí pueden previsualizarse: no dependen de
 * ningún estado compartido entre usuarios (a diferencia de
 * sequence_current), son puramente una función de lo que el propio usuario
 * está capturando en ese momento.
 *
 * NO DIVERGIR de la fórmula SQL sin actualizar ambos lados. Pasos exactos
 * (idénticos a 0020, incluido el orden de redondeo — en plpgsql, cada
 * variable declarada numeric(12,2)/numeric(5,2) redondea a 2 decimales en
 * cuanto se le asigna un valor, no solo en las llamadas explícitas a
 * round()):
 *   unit_price, line_discount_percent, tax_rate, global_discount_percent
 *     → redondeados a 2 decimales apenas se leen (typmod numeric(12,2)/(5,2))
 *   line_gross            = quantity × unit_price
 *   line_discount_amount  = round(line_gross × line_discount_percent / 100, 2)
 *   line_subtotal         = line_gross − line_discount_amount
 *   subtotal              = Σ line_subtotal
 *   global_discount_amount = round(subtotal × global_discount_percent / 100, 2)
 *   discount_total        = Σ line_discount_amount + global_discount_amount
 *   taxable_base           = subtotal − global_discount_amount
 *   tax_total              = round(taxable_base × tax_rate / 100, 2)
 *   total                  = taxable_base + tax_total
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface QuoteTotalsItemInput {
  quantity: number;
  unit_price: number;
  line_discount_percent: number;
}

export interface QuoteTotalsInput {
  items: QuoteTotalsItemInput[];
  global_discount_percent: number;
  tax_rate: number;
}

export interface QuoteTotalsResult {
  /** line_subtotal de cada línea, en el mismo orden que `items` de entrada. */
  lineSubtotals: number[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotalsResult {
  const taxRate = round2(input.tax_rate);
  const globalDiscountPercent = round2(input.global_discount_percent);

  const lineSubtotals: number[] = [];
  let subtotal = 0;
  let lineDiscountSum = 0;

  for (const item of input.items) {
    const unitPrice = round2(item.unit_price);
    const lineDiscountPercent = round2(item.line_discount_percent);

    const lineGross = round2(item.quantity * unitPrice);
    const lineDiscountAmount = round2((lineGross * lineDiscountPercent) / 100);
    const lineSubtotal = round2(lineGross - lineDiscountAmount);

    lineSubtotals.push(lineSubtotal);
    subtotal = round2(subtotal + lineSubtotal);
    lineDiscountSum = round2(lineDiscountSum + lineDiscountAmount);
  }

  const globalDiscountAmount = round2((subtotal * globalDiscountPercent) / 100);
  const discountTotal = round2(lineDiscountSum + globalDiscountAmount);
  const taxableBase = round2(subtotal - globalDiscountAmount);
  const taxTotal = round2((taxableBase * taxRate) / 100);
  const total = round2(taxableBase + taxTotal);

  return { lineSubtotals, subtotal, discountTotal, taxTotal, total };
}
