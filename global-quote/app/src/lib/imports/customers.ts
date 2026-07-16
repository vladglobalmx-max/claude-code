import { z } from "zod";

/**
 * Validación pura de un CSV de clientes/prospectos (docs/ARCHITECTURE.md
 * §10, Módulo 14) — mismas reglas que `customers/validation.ts` (Módulo 4)
 * salvo que la línea de negocio llega como código de texto, igual que en
 * `imports/products.ts`.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const customerImportRowSchema = z.object({
  businessUnitCode: z.string().trim().min(1, "La línea de negocio es requerida"),
  legalName: z.string().trim().min(3, "La razón social debe tener al menos 3 caracteres").max(200),
  tradeName: optionalText(200),
  taxId: optionalText(20),
  industry: optionalText(100),
  segment: optionalText(100),
  notes: optionalText(1000),
});

export type CustomerImportRow = z.infer<typeof customerImportRowSchema>;

export type ImportRowResult<TRow> =
  | { rowNumber: number; ok: true; data: TRow }
  | { rowNumber: number; ok: false; errors: string[] };

export function parseCustomerImportRows(
  records: Record<string, string>[],
): ImportRowResult<CustomerImportRow>[] {
  return records.map((record, index) => {
    const rowNumber = index + 2;
    const parsed = customerImportRowSchema.safeParse({
      businessUnitCode: record.businessUnitCode ?? "",
      legalName: record.legalName ?? "",
      tradeName: record.tradeName ?? "",
      taxId: record.taxId ?? "",
      industry: record.industry ?? "",
      segment: record.segment ?? "",
      notes: record.notes ?? "",
    });
    if (parsed.success) {
      return { rowNumber, ok: true, data: parsed.data };
    }
    return { rowNumber, ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  });
}

export type DuplicateCustomerRow = { rowNumber: number };

export type ExistingCustomerKeys = {
  /** RFC ya capturados en esta línea de negocio, en mayúsculas. */
  taxIds: ReadonlySet<string>;
  /** Razones sociales ya capturadas en esta línea de negocio, en mayúsculas. */
  legalNames: ReadonlySet<string>;
};

/**
 * `customers.tax_id` no es único a nivel de esquema (a diferencia de
 * `products.internal_sku`) — el RFC es opcional y varios clientes
 * históricos no lo tienen capturado (Módulo 4). La detección de duplicados
 * es entonces una decisión de negocio, no una restricción de la base de
 * datos: una fila es duplicada si coincide su RFC (cuando lo trae) **o**
 * su razón social exacta (sin distinguir mayúsculas/minúsculas) contra lo
 * que ya existe en la misma línea — no una sola clave combinada, porque
 * un cliente ya capturado con RFC debe detectarse aunque el archivo nuevo
 * no lo traiga (y viceversa).
 */
export function detectDuplicateCustomers(
  rows: { rowNumber: number; businessUnitCode: string; legalName: string; taxId: string | null }[],
  existing: ExistingCustomerKeys,
): DuplicateCustomerRow[] {
  const duplicates: DuplicateCustomerRow[] = [];
  const seenTaxIds = new Set<string>();
  const seenLegalNames = new Set<string>();

  for (const row of rows) {
    const taxId = row.taxId ? row.taxId.toUpperCase() : null;
    const legalName = row.legalName.toUpperCase();

    const isDuplicate =
      (taxId != null && (existing.taxIds.has(taxId) || seenTaxIds.has(taxId))) ||
      existing.legalNames.has(legalName) ||
      seenLegalNames.has(legalName);

    if (isDuplicate) {
      duplicates.push({ rowNumber: row.rowNumber });
    } else {
      if (taxId) seenTaxIds.add(taxId);
      seenLegalNames.add(legalName);
    }
  }

  return duplicates;
}
