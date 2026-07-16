import { z } from "zod";

/**
 * Validación pura de un CSV de productos (docs/ARCHITECTURE.md §10, Módulo
 * 14). Reutiliza las mismas reglas que `catalog/validation.ts` (Módulo 3)
 * para no tener dos definiciones de "SKU válido" o "margen entre 0 y 100"
 * — la única diferencia es que aquí las líneas de negocio, categorías y
 * listas de precio llegan como código de texto (`GFB`, no un UUID), porque
 * es lo único que alguien llenando un CSV a mano puede escribir; resolver
 * esos códigos a IDs reales requiere la base de datos, así que ese paso
 * vive en `imports/mutations.ts`, no aquí.
 */

const decimalField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} es requerido`)
    .refine((value) => !Number.isNaN(Number(value)), `${label} debe ser un número`)
    .transform((value) => Number(value))
    .refine((value) => value >= 0, `${label} no puede ser negativo`)
    .refine((value) => value <= max, `${label} no puede ser mayor a ${max}`);

export const productImportRowSchema = z
  .object({
    businessUnitCode: z.string().trim().min(1, "La línea de negocio es requerida"),
    sku: z
      .string()
      .trim()
      .min(3, "El SKU debe tener al menos 3 caracteres")
      .max(40)
      .regex(/^[A-Za-z0-9._-]+$/, "El SKU solo admite letras, números, guiones y puntos"),
    name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(200),
    uom: z.string().trim().min(1, "La unidad de medida es requerida").max(20),
    categoryName: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value)),
    purchaseCost: decimalField("El costo de compra", 1_000_000),
    logisticsCost: decimalField("El costo logístico", 1_000_000),
    importExpenses: decimalField("Los gastos de importación", 1_000_000),
    targetMarginPct: decimalField("El margen objetivo", 99.99),
    minMarginPct: decimalField("El margen mínimo", 99.99),
    priceListCode: z.string().trim().min(1, "La lista de precios es requerida"),
    listPrice: decimalField("El precio de lista", 10_000_000),
  })
  .refine((data) => data.minMarginPct <= data.targetMarginPct, {
    message: "El margen mínimo no puede ser mayor al margen objetivo",
    path: ["minMarginPct"],
  });

export type ProductImportRow = z.infer<typeof productImportRowSchema>;

export type ImportRowResult<TRow> =
  | { rowNumber: number; ok: true; data: TRow }
  | { rowNumber: number; ok: false; errors: string[] };

/** `rowNumber` es 1-based contando el encabezado como la fila 1 (igual que se vería el CSV abierto en un editor). */
export function parseProductImportRows(records: Record<string, string>[]): ImportRowResult<ProductImportRow>[] {
  return records.map((record, index) => {
    const rowNumber = index + 2;
    const parsed = productImportRowSchema.safeParse({
      businessUnitCode: record.businessUnitCode ?? "",
      sku: record.sku ?? "",
      name: record.name ?? "",
      uom: record.uom ?? "",
      categoryName: record.categoryName ?? "",
      purchaseCost: record.purchaseCost ?? "",
      logisticsCost: record.logisticsCost ?? "",
      importExpenses: record.importExpenses ?? "",
      targetMarginPct: record.targetMarginPct ?? "",
      minMarginPct: record.minMarginPct ?? "",
      priceListCode: record.priceListCode ?? "",
      listPrice: record.listPrice ?? "",
    });
    if (parsed.success) {
      return { rowNumber, ok: true, data: parsed.data };
    }
    return { rowNumber, ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  });
}

export type DuplicateProductRow = { rowNumber: number; sku: string };

/**
 * SKU único a nivel de esquema (docs/ARCHITECTURE.md §5.3) — un duplicado
 * nunca es un error de captura, es esperado al reimportar el mismo archivo
 * o un catálogo que se traslapa a propósito. No bloquea el resto del
 * archivo (a diferencia de un error de validación): simplemente se omite
 * esa fila y se reporta.
 */
export function detectDuplicateSkus(
  rows: { rowNumber: number; sku: string }[],
  existingSkus: ReadonlySet<string>,
): DuplicateProductRow[] {
  const duplicates: DuplicateProductRow[] = [];
  const seenInFile = new Set<string>();

  for (const row of rows) {
    const sku = row.sku.toUpperCase();
    if (existingSkus.has(sku) || seenInFile.has(sku)) {
      duplicates.push(row);
    } else {
      seenInFile.add(sku);
    }
  }

  return duplicates;
}
