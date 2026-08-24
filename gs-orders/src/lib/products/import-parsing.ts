/**
 * Parseo/validación/clasificación (NUEVO/ACTUALIZAR/SIN CAMBIOS/ERROR) de
 * la importación Excel del Catálogo Maestro de Productos (Fase 6C) — puro,
 * sin acceso a red ni a Supabase, mismo criterio que
 * src/lib/customers/import-parsing.ts. La escritura a DB vive en
 * app/(app)/configuracion/catalogo/importar/actions.ts, vía
 * rpc_import_product_catalog (0030_product_catalog_master.sql) — atómica:
 * cualquier fila inválida en el momento de escribir aborta TODO el commit.
 *
 * Columnas de la plantilla (public/plantillas/productos.xlsx), nombres
 * amigables — Business Unit y Tipo de producto se resuelven por NOMBRE
 * contra filas ya existentes (nunca se crean automáticamente, pedido
 * explícito del usuario). Comparación de texto robusta ante acentos/
 * mayúsculas/espacios (ver `canonicalize`) — SIEMPRE match exacto tras
 * normalizar, nunca aproximado/difuso.
 *
 * "Business Unit" soporta MÚLTIPLES unidades en la misma celda, separadas
 * por " | " (product_business_units es N:M — ver
 * 0030_product_catalog_master.sql, DECISIÓN "Business Unit"). El valor
 * literal "TODAS" (ajuste posterior a la aprobación conceptual de Fase 6C)
 * representa explícitamente "compartido con todas las Business Units de
 * la organización" (0 filas en product_business_units) — nunca una celda
 * vacía, para que la intención sea siempre explícita en el archivo.
 *
 * SKU * | Nombre * | Descripción | Business Unit * | Tipo de producto * |
 * Marca | Modelo | Unidad | Moneda * | Precio base | Activo
 */

export const IMPORT_HEADERS = [
  "SKU *",
  "Nombre *",
  "Descripción",
  "Business Unit *",
  "Tipo de producto *",
  "Marca",
  "Modelo",
  "Unidad",
  "Moneda *",
  "Precio base",
  "Activo",
] as const;

export type Currency = "MXN" | "USD";

/** Separador de múltiples Business Units dentro de una misma celda. */
export const BUSINESS_UNIT_SEPARATOR = " | ";

/** Valor literal que representa "compartido con todas las Business Units de la organización" (0 asociaciones). */
export const ALL_BUSINESS_UNITS_KEYWORD = "TODAS";

/**
 * Normaliza texto para COMPARAR (nunca para guardar): trim, colapsa
 * espacios internos, minúsculas, y elimina diacríticos (acentos) vía
 * descomposición Unicode NFD. Resuelve el problema ya conocido en este
 * proyecto de nombres acentuados en Postgres/comparaciones de texto — el
 * match sigue siendo EXACTO después de normalizar, nunca aproximado
 * (nunca Levenshtein/similaridad).
 */
const COMBINING_DIACRITICS_RANGE = /[\u0300-\u036f]/g;

export function canonicalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RANGE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
  const normalized = canonicalize(s);
  return !["no", "false", "0", "inactivo"].includes(normalized);
}

function parsePriceCell(value: unknown, rowNumber: number): { price: number | null; error: string | null } {
  const s = toTrimmedOrNull(value);
  if (!s) return { price: null, error: null };
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) {
    return { price: null, error: `Fila ${rowNumber}: "Precio base" debe ser un número válido y no negativo.` };
  }
  return { price: n, error: null };
}

function parseCurrencyCell(value: unknown, rowNumber: number): { currency: Currency | null; error: string | null } {
  const s = toTrimmedOrNull(value);
  if (!s) return { currency: null, error: `Fila ${rowNumber}: "Moneda" es obligatoria.` };
  const normalized = canonicalize(s);
  if (normalized === "mxn") return { currency: "MXN", error: null };
  if (normalized === "usd") return { currency: "USD", error: null };
  return { currency: null, error: `Fila ${rowNumber}: "Moneda" debe ser "MXN" o "USD" (se recibió "${s}").` };
}

/**
 * Parsea la celda "Business Unit" en una lista de nombres crudos (sin
 * resolver todavía contra la DB), o `null` como sentinela de "TODAS"
 * (compartido con todas las Business Units de la organización). Reglas:
 * - Split por " | " (o "|" con espacios variables alrededor — se hace
 *   trim de cada segmento, así que " | ", "|" y " |" son equivalentes).
 * - Segmentos vacíos (celda con "|" sobrante, ej. "A | | B") se ignoran,
 *   no son error — ruido de formato, no ambigüedad real.
 * - "TODAS" (case/acento/espacio-insensitive) debe ser el ÚNICO segmento
 *   de la celda — combinarlo con Business Units específicas es
 *   contradictorio y se reporta como error explícito, nunca se adivina
 *   cuál de las dos intenciones prevalece.
 * - Duplicados dentro de la misma celda (mismo nombre repetido, con
 *   distinto acento/mayúscula/espacio) se colapsan a una sola entrada —
 *   nunca generan una asociación duplicada.
 */
function parseBusinessUnitCell(
  raw: string,
  rowNumber: number
): { names: string[] | null; error: string | null } {
  const segments = raw
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) {
    return { names: null, error: `Fila ${rowNumber}: "Business Unit" es obligatoria.` };
  }

  const isAll = (s: string) => canonicalize(s) === canonicalize(ALL_BUSINESS_UNITS_KEYWORD);
  const allCount = segments.filter(isAll).length;

  if (allCount > 0 && segments.length > 1) {
    return {
      names: null,
      error: `Fila ${rowNumber}: "Business Unit" combina "${ALL_BUSINESS_UNITS_KEYWORD}" con Business Units específicas — usa solo "${ALL_BUSINESS_UNITS_KEYWORD}" o solo nombres específicos, nunca ambos en la misma celda.`,
    };
  }

  if (allCount === 1) {
    return { names: null, error: null };
  }

  // Dedupe preservando el primer nombre "crudo" visto por cada clave normalizada.
  const seen = new Set<string>();
  const names: string[] = [];
  for (const segment of segments) {
    const key = canonicalize(segment);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(segment);
  }

  return { names, error: null };
}

/** Normaliza SKU para comparación case-insensitive — espeja product_catalog_org_sku_unique (organization_id, upper(sku)). */
export function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

export interface ParsedProductRow {
  rowNumber: number; // 1-based sobre filas de datos (fila 2 del archivo = fila 1 de datos)
  sku: string;
  name: string;
  description: string | null;
  /** null = "TODAS" (compartido con todas las Business Units de la organización). */
  businessUnitNames: string[] | null;
  productTypeName: string;
  brand: string | null;
  model: string | null;
  unit: string | null;
  currency: Currency;
  basePrice: number | null;
  active: boolean;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

export function parseProductImportRow(
  rowNumber: number,
  cells: unknown[]
): { row: ParsedProductRow | null; error: ImportRowError | null } {
  const [skuRaw, nameRaw, descRaw, buRaw, typeRaw, brandRaw, modelRaw, unitRaw, currencyRaw, priceRaw, activeRaw] =
    cells;

  const sku = toTrimmedOrNull(skuRaw);
  if (!sku) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "SKU" es obligatorio.` } };
  }

  const name = toTrimmedOrNull(nameRaw);
  if (!name) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Nombre" es obligatorio.` } };
  }

  const businessUnitRaw = toTrimmedOrNull(buRaw);
  if (!businessUnitRaw) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Business Unit" es obligatoria.` } };
  }
  const businessUnitResult = parseBusinessUnitCell(businessUnitRaw, rowNumber);
  if (businessUnitResult.error) return { row: null, error: { rowNumber, message: businessUnitResult.error } };

  const productTypeName = toTrimmedOrNull(typeRaw);
  if (!productTypeName) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Tipo de producto" es obligatorio.` } };
  }

  const currencyResult = parseCurrencyCell(currencyRaw, rowNumber);
  if (currencyResult.error) return { row: null, error: { rowNumber, message: currencyResult.error } };

  const priceResult = parsePriceCell(priceRaw, rowNumber);
  if (priceResult.error) return { row: null, error: { rowNumber, message: priceResult.error } };

  return {
    row: {
      rowNumber,
      sku,
      name,
      description: toTrimmedOrNull(descRaw),
      businessUnitNames: businessUnitResult.names,
      productTypeName,
      brand: toTrimmedOrNull(brandRaw),
      model: toTrimmedOrNull(modelRaw),
      unit: toTrimmedOrNull(unitRaw),
      currency: currencyResult.currency as Currency,
      basePrice: priceResult.price,
      active: parseActiveCell(activeRaw),
    },
    error: null,
  };
}

export interface NamedCandidate {
  id: string;
  name: string;
}

export type BusinessUnitCandidate = NamedCandidate;
export type ProductTypeCandidate = NamedCandidate;

/** Resuelve un nombre del Excel contra candidatos reales — match exacto tras `canonicalize` (nunca aproximado). */
export function resolveByName<T extends NamedCandidate>(name: string, candidates: T[]): T | null {
  const normalized = canonicalize(name);
  return candidates.find((c) => canonicalize(c.name) === normalized) ?? null;
}

/**
 * Resuelve TODOS los nombres de una celda "Business Unit" ya parseada
 * contra los candidatos reales. `names === null` (sentinela "TODAS")
 * resuelve directo a `[]` (0 asociaciones), sin tocar candidatos. Si
 * CUALQUIER nombre no existe, se reporta como error y NO se resuelve
 * ninguno de los demás — la fila completa es inválida (pedido explícito:
 * "si cualquiera no existe: fila = ERROR").
 */
function resolveBusinessUnits(
  names: string[] | null,
  candidates: BusinessUnitCandidate[],
  rowNumber: number
): { ids: string[]; names: string[]; error: string | null } {
  if (names === null) return { ids: [], names: [], error: null };

  const ids: string[] = [];
  const resolvedNames: string[] = [];
  for (const raw of names) {
    const bu = resolveByName(raw, candidates);
    if (!bu) {
      return {
        ids: [],
        names: [],
        error: `Fila ${rowNumber}: Business Unit "${raw}" no existe.`,
      };
    }
    ids.push(bu.id);
    resolvedNames.push(bu.name);
  }
  return { ids, names: resolvedNames, error: null };
}

export interface ExistingProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  productTypeId: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  currency: Currency | null; // null = sin precio en ninguna moneda
  basePrice: number | null;
  active: boolean;
  /** IDs de TODAS las Business Units asociadas hoy — [] = compartido con todas. */
  businessUnitIds: string[];
}

export type RowClassification = "new" | "update" | "unchanged" | "error";

export interface ClassifiedProductRow {
  rowNumber: number;
  sku: string;
  name: string;
  classification: RowClassification;
  existingId: string | null;
  /** [] = "TODAS" (compartido con todas las Business Units de la organización). */
  businessUnitIds: string[];
  businessUnitNames: string[];
  productTypeId: string;
  productTypeName: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  currency: Currency;
  basePrice: number | null;
  active: boolean;
  changedFields: string[];
}

function normalizeForCompare(value: string | null): string {
  return value ? canonicalize(value) : "";
}

/** true si dos conjuntos de ids de Business Unit son iguales (mismos elementos, sin importar orden). */
function sameBusinessUnitSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/**
 * Compara una fila del Excel (ya resuelta contra candidatos reales) contra
 * el producto existente con el mismo SKU (si lo hay) y arma la lista de
 * campos que cambiarían — usada tanto para clasificar (update vs
 * unchanged) como para mostrarla en el preview.
 */
function diffAgainstExisting(
  row: ParsedProductRow,
  productTypeId: string,
  businessUnitIds: string[],
  existing: ExistingProductRow
): string[] {
  const changed: string[] = [];
  if (normalizeForCompare(row.name) !== normalizeForCompare(existing.name)) changed.push("Nombre");
  if (normalizeForCompare(row.description) !== normalizeForCompare(existing.description)) changed.push("Descripción");
  if (productTypeId !== (existing.productTypeId ?? "")) changed.push("Tipo de producto");
  if (normalizeForCompare(row.brand) !== normalizeForCompare(existing.brand)) changed.push("Marca");
  if (normalizeForCompare(row.model) !== normalizeForCompare(existing.model)) changed.push("Modelo");
  if (normalizeForCompare(row.unit) !== normalizeForCompare(existing.unit)) changed.push("Unidad");
  if (row.currency !== existing.currency) changed.push("Moneda");
  if ((row.basePrice ?? null) !== (existing.basePrice ?? null)) changed.push("Precio base");
  if (row.active !== existing.active) changed.push("Activo");
  if (!sameBusinessUnitSet(businessUnitIds, existing.businessUnitIds)) changed.push("Business Unit");
  return changed;
}

/**
 * Clasifica las filas ya parseadas en NUEVO / ACTUALIZAR / SIN CAMBIOS /
 * ERROR, en ese orden de prioridad por fila: Business Unit(s) inexistente,
 * luego Tipo de producto inexistente, luego SKU duplicado DENTRO del
 * mismo archivo (a diferencia de la fase anterior, un duplicado en el
 * archivo es ERROR — bloquea TODA la importación, nunca se omite en
 * silencio, pedido explícito de Fase 6C). Duplicado contra la DB existente
 * NUNCA es error: es ACTUALIZAR o SIN CAMBIOS según haya o no diferencias
 * reales.
 */
export function classifyProductRows(
  rows: ParsedProductRow[],
  businessUnits: BusinessUnitCandidate[],
  productTypes: ProductTypeCandidate[],
  existingProducts: ExistingProductRow[]
): { classified: ClassifiedProductRow[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const classified: ClassifiedProductRow[] = [];
  const existingBySku = new Map(existingProducts.map((p) => [normalizeSku(p.sku), p]));
  const seenInFile = new Map<string, number>(); // sku normalizado -> primera fila donde apareció

  for (const row of rows) {
    const buResult = resolveBusinessUnits(row.businessUnitNames, businessUnits, row.rowNumber);
    if (buResult.error) {
      errors.push({ rowNumber: row.rowNumber, message: buResult.error });
      continue;
    }

    const type = resolveByName(row.productTypeName, productTypes);
    if (!type) {
      errors.push({ rowNumber: row.rowNumber, message: `Fila ${row.rowNumber}: Tipo de producto "${row.productTypeName}" no existe.` });
      continue;
    }

    const normalizedSku = normalizeSku(row.sku);
    const firstSeenRow = seenInFile.get(normalizedSku);
    if (firstSeenRow !== undefined) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Fila ${row.rowNumber}: SKU "${row.sku}" está duplicado dentro del archivo (ya aparece en la fila ${firstSeenRow}).`,
      });
      continue;
    }
    seenInFile.set(normalizedSku, row.rowNumber);

    const existing = existingBySku.get(normalizedSku);

    if (!existing) {
      classified.push({
        rowNumber: row.rowNumber,
        sku: row.sku,
        name: row.name,
        classification: "new",
        existingId: null,
        businessUnitIds: buResult.ids,
        businessUnitNames: buResult.names,
        productTypeId: type.id,
        productTypeName: type.name,
        description: row.description,
        brand: row.brand,
        model: row.model,
        unit: row.unit,
        currency: row.currency,
        basePrice: row.basePrice,
        active: row.active,
        changedFields: [],
      });
      continue;
    }

    const changedFields = diffAgainstExisting(row, type.id, buResult.ids, existing);
    classified.push({
      rowNumber: row.rowNumber,
      sku: row.sku,
      name: row.name,
      classification: changedFields.length > 0 ? "update" : "unchanged",
      existingId: existing.id,
      businessUnitIds: buResult.ids,
      businessUnitNames: buResult.names,
      productTypeId: type.id,
      productTypeName: type.name,
      description: row.description,
      brand: row.brand,
      model: row.model,
      unit: row.unit,
      currency: row.currency,
      basePrice: row.basePrice,
      active: row.active,
      changedFields,
    });
  }

  return { classified, errors };
}

/**
 * Formatea un conjunto de Business Units resuelto (mismo criterio que
 * exportar: 0 → "TODAS", 1 → nombre, 2+ → nombres unidos por " | ",
 * ordenados de forma determinística por `canonicalize` para que
 * exportar → reimportar produzca SIEMPRE el mismo texto, nunca "SIN
 * CAMBIOS" por una diferencia de orden).
 */
export function formatBusinessUnitCell(names: string[]): string {
  if (names.length === 0) return ALL_BUSINESS_UNITS_KEYWORD;
  return [...names].sort((a, b) => canonicalize(a).localeCompare(canonicalize(b))).join(BUSINESS_UNIT_SEPARATOR);
}
