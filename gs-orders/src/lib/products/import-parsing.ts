/**
 * Parseo/validación/detección de duplicados de la importación Excel de
 * Productos del catálogo — puro, sin acceso a red ni a Supabase, mismo
 * criterio que src/lib/customers/import-parsing.ts (Clientes). La
 * escritura a DB vive en
 * app/(app)/configuracion/catalogo/importar/actions.ts.
 *
 * Columnas de la plantilla (public/plantillas/productos.xlsx), en el
 * ORDEN REAL del modelo (product_catalog, 0009/0019_core_product_catalog_pricing.sql)
 * — NO existe "Tipo de producto" en `product_catalog` (esa es una tabla
 * distinta, `product_types`, exclusiva para clasificar `orders.product_type`,
 * ver 0010_product_types.sql: "category (product_catalog) y product_type
 * (orders) siguen siendo conceptos DISTINTOS"). El campo real equivalente
 * es `category`, texto libre sin FK — igual que en el formulario manual
 * (catalog-form.tsx permite escribir cualquier categoría nueva sin
 * validarla contra una lista fija), así que "Categoría" aquí NUNCA genera
 * un error de "no existe": solo error si viene vacía.
 *
 * Business Unit * | Categoría * | Modelo / SKU * | Nombre * | Descripción
 * | Precio MXN | Precio USD | Activo
 */

export const IMPORT_HEADERS = [
  "Business Unit *",
  "Categoría *",
  "Modelo / SKU *",
  "Nombre *",
  "Descripción",
  "Precio MXN",
  "Precio USD",
  "Activo",
] as const;

export interface ParsedProductRow {
  rowNumber: number; // 1-based sobre filas de datos (fila 2 del archivo = fila 1 de datos)
  businessUnitName: string;
  category: string;
  sku: string;
  name: string;
  description: string | null;
  priceMxn: number | null;
  priceUsd: number | null;
  active: boolean;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

function toTrimmedOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

/** Mismo criterio que catalog-form.tsx: sin valor = Activo (default true). */
function parseActiveCell(value: unknown): boolean {
  const s = toTrimmedOrNull(value);
  if (!s) return true;
  const normalized = s.toLowerCase();
  return !["no", "false", "0", "inactivo"].includes(normalized);
}

function parsePriceCell(value: unknown, label: string, rowNumber: number): { price: number | null; error: string | null } {
  const s = toTrimmedOrNull(value);
  if (!s) return { price: null, error: null };
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) {
    return { price: null, error: `Fila ${rowNumber}: "${label}" debe ser un número válido y no negativo.` };
  }
  return { price: n, error: null };
}

/** Normaliza SKU para comparación case-insensitive — espeja product_catalog_sku_unique (upper(sku), GLOBAL, sin scope de organización ni de Business Unit). */
export function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

export function parseProductImportRow(
  rowNumber: number,
  cells: unknown[]
): { row: ParsedProductRow | null; error: ImportRowError | null } {
  const [buRaw, categoryRaw, skuRaw, nameRaw, descRaw, priceMxnRaw, priceUsdRaw, activeRaw] = cells;

  const businessUnitName = toTrimmedOrNull(buRaw);
  if (!businessUnitName) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Business Unit" es obligatorio.` } };
  }

  const category = toTrimmedOrNull(categoryRaw);
  if (!category) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Categoría" es obligatoria.` } };
  }

  const sku = toTrimmedOrNull(skuRaw);
  if (!sku) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Modelo / SKU" es obligatorio.` } };
  }

  const name = toTrimmedOrNull(nameRaw);
  if (!name) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Nombre" es obligatorio.` } };
  }

  const description = toTrimmedOrNull(descRaw);

  const mxnResult = parsePriceCell(priceMxnRaw, "Precio MXN", rowNumber);
  if (mxnResult.error) return { row: null, error: { rowNumber, message: mxnResult.error } };

  const usdResult = parsePriceCell(priceUsdRaw, "Precio USD", rowNumber);
  if (usdResult.error) return { row: null, error: { rowNumber, message: usdResult.error } };

  const active = parseActiveCell(activeRaw);

  return {
    row: {
      rowNumber,
      businessUnitName,
      category,
      sku,
      name,
      description,
      priceMxn: mxnResult.price,
      priceUsd: usdResult.price,
      active,
    },
    error: null,
  };
}

export interface BusinessUnitCandidate {
  id: string;
  name: string;
}

/**
 * Resuelve el nombre de Business Unit del Excel contra las Business Units
 * ACTIVAS reales — mismo criterio que el selector del formulario manual
 * (configuracion/catalogo/nuevo/page.tsx solo ofrece BUs activas). Una BU
 * inactiva con el mismo nombre se trata igual que "no existe": no se
 * inventa ninguna excepción nueva para la importación.
 */
export function resolveBusinessUnit(name: string, candidates: BusinessUnitCandidate[]): BusinessUnitCandidate | null {
  const normalized = name.trim().toLowerCase();
  return candidates.find((bu) => bu.name.trim().toLowerCase() === normalized) ?? null;
}

export interface ValidProductRow {
  rowNumber: number;
  businessUnitId: string;
  businessUnitName: string;
  category: string;
  sku: string;
  name: string;
  description: string | null;
  priceMxn: number | null;
  priceUsd: number | null;
  active: boolean;
}

export type DuplicateReason = "existing" | "in_file";

export interface DuplicateProductRow {
  rowNumber: number;
  sku: string;
  name: string;
  reason: DuplicateReason;
}

/**
 * Clasifica las filas ya parseadas en válidas / posibles duplicados /
 * error, EN ESE ORDEN de prioridad (Business Unit inexistente es error
 * antes que revisar duplicado). Duplicado = mismo SKU normalizado
 * (case-insensitive) contra: (a) un producto YA existente en
 * `product_catalog` (activo o inactivo — la constraint real
 * product_catalog_sku_unique no distingue estado), o (b) otra fila válida
 * ya vista DENTRO del mismo archivo. Nunca por "Business Unit + SKU": la
 * única restricción de unicidad real en la base de datos es GLOBAL sobre
 * `upper(sku)`, sin importar Business Unit ni organización — se respeta
 * esa regla real, no la sugerida por el usuario en el brief.
 */
export function classifyProductRows(
  rows: ParsedProductRow[],
  businessUnits: BusinessUnitCandidate[],
  existingSkus: string[]
): { valid: ValidProductRow[]; duplicates: DuplicateProductRow[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const duplicates: DuplicateProductRow[] = [];
  const valid: ValidProductRow[] = [];
  const existingNormalized = new Set(existingSkus.map(normalizeSku));
  const seenInFile = new Set<string>();

  for (const row of rows) {
    const bu = resolveBusinessUnit(row.businessUnitName, businessUnits);
    if (!bu) {
      errors.push({ rowNumber: row.rowNumber, message: `Fila ${row.rowNumber}: Business Unit "${row.businessUnitName}" no existe.` });
      continue;
    }

    const normalizedSku = normalizeSku(row.sku);
    if (existingNormalized.has(normalizedSku)) {
      duplicates.push({ rowNumber: row.rowNumber, sku: row.sku, name: row.name, reason: "existing" });
      continue;
    }
    if (seenInFile.has(normalizedSku)) {
      duplicates.push({ rowNumber: row.rowNumber, sku: row.sku, name: row.name, reason: "in_file" });
      continue;
    }
    seenInFile.add(normalizedSku);

    valid.push({
      rowNumber: row.rowNumber,
      businessUnitId: bu.id,
      businessUnitName: bu.name,
      category: row.category,
      sku: row.sku,
      name: row.name,
      description: row.description,
      priceMxn: row.priceMxn,
      priceUsd: row.priceUsd,
      active: row.active,
    });
  }

  return { valid, duplicates, errors };
}
