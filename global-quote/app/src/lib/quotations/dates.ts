/** Vigencia sugerida por defecto para una cotización nueva: hoy + 15 días. */
export function defaultQuotationValidUntil(referenceDate: Date = new Date()): string {
  const validUntil = new Date(referenceDate.getTime() + 15 * 24 * 60 * 60 * 1000);
  return validUntil.toISOString().slice(0, 10);
}
